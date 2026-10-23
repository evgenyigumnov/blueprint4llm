/** A small FIFO limiter shared by all renderer calls in this process. */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<Waiter> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('concurrency limit must be a positive integer');
    }
  }

  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    throwIfAborted(signal);
    if (this.active >= this.limit) {
      await this.waitForSlot(signal);
    } else {
      this.active += 1;
    }

    try {
      throwIfAborted(signal);
      return await operation();
    } finally {
      const next = this.waiting.shift();
      if (next === undefined) {
        this.active -= 1;
      } else {
        next.resolve();
      }
    }
  }

  private waitForSlot(signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve: () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        },
        reject: (error) => {
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        },
      };
      const onAbort = () => {
        const index = this.waiting.indexOf(waiter);
        if (index >= 0) this.waiting.splice(index, 1);
        waiter.reject(abortError(signal));
      };
      this.waiting.push(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
}

interface Waiter {
  resolve(): void;
  reject(error: Error): void;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError(signal);
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error('diagram rendering was aborted');
}
