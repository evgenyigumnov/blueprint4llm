/** A small FIFO limiter shared by all renderer calls in this process. */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('concurrency limit must be a positive integer');
    }
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active += 1;
    }

    try {
      return await operation();
    } finally {
      const next = this.waiting.shift();
      if (next === undefined) {
        this.active -= 1;
      } else {
        next();
      }
    }
  }
}
