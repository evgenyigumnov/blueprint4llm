import { describe, expect, it } from 'vitest';

import { DiagnosticError, toDiagnosticError } from '../src/errors.js';

describe('diagnostics', () => {
  it('formats a path and source position', () => {
    expect(
      new DiagnosticError('broken diagram', {
        sourceFile: 'blueprint.md',
        line: 7,
        column: 3,
      }).format(),
    ).toBe('blueprint.md:7:3: broken diagram');
    expect(new DiagnosticError('cannot read', { sourceFile: 'blueprint.md' }).format()).toBe(
      'blueprint.md: cannot read',
    );
    expect(new DiagnosticError('unknown').format()).toBe('unknown');
  });

  it('preserves an existing diagnostic error', () => {
    const original = new DiagnosticError('bad input', { sourceFile: 'input.md', line: 2 });
    expect(toDiagnosticError(original, 'fallback', { sourceFile: 'other.md' })).toBe(original);
  });

  it('normalizes errors and extracts nested source positions', () => {
    const cause = Object.assign(new Error('renderer failed'), {
      position: { start: { line: 4, column: 9 } },
    });
    const diagnostic = toDiagnosticError(cause, 'fallback', { sourceFile: 'input.md' });
    expect(diagnostic).toMatchObject({
      message: 'renderer failed',
      sourceFile: 'input.md',
      line: 4,
      column: 9,
      cause,
    });
    expect(toDiagnosticError('bad', 'fallback').message).toBe('bad');
    expect(toDiagnosticError(new Error(''), 'fallback').message).toBe('fallback');
    expect(toDiagnosticError(Object.assign(new Error('x'), { line: 8 }), 'fallback')).toMatchObject(
      {
        line: 8,
        column: 1,
      },
    );
  });
});
