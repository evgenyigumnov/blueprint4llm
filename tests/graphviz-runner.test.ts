import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import {
  GraphvizRunner,
  resolveGraphvizWorkerUrl,
  type GraphvizWorkerPort,
} from '../src/renderers/graphviz-runner.js';
import { GRAPHVIZ_ENGINES } from '../src/renderers/graphviz-worker-protocol.js';

class MockWorker extends EventEmitter implements GraphvizWorkerPort {
  readonly requests: unknown[] = [];
  terminationCount = 0;
  onRequest?: () => void;

  postMessage(message: unknown): void {
    this.requests.push(message);
    this.onRequest?.();
  }

  async terminate(): Promise<number> {
    this.terminationCount += 1;
    this.emit('exit', 0);
    return 0;
  }
}

const READY = {
  type: 'ready' as const,
  graphvizVersion: '16.1.0',
  engines: [...GRAPHVIZ_ENGINES],
};

function createRunner(
  worker: MockWorker,
  options: { timeoutMs?: number; onRequest?: () => void } = {},
): GraphvizRunner {
  if (options.onRequest !== undefined) {
    worker.onRequest = options.onRequest;
  }
  return new GraphvizRunner({
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    workerFactory: () => {
      queueMicrotask(() => worker.emit('message', READY));
      return worker;
    },
  });
}

describe('Graphviz worker runner', () => {
  it('sends one render request and terminates after a result', async () => {
    const worker = new MockWorker();
    worker.onRequest = () => {
      queueMicrotask(() =>
        worker.emit('message', {
          type: 'render-result',
          graphvizVersion: '16.1.0',
          engines: [...GRAPHVIZ_ENGINES],
          result: { status: 'success', output: '<svg/>', errors: [] },
        }),
      );
    };

    await expect(createRunner(worker).render('digraph { a -> b }', 'dot')).resolves.toEqual({
      status: 'success',
      output: '<svg/>',
      errors: [],
      graphvizVersion: '16.1.0',
      engines: [...GRAPHVIZ_ENGINES],
    });
    expect(worker.requests).toEqual([
      { type: 'render', source: 'digraph { a -> b }', engine: 'dot' },
    ]);
    expect(worker.terminationCount).toBe(1);
    expect(worker.listenerCount('message')).toBe(0);
    expect(worker.listenerCount('error')).toBe(0);
    expect(worker.listenerCount('exit')).toBe(0);
  });

  it('fails when the requested engine is missing and terminates the worker', async () => {
    const worker = new MockWorker();
    const runner = new GraphvizRunner({
      timeoutMs: 100,
      workerFactory: () => {
        queueMicrotask(() => worker.emit('message', { ...READY, engines: ['dot'] }));
        return worker;
      },
    });

    await expect(runner.render('graph {}', 'neato')).rejects.toThrow('not available');
    expect(worker.terminationCount).toBe(1);
    expect(worker.requests).toHaveLength(0);
  });

  it('terminates and rejects on timeout', async () => {
    vi.useRealTimers();
    const worker = new MockWorker();
    const runner = new GraphvizRunner({ timeoutMs: 5, workerFactory: () => worker });

    await expect(runner.render('graph {}', 'dot')).rejects.toThrow('timed out after 5 ms');
    expect(worker.terminationCount).toBe(1);
  });

  it('terminates a worker when an active build is aborted', async () => {
    const worker = new MockWorker();
    const controller = new AbortController();
    worker.onRequest = () => queueMicrotask(() => controller.abort(new Error('stale build')));
    const runner = createRunner(worker);

    await expect(runner.render('graph {}', 'dot', controller.signal)).rejects.toThrow(
      'stale build',
    );
    expect(worker.terminationCount).toBe(1);
  });

  it('rejects worker initialization errors, runtime errors, invalid messages, and early exits', async () => {
    const initializationError = new MockWorker();
    const runner = new GraphvizRunner({
      workerFactory: () => {
        queueMicrotask(() =>
          initializationError.emit('message', { type: 'worker-error', message: 'Wasm failed' }),
        );
        return initializationError;
      },
    });
    await expect(runner.render('graph {}', 'dot')).rejects.toThrow('Wasm failed');
    expect(initializationError.terminationCount).toBe(1);

    const runtimeError = new MockWorker();
    const runtimeRunner = createRunner(runtimeError, {
      onRequest: () => queueMicrotask(() => runtimeError.emit('error', new Error('crashed'))),
    });
    await expect(runtimeRunner.render('graph {}', 'dot')).rejects.toThrow('crashed');

    const invalidResponse = new MockWorker();
    const invalidRunner = new GraphvizRunner({
      workerFactory: () => {
        queueMicrotask(() => invalidResponse.emit('message', { type: 'unexpected' }));
        return invalidResponse;
      },
    });
    await expect(invalidRunner.render('graph {}', 'dot')).rejects.toThrow('invalid response');

    const exited = new MockWorker();
    const exitedRunner = new GraphvizRunner({
      workerFactory: () => {
        queueMicrotask(() => exited.emit('exit', 2));
        return exited;
      },
    });
    await expect(exitedRunner.render('graph {}', 'dot')).rejects.toThrow('code 2');
  });

  it('rejects an already aborted request without creating a worker', async () => {
    const workerFactory = vi.fn(() => new MockWorker());
    const controller = new AbortController();
    controller.abort(new Error('cancelled before start'));
    const runner = new GraphvizRunner({ workerFactory });

    await expect(runner.render('graph {}', 'dot', controller.signal)).rejects.toThrow(
      'cancelled before start',
    );
    expect(workerFactory).not.toHaveBeenCalled();
  });

  it('resolves the worker beside compiled files and the build output for source imports', () => {
    expect(resolveGraphvizWorkerUrl().pathname).toContain('/renderers/graphviz-worker.js');
  });
});
