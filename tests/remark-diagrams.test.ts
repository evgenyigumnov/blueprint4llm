import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { remarkDiagramPlugin } from '../src/plugins/remark-diagrams.js';
import type { DiagramRenderer } from '../src/renderers/types.js';

describe('remarkDiagramPlugin non-fatal errors', () => {
  it('keeps the rendered SVG and reports renderer errors at the Markdown source line', async () => {
    const markdown = '# Demo\n\n```test-diagram\nfirst line\ninvalid token\n```';
    const tree = unified().use(remarkParse).parse(markdown);
    const warnings: string[] = [];
    const errors: string[] = [];
    const renderer: DiagramRenderer = {
      name: 'test-renderer',
      languages: ['test-diagram'],
      cacheKey: 'test-renderer-v1',
      async render() {
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>rendered</text></svg>',
          warnings: [],
          errors: [
            { message: 'unexpected token', line: 2, column: 4 },
            { message: 'unexpected end of input', line: 3 },
          ],
        };
      },
    };

    await remarkDiagramPlugin({
      renderers: [renderer],
      sourceFile: 'diagram.md',
      warnings,
      errors,
    })(tree);

    const diagram = tree.children.find((node) => node.type === 'code');
    expect(diagram?.data).toMatchObject({
      hName: 'figure',
      hChildren: [{ tagName: 'svg' }],
    });
    expect(errors).toEqual([
      'diagram.md:5:4: test-renderer error: unexpected token',
      'diagram.md:5:1: test-renderer error: unexpected end of input',
    ]);
    expect(warnings).toEqual([]);
  });
});
