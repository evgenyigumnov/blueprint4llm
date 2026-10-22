import { describe, expect, it } from 'vitest';

import { renderDiagramImage } from '../src/image-export.js';

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
