import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const cliPath = path.join(projectRoot, 'dist', 'cli.js');
const temporaryDirectories: string[] = [];

interface CliResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface RunningCli {
  child: ChildProcessByStdio<null, Readable, Readable>;
  result: Promise<CliResult>;
  stdout: () => string;
  stderr: () => string;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('built CLI integration', () => {
  it('writes HTML and PDF exports through the executable', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'spec.md');
    await writeFile(input, '# CLI integration\n\n| A | B |\n| - | - |\n| 1 | 2 |\n');

    const htmlPath = path.join(root, 'html output', 'spec.html');
    const htmlRun = await runCli([input, '--out', htmlPath]);
    expect(htmlRun.code).toBe(0);
    expect(htmlRun.stdout).toBe(`${htmlPath}\n`);
    expect(await readFile(htmlPath, 'utf8')).toContain('<div class="bp-table"><table>');

    const pdfPath = path.join(root, 'pdf output', 'spec.pdf');
    const pdfRun = await runCli([input, '--out', pdfPath, '--format', 'pdf']);
    expect(pdfRun.code).toBe(0);
    expect(pdfRun.stdout).toBe(`${pdfPath}\n`);
    expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(readFile(path.join(path.dirname(pdfPath), 'spec.html'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  }, 120_000);

  it('serves the compiled page and on-demand PDF through the executable', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'preview.md');
    await writeFile(input, '# Preview integration\n\nPDF is generated on demand.\n');

    const port = await getAvailablePort();
    const server = launchCli([input, '--serve', `--port=${port}`]);
    try {
      const baseUrl = await waitForServerUrl(server);
      const htmlResponse = await fetch(baseUrl);
      expect(htmlResponse.status).toBe(200);
      const html = await htmlResponse.text();
      expect(html).toContain('Preview integration');
      expect(html).toContain('href="/document.pdf" download="index.pdf"');

      const pdfResponse = await fetch(new URL('/document.pdf', baseUrl));
      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers.get('content-type')).toContain('application/pdf');
      expect(pdfResponse.headers.get('content-disposition')).toBe(
        'attachment; filename="index.pdf"',
      );
      expect(
        Buffer.from(await pdfResponse.arrayBuffer())
          .subarray(0, 5)
          .toString(),
      ).toBe('%PDF-');
    } finally {
      if (server.child.exitCode === null && server.child.signalCode === null) {
        server.child.kill('SIGTERM');
      }
      const result = await server.result;
      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
    }
  }, 120_000);
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-e2e-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function runCli(args: string[]): Promise<CliResult> {
  const process = launchCli(args);
  return process.result;
}

function launchCli(args: string[]): RunningCli {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  const result = new Promise<CliResult>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, result, stdout: () => stdout, stderr: () => stderr };
}

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('could not reserve a TCP port');
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

async function waitForServerUrl(server: RunningCli): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const match = server.stdout().match(/http:\/\/127\.0\.0\.1:\d+\//);
    if (match?.[0] !== undefined) {
      return match[0];
    }
    if (server.child.exitCode !== null) {
      const result = await server.result;
      throw new Error(`preview server exited early (${result.code}): ${result.stderr}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for preview server startup: ${server.stderr()}`);
}
