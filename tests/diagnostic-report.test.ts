import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertReportPathAvailable,
  createDiagnosticReport,
  diagnosticForError,
  ReportPathConflictError,
  serializeDiagnosticReport,
} from '../src/diagnostic-report.js';
import type { BlueprintDiagnostic } from '../src/diagnostics.js';
import { DiagnosticError } from '../src/errors.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('diagnostic reports', () => {
  it('serializes a success report with an empty list and a final newline', () => {
    const report = createDiagnosticReport('relative/plan.md', []);
    const json = serializeDiagnosticReport(report);

    expect(report).toEqual({
      schemaVersion: 1,
      sourceFile: path.resolve('relative/plan.md'),
      status: 'ok',
      summary: { errors: 0, warnings: 0 },
      diagnostics: [],
    });
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.parse(json)).toEqual(report);
  });

  it('sets error status and lists only saved outputs', () => {
    const diagnostics = [makeDiagnostic({ message: 'invalid node' })];

    expect(
      createDiagnosticReport('/docs/plan.md', diagnostics, { html: '/out/plan.html' }),
    ).toEqual({
      schemaVersion: 1,
      sourceFile: path.resolve('/docs/plan.md'),
      status: 'error',
      summary: { errors: 1, warnings: 0 },
      diagnostics,
      outputs: { html: '/out/plan.html' },
    });
  });

  it('converts a fatal error to a safe record without serializing its cause', () => {
    const diagnostic = diagnosticForError(
      new DiagnosticError('renderer failed', {
        sourceFile: '/docs/plan.md',
        line: 9,
        column: 3,
        cause: new Error('private stack detail'),
      }),
      '/docs/fallback.md',
      'document.compile',
      'document',
    );

    expect(diagnostic).toEqual({
      severity: 'error',
      code: 'document.compile',
      scope: 'document',
      sourceFile: path.resolve('/docs/plan.md'),
      line: 9,
      column: 3,
      message: 'renderer failed',
    });
    expect(
      serializeDiagnosticReport(createDiagnosticReport('/docs/plan.md', [diagnostic])),
    ).not.toContain('private stack detail');
  });

  it('rejects report paths that alias the source or output through a linked directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint-report-test-'));
    directories.push(root);
    const actualDirectory = path.join(root, 'actual');
    const aliasDirectory = path.join(root, 'alias');
    await mkdir(actualDirectory);
    const source = path.join(actualDirectory, 'plan.md');
    const output = path.join(actualDirectory, 'plan.html');
    const sourceAlias = path.join(aliasDirectory, 'plan.md');
    const outputAlias = path.join(aliasDirectory, 'plan.html');
    await writeFile(source, '# Plan');
    await writeFile(output, '<html>');
    await symlink(actualDirectory, aliasDirectory, 'junction');

    await expect(assertReportPathAvailable(sourceAlias, source)).rejects.toBeInstanceOf(
      ReportPathConflictError,
    );
    await expect(assertReportPathAvailable(outputAlias, source, output)).rejects.toBeInstanceOf(
      ReportPathConflictError,
    );
    await expect(
      assertReportPathAvailable(path.join(root, 'report.json'), source, output),
    ).resolves.toBe(undefined);
  });
});

function makeDiagnostic(overrides: Partial<BlueprintDiagnostic> = {}): BlueprintDiagnostic {
  return {
    severity: 'error',
    code: 'diagram.render',
    scope: 'diagram',
    sourceFile: '/docs/plan.md',
    line: 12,
    column: 4,
    diagramId: 'bp-diagram-001',
    renderer: 'mermaid',
    message: 'Parse error',
    ...overrides,
  };
}
