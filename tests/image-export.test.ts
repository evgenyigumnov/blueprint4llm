import { describe, expect, it } from 'vitest';

import { renderDiagramImage } from '../src/image-export.js';
import { compileMarkdown } from '../src/compiler.js';

describe('renderDiagramImage', () => {
  it('returns one standalone SVG with explicit dimensions', async () => {
    const html = pageWithDiagram(
      '<svg width="100%" height="100%" viewBox="0 0 240 120"><text x="8" y="24">Ready</text></svg>',
    );

    const svg = await renderDiagramImage(html, 'svg');

    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="240" height="120"');
    expect(svg).toContain('<text x="8" y="24">Ready</text>');
    expect(svg).not.toContain('<html');
  });

  it('exports one Excalidraw scene as standalone SVG, PNG, and JPEG', async () => {
    const markdown = [
      '# Export formats',
      '',
      '```excalidraw',
      JSON.stringify({
        type: 'excalidraw',
        version: 2,
        elements: [
          {
            id: 'api',
            type: 'text',
            x: 0,
            y: 0,
            width: 160,
            height: 28,
            text: 'Exported Excalidraw',
            fontSize: 18,
            fontFamily: 2,
            strokeColor: '#1e1e1e',
          },
        ],
      }),
      '```',
    ].join('\n');
    const compiled = await compileMarkdown(markdown, { sourceFile: 'export.md' });
    const svgResult = await renderDiagramImage(compiled.html, 'svg');
    const png = await renderDiagramImage(compiled.html, 'png');
    const jpeg = await renderDiagramImage(compiled.html, 'jpeg');
    expect(typeof svgResult).toBe('string');
    const svg = svgResult as string;

    expect(svg).toContain('Exported Excalidraw');
    expect(svg).not.toContain('<html');
    expect(Buffer.from(png as Uint8Array).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(Buffer.from(jpeg as Uint8Array).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  }, 60_000);

  it('uses explicit SVG lengths and the viewBox ratio to set standalone dimensions', async () => {
    const html = pageWithDiagram(
      '<svg width="2in" viewBox="0 0 100 50"><rect width="100" height="50"/></svg>',
    );

    const svg = await renderDiagramImage(html, 'svg');

    expect(svg).toContain('width="192"');
    expect(svg).toContain('height="96"');
  });

  it.each([
    { html: '<p>No diagram</p>', count: 0 },
    {
      html:
        pageWithDiagram('<svg viewBox="0 0 10 10"/>') +
        pageWithDiagram('<svg viewBox="0 0 10 10"/>'),
      count: 2,
    },
  ])('rejects $count diagrams', async ({ html, count }) => {
    await expect(renderDiagramImage(html, 'svg')).rejects.toThrow(
      `exactly one rendered diagram; found ${count}`,
    );
  });

  it('rejects SVG output without usable dimensions', async () => {
    await expect(renderDiagramImage(pageWithDiagram('<svg/>'), 'svg')).rejects.toThrow(
      'must define a viewBox or explicit width and height',
    );
    await expect(renderDiagramImage(pageWithDiagram('<svg width="240"/>'), 'svg')).rejects.toThrow(
      'must define a viewBox or explicit width and height',
    );
  });
});

function pageWithDiagram(svg: string): string {
  return `<main><figure class="bp-diagram bp-diagram--test">${svg}</figure></main>`;
}
