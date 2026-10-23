import { D2 } from '@d2lang/d2';
import type {
  CompileOptions,
  CompileRequest,
  CompileResponse,
  Diagram,
  RenderOptions,
} from '@d2lang/d2';

import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { D2Error } from './d2-error.js';

export const D2_TIMEOUT_MS = 30_000;
export const D2_CONCURRENCY = 2;

export interface D2Engine {
  compile(input: string | CompileRequest, options?: CompileOptions): Promise<CompileResponse>;
  render(diagram: Diagram, options?: RenderOptions): Promise<string>;
  dispose(): Promise<void>;
}

export type D2EngineFactory = () => D2Engine;
export type D2Job<T> = (engine: D2Engine, signal: AbortSignal) => Promise<T>;

/** Bounds active D2 workers and owns timeout, cancellation, and worker disposal. */
export class D2JobRunner {
  private readonly limiter: ConcurrencyLimiter;

  constructor(
    private readonly createEngine: D2EngineFactory = () => new D2(),
    private readonly timeoutMs = D2_TIMEOUT_MS,
    concurrency = D2_CONCURRENCY,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError('D2 timeout must be a positive number');
    }
    this.limiter = new ConcurrencyLimiter(concurrency);
  }

  run<T>(job: D2Job<T>, signal?: AbortSignal): Promise<T> {
    return this.limiter.run(() => this.runActive(job, signal), signal);
  }

  private async runActive<T>(job: D2Job<T>, callerSignal?: AbortSignal): Promise<T> {
    throwIfAborted(callerSignal);
    const timeoutController = new AbortController();
    const timer = setTimeout(
      () =>
        timeoutController.abort(new D2Error(`D2 rendering timed out after ${this.timeoutMs} ms`)),
      this.timeoutMs,
    );
    const signal =
      callerSignal === undefined
        ? timeoutController.signal
        : AbortSignal.any([callerSignal, timeoutController.signal]);

    let engine: D2Engine | undefined;
    let disposePromise: Promise<void> | undefined;
    const dispose = () => {
      if (disposePromise === undefined && engine !== undefined) {
        disposePromise = engine.dispose().catch(() => undefined);
      }
      return disposePromise ?? Promise.resolve();
    };
    const onAbort = () => {
      void dispose();
    };

    try {
      engine = this.createEngine();
      signal.addEventListener('abort', onAbort, { once: true });
      throwIfAborted(signal);
      return await raceWithAbort(job(engine, signal), signal);
    } catch (error) {
      throwIfAborted(signal);
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      await dispose();
    }
  }
}

/** Settles immediately when a signal aborts while retaining handlers on the worker promise. */
export function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) onAbort();
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new D2Error('D2 rendering was cancelled');
}
