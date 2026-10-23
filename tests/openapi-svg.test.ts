import { describe, expect, it } from 'vitest';

import { layoutOpenApiDocument } from '../src/renderers/openapi-layout.js';
import { buildOpenApiModel } from '../src/renderers/openapi-model.js';
import { parseOpenApiSource } from '../src/renderers/openapi-source.js';
import { MAX_OPENAPI_SVG_BYTES, renderOpenApiSvg } from '../src/renderers/openapi-svg.js';

function documentFor(source: string) {
  return buildOpenApiModel(parseOpenApiSource(source));
}

describe('OpenAPI SVG', () => {
  it('renders deterministic XML with a title, accessible text, and a complete viewBox', () => {
    const document = documentFor(`
openapi: 3.1.1
info: { title: Orders, version: '1' }
paths:
  /orders:
    get: { responses: { default: { description: ready } } }
`);
    const layout = layoutOpenApiDocument(document);
    const first = renderOpenApiSvg(layout, document.title);
    const second = renderOpenApiSvg(layout, document.title);
    expect(first).toBe(second);
    expect(first).toContain('<title>Orders</title>');
    expect(first).toContain(`viewBox="0 0 ${layout.width} ${layout.height}"`);
    expect(first).toContain('<text ');
    expect(first).toContain('<tspan ');
    expect(first).toContain('GET /orders');
  });

  it('produces identical SVG for YAML and JSON with the same ordered fields', () => {
    const yaml = `openapi: 3.1.1
info: { title: Same, version: '1' }
paths:
  /items:
    get: { responses: { default: { description: ready } } }
`;
    const json =
      '{"openapi":"3.1.1","info":{"title":"Same","version":"1"},"paths":{"/items":{"get":{"responses":{"default":{"description":"ready"}}}}}}';
    const yamlModel = documentFor(yaml);
    const jsonModel = documentFor(json);
    expect(renderOpenApiSvg(layoutOpenApiDocument(yamlModel), yamlModel.title)).toBe(
      renderOpenApiSvg(layoutOpenApiDocument(jsonModel), jsonModel.title),
    );
  });

  it('escapes title and all user text as XML data', () => {
    const description = 'Quotes: & < > " \'';
    const document = documentFor(`
openapi: 3.1.1
info:
  title: "A & B <Orders>"
  version: '1'
paths:
  /orders:
    get:
      description: ${JSON.stringify(description)}
      responses: { default: { description: ok } }
`);
    const svg = renderOpenApiSvg(layoutOpenApiDocument(document), document.title);
    expect(svg).toContain('<title>A &amp; B &lt;Orders&gt;</title>');
    expect(svg).toContain('&amp; &lt; &gt; &quot; &apos;');
    expect(svg).not.toContain('<Orders>');
  });

  it('rejects dimensions outside the supported SVG bounds', () => {
    expect(() =>
      renderOpenApiSvg({ width: 1_201, height: 100, boxes: [], texts: [] }, 'Too wide'),
    ).toThrow('dimensions exceed limits');
    expect(() =>
      renderOpenApiSvg({ width: 100, height: 16_385, boxes: [], texts: [] }, 'Too tall'),
    ).toThrow('dimensions exceed limits');
  });

  it('rejects oversized SVG output', () => {
    expect(() =>
      renderOpenApiSvg(
        {
          width: 100,
          height: 100,
          boxes: [],
          texts: [
            { x: 0, y: 20, fontSize: 12, color: '#000', text: '<'.repeat(MAX_OPENAPI_SVG_BYTES) },
          ],
        },
        'Large',
      ),
    ).toThrow(`limit ${MAX_OPENAPI_SVG_BYTES} bytes`);
  });
});
