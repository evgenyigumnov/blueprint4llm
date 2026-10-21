import type { Element } from 'hast';
import { describe, expect, it } from 'vitest';

import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';
import { scopeSvgIds } from '../src/svg/scope-ids.js';

describe('SVG fragments', () => {
  it('parses a single SVG root and rejects fragments without one', () => {
    expect(parseAndValidateSvg('<svg viewBox="0 0 1 1"><rect /></svg>').tagName).toBe('svg');
    expect(() => parseAndValidateSvg('<div>not SVG</div>')).toThrow(/root <svg>/);
    expect(() => parseAndValidateSvg('<svg></svg><svg></svg>')).toThrow(/exactly one/);
  });

  it('rejects active SVG content, event handlers, and external references', () => {
    expect(() => parseAndValidateSvg('<svg><script>alert(1)</script></svg>')).toThrow(
      /forbidden <script>/,
    );
    expect(() => parseAndValidateSvg('<svg><foreignObject /></svg>')).toThrow(
      /forbidden <foreignObject>/,
    );
    expect(() => parseAndValidateSvg('<svg onload="alert(1)"></svg>')).toThrow(/event attribute/);
    expect(() => parseAndValidateSvg('<svg><a href="https://example.test">link</a></svg>')).toThrow(
      /non-fragment href/,
    );
    expect(() => parseAndValidateSvg('<svg><audio /></svg>')).toThrow(/forbidden <audio>/);
    expect(() =>
      parseAndValidateSvg('<svg><style>@import url(https://example.test/a.css)</style></svg>'),
    ).toThrow(/CSS @import/);
    expect(() =>
      parseAndValidateSvg('<svg><rect fill="url(https://example.test/a.svg#paint)"/></svg>'),
    ).toThrow(/non-fragment CSS url/);
    expect(() =>
      parseAndValidateSvg('<svg><style>u\\72l(https://example.test/a.svg#paint)</style></svg>'),
    ).toThrow(/non-fragment CSS url/);
    expect(() =>
      parseAndValidateSvg('<svg><style>@\\69mport url(https://example.test/a.css)</style></svg>'),
    ).toThrow(/CSS @import/);
  });

  it('allows only bounded embedded PNG and JPEG image data', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff]).toString('base64');
    expect(() =>
      parseAndValidateSvg(
        `<svg><image href="data:image/png;base64,${png}"/><image href="data:image/jpeg;base64,${jpeg}"/></svg>`,
      ),
    ).not.toThrow();
    expect(() =>
      parseAndValidateSvg('<svg><image href="data:image/gif;base64,R0lGODlh"/></svg>'),
    ).toThrow(/non-fragment href/);
    expect(() =>
      parseAndValidateSvg('<svg><image href="data:image/png;base64,not-valid"/></svg>'),
    ).toThrow(/non-fragment href/);

    const oversizedPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2 * 1024 * 1024),
    ]).toString('base64');
    expect(() =>
      parseAndValidateSvg(`<svg><image href="data:image/png;base64,${oversizedPng}"/></svg>`),
    ).toThrow(/non-fragment href/);
  });

  it('scopes IDs and updates fragment and url references', () => {
    const svg = parseAndValidateSvg(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><defs>' +
        '<clipPath id="clip"><rect /></clipPath></defs>' +
        '<g clip-path="url(#clip)"><a href="#clip"><rect /></a>' +
        '<use xlink:href="#clip" /></g></svg>',
    );

    scopeSvgIds(svg, 'bp-diagram-002');

    const defs = svg.children.find(
      (node): node is Element => node.type === 'element' && node.tagName === 'defs',
    );
    expect(defs?.children[0]).toMatchObject({
      type: 'element',
      tagName: 'clipPath',
      properties: { id: 'bp-diagram-002-clip' },
      children: [{ type: 'element', tagName: 'rect' }],
    });
    const group = svg.children.find(
      (node): node is Element => node.type === 'element' && node.tagName === 'g',
    );
    expect(group?.properties.clipPath).toBe('url(#bp-diagram-002-clip)');
    expect(group?.children[0]).toMatchObject({
      type: 'element',
      properties: { href: '#bp-diagram-002-clip' },
    });
    expect(group?.children[1]).toMatchObject({
      type: 'element',
      properties: { xLinkHref: '#bp-diagram-002-clip' },
    });
  });

  it('rewrites CSS selectors and references without changing visible SVG text', () => {
    const svg = parseAndValidateSvg(
      '<svg><style>.label#node, g#node { fill: url(#paint); }</style>' +
        '<defs><linearGradient id="paint" /></defs>' +
        '<text id="node">#node</text></svg>',
    );

    scopeSvgIds(svg, 'bp-diagram-003');

    expect(svg.children[0]).toMatchObject({
      type: 'element',
      tagName: 'style',
      children: [
        {
          type: 'text',
          value:
            '.label#bp-diagram-003-node, g#bp-diagram-003-node { fill: url(#bp-diagram-003-paint); }',
        },
      ],
    });
    expect(svg.children[2]).toMatchObject({
      type: 'element',
      properties: { id: 'bp-diagram-003-node' },
      children: [{ type: 'text', value: '#node' }],
    });
  });

  it('makes duplicate source IDs unique while resolving references to the first ID', () => {
    const svg = parseAndValidateSvg(
      '<svg><defs><clipPath id="clip"/><clipPath id="clip"/><clipPath id="clip-2"/></defs>' +
        '<g clip-path="url(#clip)" /></svg>',
    );

    scopeSvgIds(svg, 'bp-diagram-004');

    const defs = svg.children[0];
    expect(defs?.type).toBe('element');
    if (defs?.type !== 'element') {
      throw new Error('expected SVG defs element');
    }
    const ids = defs.children.flatMap((child) =>
      child.type === 'element' && typeof child.properties.id === 'string'
        ? [child.properties.id]
        : [],
    );
    expect(ids).toEqual([
      'bp-diagram-004-clip',
      'bp-diagram-004-clip-2',
      'bp-diagram-004-clip-2-2',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(svg.children[1]).toMatchObject({
      type: 'element',
      properties: { clipPath: 'url(#bp-diagram-004-clip)' },
    });
  });
});
