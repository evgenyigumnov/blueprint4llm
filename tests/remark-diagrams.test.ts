import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import type { BlueprintDiagnostic } from '../src/diagnostics.js';
import { DiagnosticError } from '../src/errors.js';
import { remarkDiagramPlugin } from '../src/plugins/remark-diagrams.js';
import type { DiagramRenderer } from '../src/renderers/types.js';

describe('remarkDiagramPlugin non-fatal errors', () => {
  it('keeps the rendered SVG and reports renderer errors at the Markdown source line', async () => {
    const markdown = '# Demo\n\n```test-diagram\nfirst line\ninvalid token\n```';
    const tree = unified().use(remarkParse).parse(markdown);
    const warnings: string[] = [];
    const errors: string[] = [];
    const diagnostics: BlueprintDiagnostic[] = [];
    const renderer: DiagramRenderer = {
      name: 'test-renderer',
      languages: ['test-diagram'],
      cacheKey: 'test-renderer-v1',
      async render() {
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>rendered</text></svg>',
          warnings: [{ message: 'fallback used', line: 1 }],
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
      diagnostics,
      requireSingleDiagram: true,
    })(tree);

    const diagram = tree.children.find((node) => node.type === 'code');
    expect(diagram?.data).toMatchObject({
      hName: 'div',
      hChildren: [
        { tagName: 'figure', children: [{ tagName: 'svg' }] },
        { tagName: 'section' },
        { tagName: 'section' },
        { tagName: 'section' },
      ],
    });
    expect(errors).toEqual([
      'diagram.md:5:4: test-renderer error: unexpected token',
      'diagram.md:5:1: test-renderer error: unexpected end of input',
    ]);
    expect(warnings).toEqual(['diagram.md:4:1: test-renderer warning: fallback used']);
    expect(diagnostics).toMatchObject([
      { severity: 'warning', line: 4, column: 1, message: 'fallback used' },
      { line: 5, column: 4, diagramId: 'bp-diagram-001', message: 'unexpected token' },
      { line: 5, column: 1, diagramId: 'bp-diagram-001', message: 'unexpected end of input' },
    ]);
  });

  it('rejects unsafe SVG locally and continues to the next supported block', async () => {
    const tree = unified()
      .use(remarkParse)
      .parse('```unsafe-diagram\nunsafe\n```\n\n```safe-diagram\nsafe\n```');
    const errors: string[] = [];
    const diagnostics: BlueprintDiagnostic[] = [];
    const unsafeRenderer: DiagramRenderer = {
      name: 'unsafe-test',
      languages: ['unsafe-diagram'],
      cacheKey: 'unsafe-test-v1',
      async render() {
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          warnings: [],
        };
      },
    };
    const safeRenderer: DiagramRenderer = {
      name: 'safe-test',
      languages: ['safe-diagram'],
      cacheKey: 'safe-test-v1',
      async render() {
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>safe</text></svg>',
          warnings: [],
        };
      },
    };

    await remarkDiagramPlugin({
      renderers: [unsafeRenderer, safeRenderer],
      sourceFile: 'unsafe.md',
      warnings: [],
      errors,
      diagnostics,
    })(tree);

    const blocks = tree.children.filter((node) => node.type === 'code');
    expect(blocks[0]?.data?.hName).toBe('div');
    expect(blocks[0]?.data?.hProperties).toMatchObject({
      className: ['bp-diagnostic-container'],
    });
    expect(blocks[0]?.data?.hChildren).not.toContainEqual(
      expect.objectContaining({ tagName: 'script' }),
    );
    expect(blocks[1]?.data?.hName).toBe('figure');
    expect(diagnostics).toMatchObject([
      { code: 'diagram.svg', diagramId: 'bp-diagram-001', renderer: 'unsafe-test' },
    ]);
    expect(errors[0]).toContain('unsafe or invalid SVG');
  });

  it('continues after a thrown renderer error and preserves later blocks', async () => {
    const tree = unified()
      .use(remarkParse)
      .parse('```test-diagram\nfirst\ninvalid\n```\n\n```test-diagram\nsecond\n```');
    const errors: string[] = [];
    const diagnostics: BlueprintDiagnostic[] = [];
    const renderer: DiagramRenderer = {
      name: 'test-renderer',
      languages: ['test-diagram'],
      cacheKey: 'test-renderer-v1',
      async render(source) {
        if (source.includes('first')) {
          throw Object.assign(new Error('unexpected token'), { line: 2, column: 5 });
        }
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>later</text></svg>',
          warnings: [],
        };
      },
    };

    await remarkDiagramPlugin({
      renderers: [renderer],
      sourceFile: 'continued.md',
      warnings: [],
      errors,
      diagnostics,
    })(tree);

    const blocks = tree.children.filter((node) => node.type === 'code');
    expect(blocks[0]?.data?.hName).toBe('div');
    expect(blocks[1]?.data?.hName).toBe('figure');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('continued.md:3:5: test-renderer render failed: unexpected token');
    expect(diagnostics).toMatchObject([
      {
        line: 3,
        column: 5,
        diagramId: 'bp-diagram-001',
        message: 'test-renderer render failed: unexpected token',
      },
    ]);
  });

  it('preserves AbortSignal cancellation instead of turning it into a diagnostic', async () => {
    const controller = new AbortController();
    const abortError = new Error('preview source changed');
    const tree = unified().use(remarkParse).parse('```test-diagram\nsource\n```');
    const renderer: DiagramRenderer = {
      name: 'test-renderer',
      languages: ['test-diagram'],
      cacheKey: 'test-renderer-v1',
      async render() {
        controller.abort(abortError);
        throw abortError;
      },
    };

    await expect(
      remarkDiagramPlugin({
        renderers: [renderer],
        sourceFile: 'aborted.md',
        warnings: [],
        errors: [],
        signal: controller.signal,
      })(tree),
    ).rejects.toBe(abortError);
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
