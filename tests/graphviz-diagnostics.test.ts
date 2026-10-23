import { describe, expect, it } from 'vitest';

import {
  GraphvizRenderError,
  readGraphvizLocation,
  readGraphvizResult,
} from '../src/renderers/graphviz-diagnostics.js';
import type { GraphvizRenderOutput } from '../src/renderers/graphviz-worker-protocol.js';

describe('Graphviz diagnostics', () => {
  it('retains warnings and extracts a line when available', () => {
    const result = readGraphvizResult({
      status: 'success',
      output: '<svg/>',
      errors: [
        { message: 'Warning: unknown attribute on line 3, column 8', level: 'warning' },
        { message: 'Warning: another message' },
      ],
    });

    expect(result).toEqual({
      svg: '<svg/>',
      warnings: [
        {
          message: 'Warning: unknown attribute on line 3, column 8',
          line: 3,
          column: 8,
        },
        { message: 'Warning: another message' },
      ],
    });
  });

  it('filters Viz.js Unicode width fallback warnings but retains other warnings', () => {
    const result = readGraphvizResult({
      status: 'success',
      output: '<svg/>',
      errors: [
        {
          message:
            'Warning: no value for width of non-ASCII character 208. Falling back to width of space character',
          level: 'warning',
        },
        { message: 'Warning: unknown attribute on line 3', level: 'warning' },
      ],
    });

    expect(result.warnings).toEqual([{ message: 'Warning: unknown attribute on line 3', line: 3 }]);
  });

  it('throws a located error for failed or error-level renders', () => {
    const failures: GraphvizRenderOutput[] = [
      {
        status: 'failure',
        output: undefined,
        errors: [{ message: "syntax error in line 2 near '}'", level: 'error' }],
      },
      {
        status: 'success',
        output: '<svg/>',
        errors: [{ message: 'layout library is unavailable', level: 'error' }],
      },
    ];

    expect(() => readGraphvizResult(failures[0]!)).toThrowError(
      expect.objectContaining({
        name: 'GraphvizRenderError',
        message: "Graphviz render failed: syntax error in line 2 near '}'",
        line: 2,
      }),
    );
    expect(() => readGraphvizResult(failures[1]!)).toThrow(GraphvizRenderError);
  });

  it('rejects missing SVG output even when the API reports success', () => {
    expect(() => readGraphvizResult({ status: 'success', output: undefined, errors: [] })).toThrow(
      'no SVG output',
    );
  });

  it('reads line and column only when Graphviz provides them', () => {
    expect(readGraphvizLocation('syntax error on line 5, column 9')).toEqual({
      line: 5,
      column: 9,
    });
    expect(readGraphvizLocation('Warning: layout adjusted')).toEqual({});
  });
});
