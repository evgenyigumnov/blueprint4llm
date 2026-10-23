import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { excalidrawRenderer } from '../src/renderers/excalidraw.js';

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/excalidraw/${name}`, import.meta.url), 'utf8');

describe('Excalidraw renderer integration', () => {
  it('renders and checks the documented example through the shared compiler pipeline', async () => {
    const markdown = await readFile(
      new URL('../examples/blueprint-excalidraw.md', import.meta.url),
      'utf8',
    );
    const compiled = await compileMarkdown(markdown, { sourceFile: 'example.md' });
    const checked = await checkMarkdown(markdown, { sourceFile: 'example.md' });

    expect(compiled.html).toContain('class="bp-diagram bp-diagram--excalidraw"');
    expect(compiled.html).toContain('data-element-id="plan-card"');
    expect(compiled.html).toContain('data-element-id="launch-card"');
    expect(compiled.warnings).toEqual([]);
    expect(compiled.errors).toEqual([]);
    expect(checked).toMatchObject({ warnings: [], errors: [] });
  });

  it('keeps separate identical blocks in array order and uses per-block SVG IDs', async () => {
    const source = await fixture('architectural-scene-v2.excalidraw');
    const fence = `\`\`\`excalidraw\n${source}\n\`\`\``;
    const markdown = `${fence}\n\n${fence}`;
    const compiled = await compileMarkdown(markdown, { sourceFile: 'two-scenes.md' });

    expect(compiled.html.match(/class="bp-diagram bp-diagram--excalidraw"/g)).toHaveLength(2);
    expect(compiled.html).toContain('data-diagram-id="bp-diagram-001"');
    expect(compiled.html).toContain('data-diagram-id="bp-diagram-002"');
    expect(compiled.html.match(/data-element-id="client"/g)).toHaveLength(2);
    expect(compiled.errors).toEqual([]);
    expect(compiled.warnings).toEqual([]);
  });

  it('maps JSON field errors into Markdown coordinates and reports placeholders as warnings', async () => {
    const bad = '{\n  "type": "excalidraw",\n  "version": 1,\n  "elements": []\n}';
    const result = await checkMarkdown(`## Bad scene\n\n\`\`\`excalidraw\n${bad}\n\`\`\``, {
      sourceFile: 'invalid.md',
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('invalid.md:6:14: excalidraw render failed');
    expect(result.errors[0]).toContain('at version');

    const unsupported = await checkMarkdown(
      `\`\`\`excalidraw\n${await fixture('unsupported-scene-v2.excalidraw')}\n\`\`\``,
      { sourceFile: 'unsupported.md' },
    );
    expect(unsupported.errors).toEqual([]);
    expect(unsupported.warnings.length).toBeGreaterThan(3);
    expect(unsupported.warnings.some((warning) => warning.includes('placeholder'))).toBe(true);
  });

  it('stores source-local warning locations in the cache so moved fences map to the new line', async () => {
    const source = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [{ id: 'box', type: 'rectangle', x: 0, y: 0, width: 20, height: 10, roughness: 1 }],
    });
    const cache = new DiagramRenderCache();
    const first = await checkMarkdown(`\`\`\`excalidraw\n${source}\n\`\`\``, {
      sourceFile: 'cached.md',
      diagramCache: cache,
    });
    const second = await checkMarkdown(`# Title\n\n\`\`\`excalidraw\n${source}\n\`\`\``, {
      sourceFile: 'cached.md',
      diagramCache: cache,
    });

    expect(first.warnings[0]).toContain('cached.md:2:');
    expect(second.warnings[0]).toContain('cached.md:4:');
    expect(cache.size).toBe(1);
  });

  it('checks cancellation before parsing and exposes the source limit and versioned cache identity', async () => {
    const controller = new AbortController();
    const reason = new Error('preview replaced');
    controller.abort(reason);

    await expect(
      excalidrawRenderer.render('not JSON', {
        diagramId: 'bp-diagram-001',
        sourceFile: 'abort.md',
        line: 1,
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(excalidrawRenderer.maxSourceBytes).toBe(1024 * 1024);
    expect(excalidrawRenderer.cacheKey).toContain('geometry-v1;text-v1;styles-v1');
  });
});
