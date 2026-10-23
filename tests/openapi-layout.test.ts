import { describe, expect, it } from 'vitest';

import {
  layoutOpenApiDocument,
  OPENAPI_LAYOUT_MAX_LINES,
  OPENAPI_SVG_MAX_HEIGHT,
} from '../src/renderers/openapi-layout.js';
import { buildOpenApiModel } from '../src/renderers/openapi-model.js';
import { parseOpenApiSource } from '../src/renderers/openapi-source.js';

function model(description = 'Orders are ready.') {
  return buildOpenApiModel(
    parseOpenApiSource(`
openapi: 3.1.1
info: { title: Orders, version: '1.0.0', description: ${JSON.stringify(description)} }
paths:
  /orders/{id}:
    get:
      summary: Get order
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      responses:
        '200':
          description: found
          content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } }
components:
  schemas:
    Order:
      type: object
      required: [id]
      properties:
        id: { type: string, description: order id }
        state: { type: string, enum: [new, paid] }
`),
  );
}

describe('OpenAPI layout', () => {
  it('lays out operations and models in expanded cards with measured wrapped descriptions', () => {
    const layout = layoutOpenApiDocument(model());
    const text = layout.texts.map(({ text: line }) => line).join('\n');
    expect(layout.width).toBe(1_200);
    expect(layout.height).toBeGreaterThan(0);
    expect(text).toContain('Operations');
    expect(text).toContain('GET');
    expect(text).toContain('/orders/{id}');
    expect(text).toContain('Parameters');
    expect(text).toContain('Responses');
    expect(text).toContain('Order (#/components/schemas/Order)');
    expect(text).toContain('Models');
    expect(text).toContain('id (required)');
    expect(layout.boxes.length).toBeGreaterThan(10);
    expect(layout.boxes.some(({ fill }) => fill === '#2563eb')).toBe(true);
  });

  it('keeps long unbroken paths and descriptions through line wrapping', () => {
    const longPath = `/items/${'verylongsegment'.repeat(18)}`;
    const longDescription = `first line\n${'Ж'.repeat(900)}\nlast line`;
    const source = `openapi: 3.1.1\ninfo: { title: Long, version: '1' }\npaths:\n  ${JSON.stringify(longPath)}:\n    get:\n      description: ${JSON.stringify(longDescription)}\n      responses: { default: { description: ok } }\n`;
    const layout = layoutOpenApiDocument(buildOpenApiModel(parseOpenApiSource(source)));
    const rendered = layout.texts.map(({ text }) => text).join('\n');
    expect(rendered).toContain(longPath.slice(-40));
    expect(rendered).toContain('first line');
    expect(rendered).toContain('last line');
    expect(layout.texts.every(({ x, y }) => x >= 0 && x < layout.width && y <= layout.height)).toBe(
      true,
    );
  });

  it('lays out parameter content, response headers, and nested schema constraints', () => {
    const document = buildOpenApiModel(
      parseOpenApiSource(`
openapi: 3.1.1
info: { title: Details, version: '1' }
paths:
  /details:
    patch:
      parameters:
        - name: filter
          in: query
          content:
            text/plain: { schema: { type: string } }
      responses:
        '302': { description: redirect }
        '500':
          description: failed
          headers:
            X-Trace:
              required: true
              schema: { type: string }
          content:
            application/json:
              schema:
                type: object
                properties:
                  entries:
                    type: array
                    items:
                      type: object
                      properties:
                        detail: { type: string, readOnly: true }
                  metadata:
                    type: object
                    additionalProperties: { type: string, writeOnly: true }
                  choice:
                    oneOf: [{ type: string }, { type: integer }]
                  arbitrary: true
                  impossible: false
components:
  schemas:
    Variants:
      allOf: [{ type: object }]
      anyOf: [true, { type: integer }]
`),
    );
    const text = layoutOpenApiDocument(document)
      .texts.map(({ text: line }) => line)
      .join('\n');

    expect(text).toContain('PATCH');
    expect(text).toContain('302');
    expect(text).toContain('500');
    expect(text).toContain('Header X-Trace · required');
    expect(text).toContain('text/plain');
    expect(text).toContain('Items');
    expect(text).toContain('Additional properties');
    expect(text).toContain('oneOf 1');
    expect(text).toContain('Allows any value');
    expect(text).toContain('Allows no value');
    expect(text).toContain('read only');
    expect(text).toContain('write only');
    expect(text).toContain('allOf 1');
    expect(text).toContain('anyOf 1');
  });

  it('summarizes unsupported features in the SVG model', () => {
    const document = buildOpenApiModel(
      parseOpenApiSource(`
openapi: 3.1.1
info: { title: Hidden, version: '1' }
servers: [{ url: https://example.test }]
paths: {}
`),
    );
    const layout = layoutOpenApiDocument(document);
    expect(layout.texts.map(({ text }) => text).join(' ')).toContain('Not shown: servers');
  });

  it('shows a message for a valid document with no paths or models', () => {
    const document = buildOpenApiModel(
      parseOpenApiSource('openapi: 3.1.1\ninfo: { title: Empty, version: "1" }\npaths: {}\n'),
    );
    expect(
      layoutOpenApiDocument(document)
        .texts.map(({ text }) => text)
        .join(' '),
    ).toContain('No paths or models are defined.');
  });

  it('rejects layouts over the line and height limits instead of truncating them', () => {
    const tooManyLines = model(`${'line\n'.repeat(OPENAPI_LAYOUT_MAX_LINES + 20)}`);
    expect(() => layoutOpenApiDocument(tooManyLines)).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(`limit ${OPENAPI_LAYOUT_MAX_LINES}`),
        pointer: '#',
        line: 2,
        column: 1,
      }),
    );

    const tooTall = model(`${'line\n'.repeat(Math.floor(OPENAPI_SVG_MAX_HEIGHT / 18))}`);
    expect(() => layoutOpenApiDocument(tooTall)).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(`limit ${OPENAPI_SVG_MAX_HEIGHT} px`),
        pointer: '#/components/schemas/Order/properties/state',
        line: expect.any(Number),
        column: expect.any(Number),
      }),
    );
  });
});
