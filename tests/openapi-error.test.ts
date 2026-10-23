import { describe, expect, it } from 'vitest';

import { OpenApiError } from '../src/renderers/openapi-error.js';

describe('OpenApiError', () => {
  it('retains pointer and source-local coordinates', () => {
    const error = new OpenApiError('bad field', {
      pointer: '#/info/title',
      line: 4,
      column: 8,
    });

    expect(error).toMatchObject({
      name: 'OpenApiError',
      message: 'bad field',
      pointer: '#/info/title',
      line: 4,
      column: 8,
    });
  });
});
