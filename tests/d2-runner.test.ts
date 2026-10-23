import { describe, expect, it, vi } from 'vitest';

import { D2Error } from '../src/renderers/d2-error.js';
import { D2JobRunner, raceWithAbort, type D2Engine } from '../src/renderers/d2-runner.js';

function fakeEngine(onDispose: () => void = () => undefined): D2Engine {
  return {
    compile: async () => {
      throw new Error('compile is not used in this test');
    },
    render: async () => '<svg/>',
    dispose: async () => onDispose(),
  };
}

describe('D2 worker runner', () => {
  it('disposes its worker after a successful job and after a failure', async () => {
    const dispose = vi.fn();
    const runner = new D2JobRunner(() => fakeEngine(dispose), 1000, 1);

    await expect(runner.run(async () => 'done')).resolves.toBe('done');
    expect(dispose).toHaveBeenCalledTimes(1);

    await expect(runner.run(async () => Promise.reject(new Error('job failed')))).rejects.toThrow(
      'job failed',
    );
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('aborts an active worker at timeout and preserves the timeout reason', async () => {
    const dispose = vi.fn();
    const runner = new D2JobRunner(() => fakeEngine(dispose), 5, 1);

    await expect(runner.run(() => new Promise(() => undefined))).rejects.toMatchObject({
      name: 'D2Error',
      message: 'D2 rendering timed out after 5 ms',
    });
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('cancels queued work without creating a worker', async () => {
    let releaseFirst: ((value: string) => void) | undefined;
    const createEngine = vi.fn(() => fakeEngine());
    const runner = new D2JobRunner(createEngine, 1000, 1);
    const first = runner.run(() => new Promise<string>((resolve) => (releaseFirst = resolve)));
    const controller = new AbortController();
    const second = runner.run(async () => 'should not start', controller.signal);

    controller.abort(new D2Error('superseded build'));
    await expect(second).rejects.toThrow('superseded build');
    expect(createEngine).toHaveBeenCalledTimes(1);
    releaseFirst?.('first complete');
    await expect(first).resolves.toBe('first complete');
  });

  it('limits process concurrency to two D2 workers', async () => {
    let active = 0;
    let maxActive = 0;
    const runner = new D2JobRunner(() => fakeEngine(), 1000);

    await Promise.all(
      Array.from({ length: 5 }, () =>
        runner.run(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
        }),
      ),
    );

    expect(maxActive).toBe(2);
  });

  it('uses cancellation to dispose a worker while a job is waiting', async () => {
    const dispose = vi.fn();
    const controller = new AbortController();
    const runner = new D2JobRunner(() => fakeEngine(dispose), 1000, 1);
    const pending = runner.run(() => new Promise(() => undefined), controller.signal);

    controller.abort(new D2Error('newer source'));
    await expect(pending).rejects.toThrow('newer source');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid timeout configuration and races an operation against abort', async () => {
    expect(() => new D2JobRunner(() => fakeEngine(), 0)).toThrow(RangeError);
    const controller = new AbortController();
    const pending = raceWithAbort(new Promise(() => undefined), controller.signal);

    controller.abort(new Error('cancelled'));
    await expect(pending).rejects.toThrow('cancelled');
  });
});
