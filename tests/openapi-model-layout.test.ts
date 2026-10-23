import { describe, expect, it } from 'vitest';

import { estimateTextWidth } from '../src/renderers/openapi-layout-builder.js';
import { layoutOpenApiDocument } from '../src/renderers/openapi-layout.js';
import { buildOpenApiModel } from '../src/renderers/openapi-model.js';
import { parseOpenApiSource } from '../src/renderers/openapi-source.js';

function layoutModel(schema: object | boolean) {
  return layoutOpenApiDocument(
    buildOpenApiModel(
      parseOpenApiSource(
        JSON.stringify({
          openapi: '3.1.1',
          info: { title: 'Model padding', version: '1' },
          components: { schemas: { Example: schema } },
        }),
      ),
    ),
  );
}

describe('OpenAPI model card spacing', () => {
  it.each([
    ['object', { type: 'object', properties: { id: { type: 'string' } } }],
    ['primitive', { type: 'string', description: 'A model description.' }],
    ['permissive boolean', true],
    ['restrictive boolean', false],
    ['array', { type: 'array', items: { type: 'integer' } }],
    ['composition', { oneOf: [{ type: 'string' }, { type: 'integer' }] }],
  ] as const)('insets the heading and body of a %s model from the card border', (_name, schema) => {
    const layout = layoutModel(schema);
    const frame = layout.boxes.find(({ stroke }) => stroke === '#cbd5e1')!;
    const heading = layout.texts.find(({ text }) => text === 'Example')!;
    const body = layout.texts.filter(({ y }) => y > frame.y + 44);

    expect(heading.x - frame.x).toBeGreaterThanOrEqual(16);
    expect(body.length).toBeGreaterThan(0);
    for (const text of body) {
      expect(text.x - frame.x).toBeGreaterThanOrEqual(16);
      const right = text.x + estimateTextWidth(text.text, text.fontSize, text.family === 'mono');
      expect(frame.x + frame.width - right).toBeGreaterThanOrEqual(16);
    }
  });

  it('keeps nested property cards inside the padded model body', () => {
    const layout = layoutModel({
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: { type: 'object', properties: { detail: { type: 'string' } } },
        },
        metadata: { type: 'object', additionalProperties: { type: 'string' } },
        choice: { oneOf: [true, false] },
      },
    });
    const frame = layout.boxes.find(({ stroke }) => stroke === '#cbd5e1')!;
    const properties = layout.boxes.filter(({ stroke }) => stroke === '#e2e8f0');

    expect(properties.length).toBeGreaterThan(6);
    for (const property of properties) {
      expect(property.x - frame.x).toBeGreaterThanOrEqual(16);
      expect(frame.x + frame.width - property.x - property.width).toBeGreaterThanOrEqual(16);
    }
    const labels = layout.texts.map(({ text }) => text);
    expect(labels).toContain('Items');
    expect(labels).toContain('Additional properties');
    expect(labels).toContain('oneOf 2');
  });

  it('wraps long descriptions within the padded model body without losing text', () => {
    const description = `${'Wide model description '.repeat(100)}final words`;
    const layout = layoutModel({ type: 'string', description });
    const frame = layout.boxes.find(({ stroke }) => stroke === '#cbd5e1')!;
    const lines = layout.texts.filter(({ color }) => color === '#475569');

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map(({ text }) => text).join(' ')).toBe(description);
    for (const line of lines) {
      const right = line.x + estimateTextWidth(line.text, line.fontSize, false);
      expect(frame.x + frame.width - right).toBeGreaterThanOrEqual(16);
    }
    expect(frame.y + frame.height).toBeGreaterThan(lines.at(-1)!.y);
  });
});
