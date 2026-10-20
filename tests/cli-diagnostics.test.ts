import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/compiler.js', () => ({ compileMarkdown: vi.fn() }));

import { compileMarkdown } from '../src/compiler.js';
import { EXIT_OK, main } from '../src/cli.js';

const directories: string[] = [];

afterEach(async () => {
  vi.mocked(compileMarkdown).mockReset();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('CLI non-fatal diagram diagnostics', () => {
  it('prints renderer errors and still writes the compiled HTML', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-diagnostics-'));
    directories.push(root);
    const input = path.join(root, 'input.md');
    const output = path.join(root, 'output.html');
    await writeFile(input, '# Input');
    vi.mocked(compileMarkdown).mockResolvedValue({
      html: '<!doctype html><html><body>rendered</body></html>',
      title: 'Input',
      assets: [],
      warnings: [],
      errors: [`${input}:5:4: mermaid error: Parse error: unexpected token`],
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await main([input, '--out', output], {
      out: (text) => stdout.push(text),
      err: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(EXIT_OK);
    expect(stderr.join('')).toBe(
      `blueprint4llm: error: ${input}:5:4: mermaid error: Parse error: unexpected token\n`,
    );
    expect(stdout.join('')).toBe(`${output}\n`);
    expect(await readFile(output, 'utf8')).toContain('rendered');
  });
});
