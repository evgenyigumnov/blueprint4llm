import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

const MAX_CAPTURED_OUTPUT = 16 * 1024;
const FORCE_KILL_DELAY_MS = 1_000;

export interface RunCommandOptions {
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface RunCommandOutput {
  stdout: string;
  stderr: string;
}

/** Runs without a shell, captures bounded output, and kills on timeout or cancellation. */
export function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions,
): Promise<void> {
  return runCommandWithOutput(command, args, options).then(() => undefined);
}

/** Runs a command and returns its bounded output when it exits successfully. */
export function runCommandWithOutput(
  command: string,
  args: readonly string[],
  options: RunCommandOptions,
): Promise<RunCommandOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let spawnError: Error | undefined;
    let forceKillHandle: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
      forceKillHandle = scheduleForceKill(child);
    }, options.timeoutMs);

    if (options.signal !== undefined) {
      abortListener = () => {
        if (timedOut || aborted) {
          return;
        }
        aborted = true;
        clearTimeout(timeoutHandle);
        terminateProcessTree(child);
        forceKillHandle = scheduleForceKill(child);
      };
      options.signal.addEventListener('abort', abortListener, { once: true });
      if (options.signal.aborted) {
        abortListener();
      }
    }

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout = appendTail(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr = appendTail(stderr, chunk);
    });

    child.once('error', (error) => {
      spawnError = error;
    });

    child.once('close', (code, signal) => {
      clearTimeout(timeoutHandle);
      if (abortListener !== undefined) {
        options.signal?.removeEventListener('abort', abortListener);
      }
      if (process.platform === 'win32' || (!timedOut && !aborted) || !hasProcessGroup(child.pid)) {
        clearTimeout(forceKillHandle);
      }

      if (timedOut) {
        reject(new Error(`command timed out after ${options.timeoutMs} ms${formatOutput(stderr)}`));
      } else if (aborted) {
        reject(
          options.signal?.reason instanceof Error
            ? options.signal.reason
            : new Error('command was aborted'),
        );
      } else if (spawnError !== undefined) {
        reject(new Error(`could not start command: ${spawnError.message}`));
      } else if (code !== 0) {
        const status = signal === null ? `exit code ${String(code)}` : `signal ${signal}`;
        reject(new Error(`command failed with ${status}${formatOutput(stderr || stdout)}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function scheduleForceKill(child: ChildProcess): NodeJS.Timeout {
  return setTimeout(() => terminateProcessTree(child, 'SIGKILL'), FORCE_KILL_DELAY_MS);
}

function appendTail(current: string, chunk: Buffer | string): string {
  return `${current}${chunk.toString()}`.slice(-MAX_CAPTURED_OUTPUT);
}

function formatOutput(output: string): string {
  const trimmed = output.trim();
  return trimmed.length === 0 ? '' : `: ${trimmed}`;
}

function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  const pid = child.pid;
  if (pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    taskkill.once('error', () => child.kill('SIGTERM'));
    taskkill.unref();
    return;
  }

  try {
    process.kill(-pid, signal);
  } catch {
    child.kill(signal);
  }
}

function hasProcessGroup(pid: number | undefined): boolean {
  if (pid === undefined || process.platform === 'win32') {
    return false;
  }
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
  }
}
