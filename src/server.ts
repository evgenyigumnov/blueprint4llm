import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';

import { compileMarkdown } from './compiler.js';
import type { CompiledBlueprint } from './compiler.js';
import { toDiagnosticError } from './errors.js';
import { renderPdf } from './pdf.js';
import { DiagramRenderCache } from './renderers/cache.js';
import { createPreviewHttpServer } from './server/http.js';
import type { PreviewHttpState } from './server/http.js';
import { VersionedPdfCache } from './server/pdf-cache.js';

const DEFAULT_DEBOUNCE_MS = 200;

export interface PreviewServerOptions {
  input: string;
  port: number;
  debounceMs?: number;
  out?: (text: string) => void;
  err?: (text: string) => void;
  signal?: AbortSignal;
  /** Renderer injection keeps HTTP/cache tests independent of Chromium. */
  renderPdf?: typeof renderPdf;
  /** Compiler injection lets lifecycle tests control out-of-order build completion. */
  compile?: typeof compileMarkdown;
}

export interface PreviewServerHandle {
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

/** Starts the local preview server, compiles in memory, and watches its inputs. */
export async function startPreviewServer(
  options: PreviewServerOptions,
): Promise<PreviewServerHandle> {
  const sourceFile = path.resolve(options.input);
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const logOut = options.out ?? (() => undefined);
  const logError = options.err ?? (() => undefined);
  const state: PreviewHttpState = {
    compiled: undefined,
    version: undefined,
    diagnostic: undefined,
    dirty: true,
    building: false,
  };
  const diagramCache = new DiagramRenderCache();
  const pdfCache = new VersionedPdfCache();
  const initialPaths = new Set([sourceFile]);
  let watchedPaths = initialPaths;
  let revision = 0;
  let debounceTimer: NodeJS.Timeout | undefined;
  let activeBuildController: AbortController | undefined;
  let activeBuild: Promise<void> | undefined;
  let closed = false;
  let watcher: FSWatcher | undefined;
  let listenAddress: AddressInfo | undefined;
  let closePromise: Promise<void> | undefined;

  const http = createPreviewHttpServer(state, (version, compiled) =>
    pdfCache.get(version, (signal) => (options.renderPdf ?? renderPdf)(compiled, { signal })),
  );

  const syncWatchPaths = (paths: Iterable<string>, keepExisting: boolean): void => {
    const next = new Set([sourceFile, ...(keepExisting ? watchedPaths : []), ...paths]);
    const additions = [...next].filter((filePath) => !watchedPaths.has(filePath));
    const removals = [...watchedPaths].filter((filePath) => !next.has(filePath));
    watchedPaths = next;
    watcher?.add(additions);
    if (removals.length > 0) {
      void watcher?.unwatch(removals);
    }
  };

  const performBuild = async (buildRevision: number): Promise<void> => {
    const controller = new AbortController();
    activeBuildController = controller;
    state.building = true;
    state.dirty = true;
    state.diagnostic = undefined;
    const discoveredPaths = new Set<string>();

    try {
      const markdown = await readFile(sourceFile, 'utf8');
      const compiled = await (options.compile ?? compileMarkdown)(markdown, {
        sourceFile,
        diagramCache,
        watchPaths: discoveredPaths,
        signal: controller.signal,
      });
      if (closed || buildRevision !== revision || controller.signal.aborted) {
        if (!closed) {
          syncWatchPaths(discoveredPaths, true);
        }
        return;
      }

      const dependencies = [
        ...discoveredPaths,
        ...compiled.assets.map((asset) => asset.sourcePath),
      ];
      syncWatchPaths(dependencies, false);
      state.compiled = compiled;
      state.version = compiledVersion(compiled);
      state.diagnostic = undefined;
      state.dirty = false;
      for (const warning of compiled.warnings) {
        logError(`blueprint4llm: warning: ${warning}\n`);
      }
      for (const error of compiled.errors ?? []) {
        logError(`blueprint4llm: error: ${error}\n`);
      }
    } catch (error) {
      if (closed || buildRevision !== revision || controller.signal.aborted) {
        if (!closed) {
          syncWatchPaths(discoveredPaths, true);
        }
        return;
      }
      syncWatchPaths(discoveredPaths, true);
      const diagnostic = toDiagnosticError(error, 'render failed', { sourceFile });
      state.diagnostic = diagnostic.format();
      state.dirty = false;
      logError(`blueprint4llm: ${diagnostic.format()}\n`);
    } finally {
      if (buildRevision === revision) {
        state.building = false;
        activeBuildController = undefined;
        activeBuild = undefined;
        if (!closed) {
          http.broadcastReload();
        }
      }
    }
  };

  const launchBuild = (): void => {
    if (closed) {
      return;
    }
    activeBuildController?.abort(new Error('newer preview build started'));
    revision += 1;
    const buildRevision = revision;
    activeBuild = performBuild(buildRevision);
  };

  const closeInternal = (): Promise<void> => {
    if (closePromise !== undefined) {
      return closePromise;
    }
    closed = true;
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    activeBuildController?.abort(new Error('preview server is shutting down'));
    http.closeEvents();
    const buildToClose = activeBuild;
    const watcherClose = watcher?.close();
    const serverClose = closeHttpServer(http.server);
    http.server.closeAllConnections();
    closePromise = Promise.allSettled([
      watcherClose,
      serverClose,
      buildToClose?.catch(() => undefined),
      pdfCache.close(),
    ]).then(() => {
      diagramCache.clear();
    });
    return closePromise;
  };

  const onAbort = (): void => {
    void closeInternal();
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  const scheduleBuild = (): void => {
    if (closed) {
      return;
    }
    revision += 1;
    state.dirty = true;
    state.diagnostic = undefined;
    pdfCache.invalidate();
    activeBuildController?.abort(new Error('source changed during preview build'));
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      launchBuild();
    }, debounceMs);
  };

