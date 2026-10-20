import { describe, expect, it } from 'vitest';

import { runCommand, runCommandWithOutput } from '../src/renderers/run-command.js';

describe('runCommand', () => {
  it('runs without a shell and resolves when the process succeeds', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'process.stdout.write("done")'], {
        cwd: process.cwd(),
        timeoutMs: 1_000,
      }),
    ).resolves.toBeUndefined();
  });

  it('returns stdout and stderr for successful commands when requested', async () => {
    await expect(
      runCommandWithOutput(
        process.execPath,
        ['-e', 'process.stdout.write("svg ready"); console.error("Parse error on line 2")'],
        { cwd: process.cwd(), timeoutMs: 1_000 },
      ),
    ).resolves.toEqual({ stdout: 'svg ready', stderr: 'Parse error on line 2\n' });
  });

  it('includes bounded stderr context when the process fails', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'console.error("render failed"); process.exit(7)'], {
        cwd: process.cwd(),
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow(/exit code 7: render failed/);
  });

  it('terminates a process tree after the timeout', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
        cwd: process.cwd(),
        timeoutMs: 25,
      }),
    ).rejects.toThrow(/timed out after 25 ms/);
  });

  it('terminates a process tree when its AbortSignal is cancelled', async () => {
    const controller = new AbortController();
    const childCode = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)';
    const parentCode = `const { spawn } = require("node:child_process"); spawn(${JSON.stringify(
      process.execPath,
    )}, ["-e", ${JSON.stringify(childCode)}], { stdio: "inherit" }); setInterval(() => {}, 1000)`;
    const command = runCommand(process.execPath, ['-e', parentCode], {
      cwd: process.cwd(),
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(new Error('preview stopped')), 25);

    await expect(command).rejects.toThrow('preview stopped');
  });

  it('force-kills descendants that keep inherited pipes open', async () => {
    const childCode = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)';
    const parentCode = `const { spawn } = require("node:child_process"); spawn(${JSON.stringify(
      process.execPath,
    )}, ["-e", ${JSON.stringify(childCode)}], { stdio: "inherit" }); setInterval(() => {}, 1000)`;

    await expect(
      runCommand(process.execPath, ['-e', parentCode], {
        cwd: process.cwd(),
        timeoutMs: 25,
      }),
    ).rejects.toThrow(/timed out after 25 ms/);
  }, 5_000);
});
