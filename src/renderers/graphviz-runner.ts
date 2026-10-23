import { Worker } from 'node:worker_threads';

import type {
  GraphvizEngine,
  GraphvizRenderOutput,
  GraphvizWorkerRequest,
  GraphvizWorkerResponse,
} from './graphviz-worker-protocol.js';
import { GRAPHVIZ_RENDER_TIMEOUT_MS } from './graphviz-limits.js';

export interface GraphvizWorkerPort {
  on(event: 'message', listener: (message: unknown) => void): void;
  on(event: 'messageerror', listener: (error: Error) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number) => void): void;
  off(event: 'message', listener: (message: unknown) => void): void;
  off(event: 'messageerror', listener: (error: Error) => void): void;
  off(event: 'error', listener: (error: Error) => void): void;
  off(event: 'exit', listener: (code: number) => void): void;
  postMessage(message: GraphvizWorkerRequest): void;
  terminate(): Promise<number>;
}

export type GraphvizWorkerFactory = (url: URL) => GraphvizWorkerPort;

export interface GraphvizRunnerOptions {
  timeoutMs?: number;
  workerFactory?: GraphvizWorkerFactory;
}

/** Starts one disposable worker per render so synchronous Wasm can be interrupted. */
export class GraphvizRunner {
  private readonly timeoutMs: number;
  private readonly workerFactory: GraphvizWorkerFactory;

  constructor(options: GraphvizRunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? GRAPHVIZ_RENDER_TIMEOUT_MS;
    this.workerFactory = options.workerFactory ?? createNodeWorker;
  }

  async render(
    source: string,
    engine: GraphvizEngine,
    signal?: AbortSignal,
  ): Promise<GraphvizRenderOutput & { graphvizVersion: string; engines: string[] }> {
    throwIfAborted(signal);
    const worker = this.workerFactory(resolveGraphvizWorkerUrl());

    return await new Promise((resolve, reject) => {
      let completed = false;
      let requestSent = false;
      const timeout = setTimeout(() => {
        finish(new Error(`Graphviz rendering timed out after ${this.timeoutMs} ms`));
      }, this.timeoutMs);

      const finish = (
        error?: Error,
        result?: GraphvizRenderOutput & { graphvizVersion: string; engines: string[] },
      ) => {
        if (completed) {
          return;
        }
        completed = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        void (async () => {
          try {
            await worker.terminate();
          } catch (terminationError) {
            if (error === undefined) {
              error = new Error(
                `Graphviz worker could not be terminated: ${errorMessage(terminationError)}`,
                {
                  cause: terminationError,
                },
              );
            }
          } finally {
            worker.off('message', onMessage);
            worker.off('messageerror', onMessageError);
            worker.off('error', onWorkerError);
            worker.off('exit', onExit);
          }
          if (error !== undefined) {
            reject(error);
          } else if (result !== undefined) {
            resolve(result);
          } else {
            reject(new Error('Graphviz worker finished without a result'));
          }
        })();
      };

      const onAbort = () => finish(abortError(signal));
      const onMessage = (rawMessage: unknown) => {
        let message: GraphvizWorkerResponse;
        try {
          message = readWorkerResponse(rawMessage);
        } catch (error) {
          finish(
            new Error(`Graphviz worker sent an invalid response: ${errorMessage(error)}`, {
              cause: error,
            }),
          );
          return;
        }
        if (message.type === 'worker-error') {
          finish(new Error(`Graphviz worker failed: ${message.message}`));
          return;
        }
        if (message.type === 'ready') {
          if (requestSent) {
            finish(new Error('Graphviz worker sent duplicate readiness messages'));
            return;
          }
          if (!message.engines.includes(engine)) {
            finish(new Error(`Graphviz engine "${engine}" is not available in this Wasm build`));
            return;
          }
          requestSent = true;
          try {
            worker.postMessage({ type: 'render', source, engine });
          } catch (error) {
            finish(
              new Error(`Graphviz worker rejected the render request: ${errorMessage(error)}`, {
                cause: error,
              }),
            );
          }
          return;
        }
        if (!requestSent) {
          finish(new Error('Graphviz worker returned a result before it was ready'));
          return;
        }
        finish(undefined, {
          ...message.result,
          graphvizVersion: message.graphvizVersion,
          engines: message.engines,
        });
      };
      const onMessageError = (error: Error) => {
        finish(
          new Error(`Graphviz worker message could not be decoded: ${error.message}`, {
            cause: error,
          }),
        );
      };
      const onWorkerError = (error: Error) => {
        finish(new Error(`Graphviz worker failed: ${error.message}`, { cause: error }));
      };
      const onExit = (code: number) => {
        finish(new Error(`Graphviz worker exited before returning an SVG (code ${code})`));
      };

      worker.on('message', onMessage);
      worker.on('messageerror', onMessageError);
      worker.on('error', onWorkerError);
      worker.on('exit', onExit);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
      }
    });
  }
}

/** Resolves the compiled worker for production and for source-level test imports. */
export function resolveGraphvizWorkerUrl(): URL {
  return import.meta.url.endsWith('.ts')
    ? new URL('../../dist/renderers/graphviz-worker.js', import.meta.url)
    : new URL('./graphviz-worker.js', import.meta.url);
}

function createNodeWorker(url: URL): GraphvizWorkerPort {
  return new Worker(url, { execArgv: [] }) as unknown as GraphvizWorkerPort;
}

function readWorkerResponse(message: unknown): GraphvizWorkerResponse {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    throw new Error('Graphviz worker sent an invalid response');
  }
  const response = message as GraphvizWorkerResponse;
  if (response.type === 'worker-error' && typeof response.message === 'string') {
    return response;
  }
  if (
    response.type === 'ready' &&
    typeof response.graphvizVersion === 'string' &&
    Array.isArray(response.engines) &&
    response.engines.every((engine) => typeof engine === 'string')
  ) {
    return response;
  }
  if (
    response.type === 'render-result' &&
    typeof response.graphvizVersion === 'string' &&
    Array.isArray(response.engines) &&
    response.result !== undefined &&
    (response.result.status === 'success' || response.result.status === 'failure') &&
    Array.isArray(response.result.errors)
  ) {
    return response;
  }
  throw new Error('Graphviz worker sent an invalid response');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortError(signal);
  }
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error('Graphviz rendering was aborted');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
