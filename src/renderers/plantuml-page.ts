import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import puppeteer from 'puppeteer';
import type { Browser, HTTPRequest, Page } from 'puppeteer';

import { withChromeSandboxFallback } from '../chrome-sandbox.js';

export const PLANTUML_RENDER_TIMEOUT_MS = 30_000;
export const PLANTUML_MAX_SVG_SIZE = 8192;

const PAGE_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  'worker-src blob:',
  "connect-src 'none'",
  'img-src data: blob:',
  "style-src 'unsafe-inline'",
  'font-src data:',
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

const require = createRequire(import.meta.url);

interface PlantUmlEngineSource {
  viz: string;
  engine: string;
}

export interface PlantUmlPageResult {
  svg: string;
  consoleMessages: string[];
}

let engineSourcePromise: Promise<PlantUmlEngineSource> | undefined;

/** Runs PlantUML in a fresh Chromium page that has no filesystem or network loaders. */
export async function renderPlantUmlInPage(
  source: string,
  signal?: AbortSignal,
): Promise<PlantUmlPageResult> {
  throwIfAborted(signal);

  let browser: Browser | undefined;
  let page: Page | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let interruption: Error | undefined;
  let rejectInterrupted: (error: Error) => void = () => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectInterrupted = reject;
  });

  const closeResources = async (): Promise<void> => {
    const activePage = page;
    page = undefined;
    await activePage?.close().catch(() => undefined);

    const activeBrowser = browser;
    browser = undefined;
    await activeBrowser?.close().catch(() => undefined);

    const activeServer = server;
    server = undefined;
    if (activeServer?.listening) {
      await new Promise<void>((resolve) => activeServer.close(() => resolve()));
    }
  };

  const stop = (error: Error): void => {
    if (interruption !== undefined) {
      return;
    }
    interruption = error;
    rejectInterrupted(error);
    void closeResources();
  };

  const signalListener = () => stop(abortError(signal));
  signal?.addEventListener('abort', signalListener, { once: true });
  if (signal?.aborted) {
    signalListener();
  }

  const timeout = setTimeout(
    () => stop(new Error(`PlantUML rendering timed out after ${PLANTUML_RENDER_TIMEOUT_MS} ms`)),
    PLANTUML_RENDER_TIMEOUT_MS,
  );

  const throwIfInterrupted = async (): Promise<void> => {
    if (interruption !== undefined) {
      await closeResources();
      throw interruption;
    }
    if (signal?.aborted) {
      await closeResources();
      throw abortError(signal);
    }
  };

  const rendering = (async (): Promise<PlantUmlPageResult> => {
    server = await startPageServer();
    await throwIfInterrupted();

    const pageUrl = getPageUrl(server);
    browser = await withChromeSandboxFallback((disableSandbox) =>
      puppeteer.launch({ headless: true, args: disableSandbox ? ['--no-sandbox'] : [] }),
    );
    await throwIfInterrupted();

    page = await browser.newPage();
    await throwIfInterrupted();
    page.setDefaultTimeout(PLANTUML_RENDER_TIMEOUT_MS);

    const blockedRequests: string[] = [];
    const consoleMessages: string[] = [];
    let pageError: string | undefined;
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      handlePageRequest(request, pageUrl, blockedRequests);
    });
    page.on('pageerror', (error) => {
      pageError = error instanceof Error ? error.message : String(error);
    });
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('PlantUML:')) {
        consoleMessages.push(text);
      }
    });

    await page.goto(pageUrl, { waitUntil: 'load' });
    await throwIfInterrupted();
    await installDenyByDefaultLoaders(page);

    const engine = await loadPlantUmlEngineSource();
    await page.addScriptTag({ content: engine.viz });
    await page.addScriptTag({
      content: `${engine.engine}\nglobalThis.__blueprintPlantUmlRenderToString = D;`,
      type: 'module',
    });
    await throwIfInterrupted();

    const svg = await page.evaluate(
      (diagramSource: string, maxSvgSize: number) => {
        type RenderToString = (
          lines: string[],
          onSuccess: (svg: string) => void,
          onError: (message: string) => void,
          options: { maxSvgSize: number },
        ) => void;
        const renderToString = (
          globalThis as typeof globalThis & {
            __blueprintPlantUmlRenderToString?: RenderToString;
          }
        ).__blueprintPlantUmlRenderToString;
        if (renderToString === undefined) {
          throw new Error('PlantUML browser API did not initialize');
        }
        return new Promise<string>((resolve, reject) => {
          renderToString(diagramSource.split(/\r\n|\r|\n/), resolve, reject, { maxSvgSize });
        });
      },
      source,
      PLANTUML_MAX_SVG_SIZE,
    );
    await throwIfInterrupted();

    if (blockedRequests.length > 0) {
      throw new Error(`PlantUML attempted a blocked request to "${blockedRequests[0]}"`);
    }
    if (pageError !== undefined) {
      throw new Error(`PlantUML browser page failed: ${pageError}`);
    }
    return { svg, consoleMessages };
  })();

  try {
    return await Promise.race([rendering, interrupted]);
  } catch (error) {
    throw normalizePlantUmlError(error, signal);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', signalListener);
    await closeResources();
  }
}

