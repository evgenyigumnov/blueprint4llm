import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import type { WorkerOptions } from 'node:worker_threads';

import { ECHARTS_WORKER_SOURCE } from './echarts-worker.js';

import { EChartsError, limitEChartsMessage } from './echarts-error.js';

export const ECHARTS_RENDER_TIMEOUT_MS = 10_000;
export const ECHARTS_WORKER_MAX_OLD_GENERATION_MB = 128;
const MAX_WORKER_WARNINGS = 32;
const require = createRequire(import.meta.url);

export interface EChartsWorkerResult {
  svg: string;
  warnings: string[];
}

interface WorkerSuccessMessage {
  ok: true;
  svg: string;
  warnings: string[];
}

interface WorkerErrorMessage {
  ok: false;
  error: string;
}

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage;

export type EChartsWorkerFactory = (source: string, options: WorkerOptions) => Worker;
const createWorker: EChartsWorkerFactory = (source, options) => new Worker(source, options);

/** Runs synchronous ECharts SSR away from the compiler's event loop. */
export function renderEChartsInWorker(
  option: Record<string, unknown>,
  width: number,
  height: number,
  signal?: AbortSignal,
  workerFactory: EChartsWorkerFactory = createWorker,
): Promise<EChartsWorkerResult> {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  const worker = workerFactory(ECHARTS_WORKER_SOURCE, {
    eval: true,
    workerData: {
      option,
      width,
      height,
      modulePaths: {
        core: require.resolve('echarts/core'),
        charts: require.resolve('echarts/charts'),
        components: require.resolve('echarts/components'),
        renderers: require.resolve('echarts/renderers'),
      },
    },
    resourceLimits: {
      maxOldGenerationSizeMb: ECHARTS_WORKER_MAX_OLD_GENERATION_MB,
      maxYoungGenerationSizeMb: 16,
    },
    execArgv: getEChartsWorkerExecArgv(process.execArgv),
  });

  return new Promise<EChartsWorkerResult>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      finish(new EChartsError('ECharts rendering exceeded the 10 second time limit'));
    }, ECHARTS_RENDER_TIMEOUT_MS);
    timer.unref();

    const onAbort = () => finish(abortError(signal));
    const finish = (error?: Error, result?: EChartsWorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      void worker.terminate().then(
        () => {
          if (error !== undefined) reject(error);
          else if (result !== undefined) resolve(result);
          else reject(new EChartsError('ECharts worker returned an empty result'));
        },
        (terminationError: unknown) => {
          reject(
            error ?? new EChartsError('ECharts worker failed to stop: ' + String(terminationError)),
          );
        },
      );
    };

    worker.once('message', (message: WorkerMessage) => {
      if (
        message === null ||
        typeof message !== 'object' ||
        (message.ok !== true && message.ok !== false)
      ) {
        finish(new EChartsError('ECharts worker returned an invalid response'));
        return;
      }
      if (!message.ok) {
        finish(new EChartsError(limitEChartsMessage(message.error)));
        return;
      }
      if (typeof message.svg !== 'string' || !Array.isArray(message.warnings)) {
        finish(new EChartsError('ECharts worker returned an invalid SVG response'));
        return;
      }
      finish(undefined, {
        svg: message.svg,
        warnings: message.warnings
          .slice(0, MAX_WORKER_WARNINGS)
          .map((warning) => limitEChartsMessage(String(warning))),
      });
    });
    worker.once('error', (error: Error) =>
      finish(new EChartsError(limitEChartsMessage(error.message))),
    );
    worker.once('exit', (code) => {
      if (!settled)
        finish(new EChartsError('ECharts worker exited before returning SVG (code ' + code + ')'));
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

/** Removes process flags that Node does not allow on a worker thread. */
export function getEChartsWorkerExecArgv(execArgv: readonly string[]): string[] {
  return execArgv.filter(
    (argument) => !argument.startsWith('--input-type') && argument !== '--expose-gc',
  );
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new EChartsError('ECharts rendering was aborted');
}
