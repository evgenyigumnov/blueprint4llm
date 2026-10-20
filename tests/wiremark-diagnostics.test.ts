import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wiremark/core', () => ({ render: vi.fn() }));

import { render } from '@wiremark/core';

import { wiremarkRenderer } from '../src/renderers/wiremark.js';

describe('Wiremark renderer diagnostics', () => {
  beforeEach(() => {
    vi.mocked(render).mockReset();
  });

  it('preserves non-fatal errors with their local line and column while returning the SVG', async () => {
    vi.mocked(render).mockReturnValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      diagnostics: [
        { severity: 'error', message: 'background target is missing', loc: { line: 3, col: 5 } },
      ],
    });

    const result = await wiremarkRenderer.render('Wireframe mobile', {
      diagramId: 'bp-diagram-001',
      sourceFile: 'wireframe.md',
      line: 10,
    });

    expect(result.svg).toContain('<svg');
    expect(result.errors).toEqual([
      { message: 'background target is missing', line: 3, column: 5 },
    ]);
    expect(result.warnings).toEqual([]);
  });
});
