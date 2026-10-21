import { describe, expect, it } from 'vitest';

import { parseDrawioJson } from '../src/renderers/drawio-json.js';
import { renderDrawioSvg } from '../src/renderers/drawio-svg.js';
import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';

describe('renderDrawioSvg', () => {
  it('renders a safe SVG with nodes, groups, arrows, and edge labels', () => {
    const graph = parseDrawioJson(
      JSON.stringify({
        version: '26.0',
        pages: [
          {
            id: 'page-1',
            name: 'Release <flow>',
            cells: [
              { id: 'layer', type: 'layer' },
              { id: 'group', type: 'group', parent: 'layer', label: 'Build & test' },
              { id: 'start', type: 'node', parent: 'group', label: 'Start' },
              { id: 'finish', type: 'node', parent: 'layer', label: 'Finish' },
              {
                id: 'edge',
                type: 'edge',
                parent: 'layer',
                source: 'start',
                target: 'finish',
                label: 'deploy <now>',
              },
            ],
          },
        ],
      }),
    );

    const svg = renderDrawioSvg(graph);
    expect(() => parseAndValidateSvg(svg)).not.toThrow();
    expect(svg).toContain('class="drawio-group"');
    expect(svg).toContain('class="drawio-node"');
    expect(svg).toContain('marker-end="url(#drawio-arrow)"');
    expect(svg).toContain('deploy &lt;now&gt;');
    expect(svg).toContain('Release &lt;flow&gt;');
  });

  it('escapes markup, quotes, ampersands, and invalid XML characters in labels', () => {
    const graph = parseDrawioJson(
      JSON.stringify({
        version: '26.0',
        pages: [
          {
            id: 'page-1',
            name: 'Safe',
            cells: [
              { id: 'layer', type: 'layer' },
              {
                id: 'node',
                type: 'node',
                parent: 'layer',
                label: '</text><script>url(https://evil.example) "&\u0001',
              },
            ],
          },
        ],
      }),
    );
    const svg = renderDrawioSvg(graph);

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/text&gt;&lt;script&gt;url(https://evil.example) &quot;&amp;�');
    expect(svg).not.toContain('href="https://evil.example"');
    expect(() => parseAndValidateSvg(svg)).not.toThrow();
  });

  it('wraps long edge labels and keeps labels as SVG text', () => {
    const graph = parseDrawioJson(
      JSON.stringify({
        version: '26.0',
        pages: [
          {
            id: 'page-1',
            name: 'Safe',
            cells: [
              { id: 'layer', type: 'layer' },
              { id: 'a', type: 'node', parent: 'layer', label: 'A' },
              { id: 'b', type: 'node', parent: 'layer', label: 'B' },
              {
                id: 'edge',
                type: 'edge',
                parent: 'layer',
                source: 'a',
                target: 'b',
                label: 'long label '.repeat(9),
              },
            ],
          },
        ],
      }),
    );
    const svg = renderDrawioSvg(graph);

    expect(svg.match(/<tspan/g)?.length).toBeGreaterThan(2);
    expect(() => parseAndValidateSvg(svg)).not.toThrow();
  });
});
