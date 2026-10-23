import { describe, expect, it, vi } from 'vitest';

import { ConcurrencyLimiter } from '../src/renderers/concurrency-limiter.js';

describe('ConcurrencyLimiter', () => {
  it('rejects invalid limits', () => {
    expect(() => new ConcurrencyLimiter(0)).toThrow(/positive integer/);
    expect(() => new ConcurrencyLimiter(1.5)).toThrow(/positive integer/);
  });

  it('runs queued operations in order without exceeding the limit', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let active = 0;
    let peak = 0;
    const starts: number[] = [];

    await Promise.all(
      [1, 2, 3, 4, 5].map((id) =>
        limiter.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          starts.push(id);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
        }),
      ),
    );

    expect(peak).toBe(2);
    expect(starts).toEqual([1, 2, 3, 4, 5]);
    expect(active).toBe(0);
  });

  it('removes an aborted queued operation and releases the next waiter', async () => {
    const limiter = new ConcurrencyLimiter(1);
    let releaseFirst: (() => void) | undefined;
    const first = limiter.run(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const cancelled = new AbortController();
    const secondOperation = vi.fn(async () => undefined);
    const second = limiter.run(secondOperation, cancelled.signal);
    const thirdOperation = vi.fn(async () => undefined);
    const third = limiter.run(thirdOperation);

    cancelled.abort(new Error('queued render cancelled'));
    await expect(second).rejects.toThrow('queued render cancelled');
    releaseFirst?.();
    await first;
    await third;

    expect(secondOperation).not.toHaveBeenCalled();
    expect(thirdOperation).toHaveBeenCalledOnce();
  });

  it('does not start an operation for a signal already aborted', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const controller = new AbortController();
    controller.abort(new Error('already cancelled'));
    const operation = vi.fn(async () => undefined);

    await expect(limiter.run(operation, controller.signal)).rejects.toThrow('already cancelled');
    expect(operation).not.toHaveBeenCalled();
  });
});
