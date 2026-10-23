import { describe, expect, it } from 'vitest';

import {
  formatDiagnostic,
  summarizeDiagnostics,
  type BlueprintDiagnostic,
} from '../src/diagnostics.js';
import { DiagnosticError, diagnosticFromError } from '../src/errors.js';

describe('diagnostics', () => {
  it('counts an empty list and warnings and errors by severity', () => {
    const warning = makeDiagnostic({ severity: 'warning' });
    const error = makeDiagnostic({ severity: 'error' });

    expect(summarizeDiagnostics([])).toEqual({ errors: 0, warnings: 0 });
    expect(summarizeDiagnostics([warning, error, warning])).toEqual({ errors: 1, warnings: 2 });
  });

  it('formats a diagram diagnostic with its source location and renderer', () => {
    expect(
      formatDiagnostic(
        makeDiagnostic({
          line: 12,
          column: 4,
          renderer: 'mermaid',
          message: 'Parse error: unexpected token',
        }),
      ),
    ).toBe('plan.md:12:4: mermaid error: Parse error: unexpected token');
  });

  it('uses column one when only a line is available and preserves multiline messages', () => {
    expect(
      formatDiagnostic(
        makeDiagnostic({ line: 8, renderer: 'wiremark', message: 'unknown component\nUnknown' }),
      ),
    ).toBe('plan.md:8:1: wiremark error: unknown component\nUnknown');
  });

  it('formats a document diagnostic without adding a renderer label', () => {
    expect(
      formatDiagnostic(
        makeDiagnostic({
          scope: 'document',
          code: 'document.compile',
          sourceFile: 'plan.md',
          message: 'Markdown render failed',
        }),
      ),
    ).toBe('plan.md: error: Markdown render failed');
  });

  it('converts a DiagnosticError while retaining its coordinates', () => {
    const error = new DiagnosticError('renderer failed', {
      sourceFile: 'actual.md',
      line: 4,
      column: 7,
    });

    expect(
      diagnosticFromError(error, {
        severity: 'error',
        code: 'document.compile',
        scope: 'document',
        sourceFile: 'fallback.md',
      }),
    ).toEqual({
      severity: 'error',
      code: 'document.compile',
      scope: 'document',
      sourceFile: 'actual.md',
      line: 4,
      column: 7,
      message: 'renderer failed',
    });
  });
});

function makeDiagnostic(overrides: Partial<BlueprintDiagnostic> = {}): BlueprintDiagnostic {
  return {
    severity: 'error',
    code: 'diagram.render',
    scope: 'diagram',
    sourceFile: 'plan.md',
    message: 'failed',
    ...overrides,
  };
}