function startPageServer(): Promise<ReturnType<typeof createServer>> {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': PAGE_CONTENT_SECURITY_POLICY,
      'cache-control': 'no-store',
    });
    response.end(
      '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body></body></html>',
    );
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

function getPageUrl(server: ReturnType<typeof createServer>): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('could not determine the local PlantUML page address');
  }
  return `http://127.0.0.1:${address.port}/`;
}

function handlePageRequest(request: HTTPRequest, pageUrl: string, blockedRequests: string[]): void {
  const url = request.url();
  const isPageDocument = url === pageUrl && request.isNavigationRequest();
  const protocol = url.slice(0, url.indexOf(':')).toLowerCase();
  if (isPageDocument || protocol === 'blob' || protocol === 'data') {
    void request.continue().catch(() => undefined);
    return;
  }

  blockedRequests.push(url);
  void request.abort('blockedbyclient').catch(() => undefined);
}

async function installDenyByDefaultLoaders(page: Page): Promise<void> {
  await page.evaluate(() => {
    type PlantUmlGlobal = typeof globalThis & {
      PLANTUML_FILE_LOADER?: (
        requestedPath: string,
        from: string | null,
        onSuccess: (id: string, contents: string) => void,
        onError: (message: string) => void,
      ) => void;
      PLANTUML_STDLIB_BASE?: string;
      PLANTUML_STDLIB_LOADER?: (
        url: string,
        onSuccess: () => void,
        onError: (message: string) => void,
      ) => boolean;
    };
    const plantUmlGlobal = globalThis as PlantUmlGlobal;
    delete plantUmlGlobal.PLANTUML_STDLIB_BASE;
    plantUmlGlobal.PLANTUML_FILE_LOADER = (_path, _from, _onSuccess, onError) => {
      onError('local PlantUML includes are disabled');
    };
    plantUmlGlobal.PLANTUML_STDLIB_LOADER = (_url, _onSuccess, onError) => {
      onError('PlantUML standard-library and support-file loading is disabled');
      return true;
    };
  });
}

function loadPlantUmlEngineSource(): Promise<PlantUmlEngineSource> {
  engineSourcePromise ??= Promise.all([
    readFile(require.resolve('@plantuml/core/viz-global.js'), 'utf8'),
    readFile(require.resolve('@plantuml/core/plantuml.js'), 'utf8'),
  ]).then(([viz, engine]) => ({ viz, engine }));
  return engineSourcePromise;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortError(signal);
  }
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error('PlantUML rendering was aborted');
}

function normalizePlantUmlError(error: unknown, signal: AbortSignal | undefined): Error {
  if (signal?.aborted) {
    return abortError(signal);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/could not find chrome|browser .*was not found/i.test(message)) {
    return new Error(
      `${message}. Install the Puppeteer-managed browser with: npx puppeteer browsers install chrome`,
      { cause: error },
    );
  }
  if (/no usable sandbox|without --no-sandbox/i.test(message)) {
    return new Error(
      `${message}. Chromium could not start even after an automatic retry with --no-sandbox`,
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(message);
}
