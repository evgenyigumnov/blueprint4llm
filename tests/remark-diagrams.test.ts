import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { DiagnosticError } from '../src/errors.js';
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
      requireSingleDiagram: true,
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

  it.each([
    { markdown: '# Text only', count: 0 },
    { markdown: '```test-diagram\na\n```\n\n```test-diagram\nb\n```', count: 2 },
  ])(
    'requires one supported diagram before rendering (found $count)',
    async ({ markdown, count }) => {
      const tree = unified().use(remarkParse).parse(markdown);
      const renderer: DiagramRenderer = {
        name: 'test-renderer',
        languages: ['test-diagram'],
        cacheKey: 'test-renderer-v1',
        async render() {
          throw new Error('the renderer must not run when the count is invalid');
        },
      };

      await expect(
        remarkDiagramPlugin({
          renderers: [renderer],
          sourceFile: 'diagram.md',
          warnings: [],
          errors: [],
          requireSingleDiagram: true,
        })(tree),
      ).rejects.toMatchObject({
        name: 'DiagnosticError',
        sourceFile: 'diagram.md',
        message: `single-diagram export requires exactly one supported diagram block; found ${count}`,
      } satisfies Partial<DiagnosticError>);
    },
  );
});