  try {
    throwIfAborted(options.signal);
    watcher = chokidar.watch([...initialPaths], {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 30 },
      persistent: true,
    });
    watcher.on('all', (_event, changedPath) => {
      const normalizedPath = path.resolve(changedPath);
      if (watchedPaths.has(normalizedPath)) {
        scheduleBuild();
      }
    });
    watcher.on('error', (error) => {
      logError(`blueprint4llm: file watcher error: ${errorMessage(error)}\n`);
    });
    await waitForWatcher(watcher, options.signal);
    throwIfAborted(options.signal);
    listenAddress = await listen(http.server, options.port, options.signal);
    logOut(`http://127.0.0.1:${listenAddress.port}/\n`);

    launchBuild();
    await activeBuild;
    throwIfAborted(options.signal);
  } catch (error) {
    options.signal?.removeEventListener('abort', onAbort);
    await closeInternal().catch(() => undefined);
    throw error;
  }

  if (listenAddress === undefined) {
    throw new Error('preview server did not start listening');
  }

  return {
    port: listenAddress.port,
    url: `http://127.0.0.1:${listenAddress.port}/`,
    async close() {
      options.signal?.removeEventListener('abort', onAbort);
      await closeInternal();
    },
  };
}

function compiledVersion(compiled: CompiledBlueprint): string {
  const hash = createHash('sha256').update(compiled.html);
  for (const asset of compiled.assets) {
    hash.update('\0').update(asset.outputName).update('\0').update(asset.bytes);
  }
  return hash.digest('hex');
}

function waitForWatcher(watcher: FSWatcher, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      watcher.off('ready', onReady);
      watcher.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
      reject(
        signal?.reason instanceof Error ? signal.reason : new Error('preview startup was aborted'),
      );
    };
    const onReady = () => {
      watcher.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onError = (error: unknown) => {
      watcher.off('ready', onReady);
      signal?.removeEventListener('abort', onAbort);
      reject(error);
    };
    watcher.once('ready', onReady);
    watcher.once('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
    }
  });
}

function listen(
  server: ReturnType<typeof createPreviewHttpServer>['server'],
  port: number,
  signal?: AbortSignal,
): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    let aborted = false;
    const abortError = (): Error =>
      signal?.reason instanceof Error ? signal.reason : new Error('preview startup was aborted');
    const rejectAfterClose = (): void => {
      server.off('listening', onListening);
      server.off('error', onError);
      reject(abortError());
    };
    const onError = (error: Error) => {
      server.off('listening', onListening);
      server.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
      reject(aborted ? abortError() : error);
    };
    const onListening = () => {
      server.off('listening', onListening);
      server.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
      if (aborted || signal?.aborted) {
        void closeHttpServer(server).then(rejectAfterClose, rejectAfterClose);
        return;
      }
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('preview server did not bind to a TCP address'));
        return;
      }
      resolve(address);
    };
    const onAbort = (): void => {
      aborted = true;
      signal?.removeEventListener('abort', onAbort);
      if (server.listening) {
        void closeHttpServer(server).then(rejectAfterClose, rejectAfterClose);
      }
    };
    server.once('error', onError);
    server.once('listening', onListening);
    signal?.addEventListener('abort', onAbort, { once: true });
    server.listen(port, '127.0.0.1');
    if (signal?.aborted) {
      onAbort();
    }
  });
}

function closeHttpServer(
  server: ReturnType<typeof createPreviewHttpServer>['server'],
): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined && !isServerNotRunning(error)) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function isServerNotRunning(error: Error): boolean {
  return 'code' in error && error.code === 'ERR_SERVER_NOT_RUNNING';
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('preview server startup was aborted');
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
