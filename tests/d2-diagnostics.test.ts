import { describe, expect, it } from 'vitest';

import { D2Error } from '../src/renderers/d2-error.js';
import { toD2Error } from '../src/renderers/d2-diagnostics.js';

describe('D2 diagnostics', () => {
  it('reads zero-based positions from the D2 AST range', () => {
    const error = toD2Error(
      new Error(
        JSON.stringify([
          { range: 'index.d2,2:4:18-2:8:22', errmsg: 'index.d2:3:5: invalid syntax' },
        ]),
      ),
    );

    expect(error).toMatchObject({ line: 3, column: 5, message: 'invalid syntax' });
  });

  it('preserves multiple messages and falls back to the engine position', () => {
    const error = toD2Error(
      new Error(
        JSON.stringify([
          { errmsg: 'index.d2:4:7: first problem' },
          { errmsg: 'index.d2:8:2: second problem' },
        ]),
      ),
    );

    expect(error).toMatchObject({
      line: 4,
      column: 7,
      message: 'first problem\nsecond problem',
    });
  });

  it('keeps ordinary worker errors and existing D2 errors', () => {
    const native = new Error('index.d2:6:3: worker failed');
    const parsed = toD2Error(native);
    const existing = new D2Error('unsupported feature', { line: 2, column: 4 });

    expect(parsed).toMatchObject({ line: 6, column: 3, message: 'worker failed' });
    expect(toD2Error(existing)).toBe(existing);
  });
});
