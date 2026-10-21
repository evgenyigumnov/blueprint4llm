import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { PencilJsonError } from '../src/renderers/pencil-json-error.js';
import { pencilRenderer } from '../src/renderers/pencil.js';
import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';

const document = {
  version: '2.21',
  children: [
    {
      id: 'card',
      type: 'frame',
      x: -24,
      y: 8,
      width: 180,
      height: 120,
      layout: 'none',
      clip: true,
      cornerRadius: 10,
      fill: '#FFFFFF',
      stroke: '#CBD5E1',
      strokeWidth: 1,
      children: [
        {
          id: 'button',
          type: 'rectangle',
          x: 8,
          y: 8,
          width: 80,
          height: 32,
          cornerRadius: [8, 4, 8, 4],
          fill: { type: 'color', color: '#315DEB' },
          rotation: 4,
        },
        {
          id: 'avatar',
          type: 'ellipse',
          x: 104,
          y: 8,
          width: 40,
          height: 40,
          fill: '#F59E0B',
          stroke: '#92400E',
          strokeWidth: 2,
          opacity: 0.8,
        },
        {
          id: 'badge',
          type: 'polygon',
          x: 8,
          y: 54,
          width: 32,
          height: 32,
          polygonCount: 5,
          fill: '#22C55E',
        },
        {
          id: 'small-square',
          type: 'rectangle',
          x: 88,
          y: 54,
          width: 10,
          height: 10,
          fill: '#0EA5E9',
        },
        {
          id: 'hidden-shape',
          type: 'rectangle',
          x: 108,
          y: 54,
          width: 12,
          height: 12,
          fill: { type: 'color', color: '#F00', enabled: false },
        },
        {
          id: 'check',
          type: 'path',
          x: 52,
          y: 54,
          width: 24,
          height: 24,
          geometry: 'M0 12 L8 20 L24 2',
          viewBox: [0, 0, 24, 24],
          fillRule: 'evenodd',
          fill: 'none',
          stroke: '#111827',
          strokeWidth: 3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        {
          id: 'caption',
          type: 'text',
          x: 8,
          y: 92,
          width: 120,
          height: 20,
          content: 'Safe <title> & wrapped copy',
          textGrowth: 'fixed-width',
          textAlign: 'left',
          fontFamily: 'Arial',
          fontSize: 12,
          fontWeight: 600,
          fill: '#202124',
          underline: true,
        },
      ],
    },
  ],
};

describe('Pencil renderer', () => {
  it('renders supported shapes, text, styling, negative coordinates, rotation, and clipping', async () => {
    const result = await pencilRenderer.render(JSON.stringify(document), {
      diagramId: 'bp-diagram-001',
      sourceFile: 'pencil.md',
      line: 1,
    });
    const svg = parseAndValidateSvg(result.svg);

    expect(result.svg).toContain('viewBox="-25.5 6.5');
    expect(result.svg).toContain('<rect');
    expect(result.svg).toContain('<ellipse');
    expect(result.svg).toContain('<polygon points=');
    expect(result.svg).toContain('fill-rule="evenodd"');
    expect(result.svg).toContain('stroke-linecap="round"');
    expect(result.svg).toContain('rotate(-4');
    expect(result.svg).toContain('clipPath');
    expect(result.svg).toContain('clip-path="url(#pencil-clip-1)"');
    expect(result.svg).toContain('text-decoration="underline"');
    expect(result.svg).toContain('Safe &lt;title&gt; &amp;</tspan><tspan');
    expect(result.svg).toContain('>wrapped copy</tspan>');
    expect(result.svg).toContain('fill="none" stroke="none"');
    expect(result.svg).not.toContain('<title> & wrapped');
    expect(svg.tagName).toBe('svg');
  });

  it('renders both fence names through compile and check with unique clip IDs', async () => {
    const source = JSON.stringify({
      version: '2.21',
      children: [
        {
          id: 'frame',
          type: 'frame',
          width: 20,
          height: 20,
          clip: true,
          children: [{ id: 'box', type: 'rectangle', width: 40, height: 40, fill: '#ABCDEF' }],
        },
      ],
    });
    const fence = '```';
    const markdown = `${fence}pencil\n${source}\n${fence}\n\n${fence}pen\n${source}\n${fence}`;
    const compiled = await compileMarkdown(markdown, { sourceFile: 'pencil.md' });
    const checked = await checkMarkdown(markdown, { sourceFile: 'pencil.md' });

    expect(compiled.html.match(/class="bp-diagram bp-diagram--pencil"/g)).toHaveLength(2);
    expect(compiled.html).toContain('bp-diagram-001-pencil-clip-1');
    expect(compiled.html).toContain('bp-diagram-002-pencil-clip-1');
    expect(compiled.html).toContain('clip-path="url(#bp-diagram-001-pencil-clip-1)"');
    expect(compiled.html).toContain('clip-path="url(#bp-diagram-002-pencil-clip-1)"');
    expect(compiled.html).not.toMatch(/language-(pencil|pen)/);
    expect(compiled.errors).toEqual([]);
    expect(checked).toEqual({ warnings: [], errors: [] });
  });

  it('maps JSONC errors to the Markdown file and source line', async () => {
    const fence = '```';
    const markdown = `# Pencil\n\n${fence}pencil\n{\n  "version": "2.21",\n  "children": [{"id":"box","type":"rectangle","opacity":2}]\n}\n${fence}`;

    await expect(
      checkMarkdown(markdown, { sourceFile: 'invalid-pencil.md' }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'invalid-pencil.md',
      line: 6,
      message: expect.stringContaining('pencil render failed: Pencil node "box" opacity'),
    });
  });

  it.each([
    ['imports', { imports: {} }, 'unsupported property "imports"'],
    ['variables', { variables: {} }, 'unsupported property "variables"'],
    ['references', { type: 'ref', ref: 'component' }, 'unsupported type "ref"'],
    ['scripts', { type: 'script' }, 'unsupported type "script"'],
    [
      'external images',
      { fill: { type: 'image', url: 'https://example.test/a.png' } },
      'solid color paints',
    ],
    ['shader fills', { fill: { type: 'shader', url: 'effect.glsl' } }, 'solid color paints'],
    ['effects', { effect: [{ type: 'shadow' }] }, 'unsupported property "effect"'],
  ])('rejects unsupported Pencil %s with a diagnostic', async (_name, property, expected) => {
    const value = {
      version: '2.21',
      children: [{ id: 'unsupported', type: 'rectangle', width: 20, height: 20, ...property }],
      ...('imports' in property || 'variables' in property ? property : {}),
    };

    await expect(
      pencilRenderer.render(JSON.stringify(value), {
        diagramId: 'bp-diagram-001',
        sourceFile: 'unsupported.md',
        line: 1,
      }),
    ).rejects.toThrow(expected);
  });

  it('does not perform network requests', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const fence = '```';
      const compiled = await compileMarkdown(
        `${fence}pencil\n${JSON.stringify(document)}\n${fence}`,
        {
          sourceFile: 'offline-pencil.md',
        },
      );
      expect(compiled.html).toContain('bp-diagram--pencil');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('compiles the documented Pencil example', async () => {
    const markdown = await readFile(
      new URL('../examples/blueprint-pencil.md', import.meta.url),
      'utf8',
    );
    const compiled = await compileMarkdown(markdown, { sourceFile: 'blueprint-pencil.md' });

    expect(compiled.html).toContain('bp-diagram--pencil');
    expect(compiled.html).toContain('Профиль');
    expect(compiled.errors).toEqual([]);
  });

  it('rejects text that renders beyond the line limit', async () => {
    const source = JSON.stringify({
      version: '2.21',
      children: [
        {
          id: 'long-text',
          type: 'text',
          width: 100,
          height: 20,
          content: '\n'.repeat(10_000),
        },
      ],
    });

    await expect(
      pencilRenderer.render(source, {
        diagramId: 'bp-diagram-001',
        sourceFile: 'large-text.md',
        line: 1,
      }),
    ).rejects.toThrow('Pencil text node "long-text" exceeds 10000 lines');
  });

  it('rejects an SVG above the renderer output limit', async () => {
    const source = JSON.stringify({
      version: '2.21',
      children: [
        {
          id: 'large-text',
          type: 'text',
          width: 10,
          height: 20,
          content: "'".repeat(700_000),
        },
      ],
    });

    await expect(
      pencilRenderer.render(source, {
        diagramId: 'bp-diagram-001',
        sourceFile: 'large-svg.md',
        line: 1,
      }),
    ).rejects.toThrow('Pencil SVG is too large');
  });

  it('preserves JSON parser source locations on renderer errors', async () => {
    const source = '{\n "version": "2.21",\n "children": [\n';
    try {
      await pencilRenderer.render(source, {
        diagramId: 'bp-diagram-001',
        sourceFile: 'broken.md',
        line: 1,
      });
      expect.fail('Expected invalid JSONC to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PencilJsonError);
      expect(error).toMatchObject({ line: 4, column: 1 });
    }
  });
});
