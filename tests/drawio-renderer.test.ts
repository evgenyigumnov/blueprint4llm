import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { drawioRenderer } from '../src/renderers/drawio.js';
import type { DiagramRenderer, DiagramRenderContext } from '../src/renderers/types.js';

const graphJson = JSON.stringify({
  version: '26.0',
  pages: [
    {
      id: 'draft',
      name: 'Draft',
      cells: [
        { id: 'draft-layer', type: 'layer' },
        { id: 'ignored', type: 'node', parent: 'draft-layer', label: 'Ignored page' },
      ],
    },
    {
      id: 'release',
      name: 'Release <plan>',
      cells: [
        { id: 'layer', type: 'layer' },
        { id: 'start', type: 'node', parent: 'layer', label: 'Start' },
        { id: 'finish', type: 'node', parent: 'layer', label: 'Finish' },
        {
          id: 'publish',
          type: 'edge',
          parent: 'layer',
          source: 'start',
          target: 'finish',
          label: 'publish',
        },
      ],
    },
  ],
});

describe('draw.io renderer integration', () => {
  it('renders the draw.io alias and selects the requested page and direction', async () => {
    const compiled = await compileMarkdown(
      `\`\`\`draw.io page=release direction=LR\n${graphJson}\n\`\`\``,
      { sourceFile: 'drawio.md' },
    );

    expect(compiled.html).toContain('class="bp-diagram bp-diagram--drawio"');
    expect(compiled.html).toContain('Release');
    expect(compiled.html).toContain('Start');
    expect(compiled.html).toContain('Finish');
    expect(compiled.html).toContain('publish');
    expect(compiled.html).not.toContain('Ignored page');
    expect(compiled.html).not.toContain('language-draw.io');
    expect(compiled.html).toContain('data-diagram-id="bp-diagram-001"');
    expect(compiled.errors).toEqual([]);
  });

  it('reports invalid draw.io input at the fenced block in check mode', async () => {
    await expect(
      checkMarkdown('# Draw.io\n\n```drawio\nnot json\n```', {
        sourceFile: 'invalid-drawio.md',
      }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'invalid-drawio.md',
      line: 3,
      column: 1,
      message: expect.stringContaining('drawio render failed: invalid draw.io JSON'),
    });
  });

  it('caches repeated renders and keeps direction metadata in the cache key', async () => {
    let calls = 0;
    const renderer: DiagramRenderer = {
      ...drawioRenderer,
      async render(source, context) {
        calls += 1;
        return drawioRenderer.render(source, context);
      },
    };
    const cache = new DiagramRenderCache();
    const context: DiagramRenderContext = {
      diagramId: 'bp-diagram-001',
      sourceFile: 'cache.md',
      line: 1,
      metadata: 'page=release direction=TB',
    };

    const first = await cache.render(renderer, graphJson, context);
    const reused = await cache.render(renderer, graphJson, context);
    const horizontal = await cache.render(renderer, graphJson, {
      ...context,
      metadata: 'page=release direction=LR',
    });

    expect(reused.svg).toBe(first.svg);
    expect(horizontal.svg).not.toBe(first.svg);
    expect(calls).toBe(2);
    expect(cache.size).toBe(2);
  });
});
