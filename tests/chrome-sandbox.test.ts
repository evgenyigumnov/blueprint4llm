import { describe, expect, it, vi } from 'vitest';

import { withChromeSandboxFallback } from '../src/chrome-sandbox.js';

describe('Chromium sandbox fallback', () => {
  it('retries without the sandbox after an OS sandbox startup error', async () => {
    const operation = vi.fn(async (disableSandbox: boolean) => {
      if (!disableSandbox) {
        throw new Error('No usable sandbox!');
      }
      return 'started';
    });

    await expect(withChromeSandboxFallback(operation, false)).resolves.toBe('started');
    expect(operation).toHaveBeenNthCalledWith(1, false);
    expect(operation).toHaveBeenNthCalledWith(2, true);
  });

  it('does not retry when startup fails for another reason', async () => {
    const failure = new Error('browser executable missing');
    const operation = vi.fn(async () => {
      throw failure;
    });

    await expect(withChromeSandboxFallback(operation, false)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('starts without the sandbox when explicitly requested', async () => {
    const operation = vi.fn(async (disableSandbox: boolean) => String(disableSandbox));

    await expect(withChromeSandboxFallback(operation, true)).resolves.toBe('true');
    expect(operation).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(true);
  });
});
