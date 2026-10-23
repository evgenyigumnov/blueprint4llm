import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { renderDiagramImage } from '../src/image-export.js';

const fence = String.fromCharCode(96, 96, 96);
const source = 'direction: right\nclient -> service: создать заказ';

describe('D2 compiler integration', () => {
  it('compiles and checks D2 through the shared Markdown pipeline and cache', async () => {
    const cache = new DiagramRenderCache();
    const markdown = `# D2 preview\n\n${fence}d2\n${source}\n${fence}`;
    const compiled = await compileMarkdown(markdown, {
      sourceFile: '/tmp/d2-preview.md',
      diagramCache: cache,
    });
    const checked = await checkMarkdown(markdown, {
      sourceFile: '/tmp/d2-preview.md',
      diagramCache: cache,
    });

    expect(compiled.html).toContain('class="bp-diagram bp-diagram--d2"');
    expect(compiled.html).toContain("font-family: 'Noto Sans'");
    expect(compiled.html).toContain('data:font/ttf;base64,');
    expect(compiled.html).toContain('создать заказ');
    expect(compiled.errors).toEqual([]);
    expect(checked.errors).toEqual([]);
    expect(cache.size).toBe(1);
  });

  it('scopes repeated cached SVG styles and IDs to each Markdown block', async () => {
    const cache = new DiagramRenderCache();
    const block = `${fence}d2\n${source}\n${fence}`;
    const compiled = await compileMarkdown(`${block}\n\n${block}`, {
      sourceFile: '/tmp/d2-repeated.md',
      diagramCache: cache,
    });

    expect(compiled.html).toContain('bp-d2-bp-diagram-001');
    expect(compiled.html).toContain('bp-d2-bp-diagram-002');
    expect(compiled.html).toContain('id="bp-diagram-001-');
    expect(compiled.html).toContain('id="bp-diagram-002-');
    expect(cache.size).toBe(1);
  });

  it('maps D2 parser locations to Markdown inside a block quote and leaves errors uncached', async () => {
    const cache = new DiagramRenderCache();
    const markdown = ['> ```d2', '> shape: {', '> ```'].join('\n');
    const checked = await checkMarkdown(markdown, {
      sourceFile: '/tmp/d2-quoted.md',
      diagramCache: cache,
    });

    expect(checked.errors).toHaveLength(1);
    expect(checked.diagnostics?.[0]).toMatchObject({
      sourceFile: '/tmp/d2-quoted.md',
      line: 2,
      renderer: 'd2',
    });
    expect(cache.size).toBe(0);
  });

  it('exports D2 as a standalone SVG with explicit dimensions', async () => {
    const compiled = await compileMarkdown(`${fence}d2\n${source}\n${fence}`, {
      sourceFile: '/tmp/d2-export.md',
    });
    const svg = await renderDiagramImage(compiled.html, 'svg');

    expect(typeof svg).toBe('string');
    expect(svg).toMatch(/<svg[^>]*width="[1-9]\d*"[^>]*height="[1-9]\d*"/);
    expect(svg).toContain('создать заказ');
    expect(svg).not.toContain('data:application/font-woff');
  });

  it('rasterizes D2 with the same embedded local font used by the HTML page', async () => {
    const compiled = await compileMarkdown(`${fence}d2\n${source}\n${fence}`, {
      sourceFile: '/tmp/d2-raster-export.md',
    });
    const png = await renderDiagramImage(compiled.html, 'png');

    expect(Buffer.from(png as Uint8Array).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }, 60_000);
});
