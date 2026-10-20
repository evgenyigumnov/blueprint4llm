/** Retries a Chromium operation without its sandbox when the OS blocks sandbox startup. */
export async function withChromeSandboxFallback<T>(
  operation: (disableSandbox: boolean) => Promise<T>,
  disableSandboxInitially = process.env.BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX === '1',
): Promise<T> {
  if (disableSandboxInitially) {
    return operation(true);
  }

  try {
    return await operation(false);
  } catch (error) {
    if (!isSandboxStartupError(error)) {
      throw error;
    }

    try {
      return await operation(true);
    } catch (retryError) {
      throw new Error(
        `Chromium failed to start with its sandbox and the retry with --no-sandbox also failed: ${errorMessage(retryError)}`,
        { cause: retryError },
      );
    }
  }
}

function isSandboxStartupError(error: unknown): boolean {
  return /no usable sandbox|without --no-sandbox/i.test(errorMessage(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
