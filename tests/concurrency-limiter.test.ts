import { describe, expect, it } from 'vitest';

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
});
