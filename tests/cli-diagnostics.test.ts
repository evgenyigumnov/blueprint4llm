import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/compiler.js', () => ({ compileMarkdown: vi.fn(), checkMarkdown: vi.fn() }));
vi.mock('../src/image-export.js', () => ({ renderDiagramImage: vi.fn() }));

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, main } from '../src/cli.js';
import { renderDiagramImage } from '../src/image-export.js';
import type { BlueprintDiagnostic } from '../src/diagnostics.js';

const directories: string[] = [];

afterEach(async () => {
  vi.mocked(compileMarkdown).mockReset();
  vi.mocked(checkMarkdown).mockReset();
  vi.mocked(renderDiagramImage).mockReset();
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

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(stderr.join('')).toBe(
      `blueprint4llm: error: ${input}:5:4: mermaid error: Parse error: unexpected token\n` +
        'blueprint4llm: summary: 1 error(s), 0 warning(s)\n',
    );
    expect(stdout.join('')).toBe(`${output}\n`);
    expect(await readFile(output, 'utf8')).toContain('rendered');
  });

  it('passes an explicit diagnostics summary option to the compiler', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-summary-'));
    directories.push(root);
    const input = path.join(root, 'input.md');
    const output = path.join(root, 'output.html');
    await writeFile(input, '# Input');
    vi.mocked(compileMarkdown).mockResolvedValue({
      html: '<!doctype html><html><body>Document check: 0 errors</body></html>',
      title: 'Input',
      assets: [],
      warnings: [],
      errors: [],
      diagnostics: [],
    });

    expect(
      await main([input, '--out', output, '--diagnostics-summary'], {
        out: () => undefined,
        err: () => undefined,
      }),
    ).toBe(EXIT_OK);
    expect(compileMarkdown).toHaveBeenCalledWith(
      '# Input',
      expect.objectContaining({ sourceFile: input, includeDiagnosticsSummary: true }),
    );
  });

  it('writes a JSON report after check without creating HTML or assets', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-report-'));
    directories.push(root);
    const input = path.join(root, 'input.md');
    const reportPath = path.join(root, 'diagnostics.json');
    await writeFile(input, '# Input');
    vi.mocked(checkMarkdown).mockResolvedValue({ warnings: [], errors: [], diagnostics: [] });
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await main([input, '--check', '--report-json', reportPath], {
      out: (text) => stdout.push(text),
      err: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(EXIT_OK);
    expect(stdout.join('')).toBe(`${input}: OK\n`);
    expect(stderr.join('')).toContain('summary: 0 error(s), 0 warning(s)');
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toEqual({
      schemaVersion: 1,
      sourceFile: input,
      status: 'ok',
      summary: { errors: 0, warnings: 0 },
      diagnostics: [],
    });
    expect((await readdir(root)).sort()).toEqual(['diagnostics.json', 'input.md']);
  });

  it('records diagram errors and the saved HTML in a report before returning failure', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-report-'));
    directories.push(root);
    const input = path.join(root, 'input.md');
    const output = path.join(root, 'output.html');
    const reportPath = path.join(root, 'diagnostics.json');
    await writeFile(input, '# Input');
    const diagnostic: BlueprintDiagnostic = {
      severity: 'error',
      code: 'diagram.render',
      scope: 'diagram',
      sourceFile: input,
      line: 5,
      column: 4,
      diagramId: 'bp-diagram-001',
      renderer: 'mermaid',
      message: 'mermaid render failed: Parse error',
    };
    vi.mocked(compileMarkdown).mockResolvedValue({
      html: '<!doctype html><html><body>partial document</body></html>',
      title: 'Input',
      assets: [],
      warnings: [],
      errors: [`${input}:5:4: mermaid render failed: Parse error`],
      diagnostics: [diagnostic],
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await main([input, '--out', output, '--report-json', reportPath], {
      out: (text) => stdout.push(text),
      err: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(stdout.join('')).toBe(`${output}\n`);
    expect(stderr.join('')).toContain('summary: 1 error(s), 0 warning(s)');
    expect(await readFile(output, 'utf8')).toContain('partial document');
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toEqual({
      schemaVersion: 1,
      sourceFile: input,
      status: 'error',
      summary: { errors: 1, warnings: 0 },
      diagnostics: [diagnostic],
      outputs: { html: output },
    });
  });

  it('does not replace an image output when its only diagram has errors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-report-'));
    directories.push(root);
    const input = path.join(root, 'input.md');
    const output = path.join(root, 'old.svg');
    const reportPath = path.join(root, 'diagnostics.json');
    await writeFile(input, '# Input');
    await writeFile(output, 'previous image');
    vi.mocked(compileMarkdown).mockResolvedValue({
      html: '<html>error</html>',
      title: 'Input',
      assets: [],
      warnings: [],
      errors: ['renderer failed'],
      diagnostics: [
        {
          severity: 'error',
          code: 'diagram.render',
          scope: 'diagram',
          sourceFile: input,
          diagramId: 'bp-diagram-001',
          renderer: 'mermaid',
          message: 'renderer failed',
        },
      ],
    });

    expect(
      await main([input, '--out', output, '--format', 'svg', '--report-json', reportPath], {
        out: () => undefined,
        err: () => undefined,
      }),
    ).toBe(EXIT_FAILURE);
    expect(await readFile(output, 'utf8')).toBe('previous image');
    expect(renderDiagramImage).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).not.toHaveProperty('outputs');
  });

  it('rejects a report path that aliases the source before invoking the compiler', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-report-'));
    directories.push(root);
    const actualDirectory = path.join(root, 'actual');
    const aliasDirectory = path.join(root, 'alias');
    await mkdir(actualDirectory);
    const input = path.join(actualDirectory, 'input.md');
    const alias = path.join(aliasDirectory, 'input.md');
    const output = path.join(actualDirectory, 'output.html');
    const outputAlias = path.join(aliasDirectory, 'output.html');
    await writeFile(input, '# Input');
    await writeFile(output, 'previous output');
    await symlink(actualDirectory, aliasDirectory, 'junction');
    const stderr: string[] = [];

    expect(
      await main([input, '--check', '--report-json', alias], {
        out: () => undefined,
        err: (text) => stderr.push(text),
      }),
    ).toBe(EXIT_USAGE);
    expect(stderr.join('')).toContain('--report-json path');
    expect(
      await main([input, '--out', output, '--report-json', outputAlias], {
        out: () => undefined,
        err: (text) => stderr.push(text),
      }),
    ).toBe(EXIT_USAGE);
    expect(checkMarkdown).not.toHaveBeenCalled();
    expect(compileMarkdown).not.toHaveBeenCalled();
    expect(await readFile(output, 'utf8')).toBe('previous output');
  });

  it('reports an unwritable JSON report and returns failure', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-report-'));
    directories.push(root);
    const input = path.join(root, 'input.md');
    const blocker = path.join(root, 'existing-file');
    const reportPath = path.join(blocker, 'diagnostics.json');
    await writeFile(input, '# Input');
    await writeFile(blocker, 'keep me');
    vi.mocked(checkMarkdown).mockResolvedValue({ warnings: [], errors: [], diagnostics: [] });
    const stderr: string[] = [];

    expect(
      await main([input, '--check', '--report-json', reportPath], {
        out: () => undefined,
        err: (text) => stderr.push(text),
      }),
    ).toBe(EXIT_FAILURE);
    expect(stderr.join('')).toContain('cannot write JSON report');
    expect(stderr.join('')).toContain('summary: 1 error(s), 0 warning(s)');
    expect(await readFile(blocker, 'utf8')).toBe('keep me');
  });
});
