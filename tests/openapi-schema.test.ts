import { describe, expect, it } from 'vitest';

import { buildOpenApiModel } from '../src/renderers/openapi-model.js';
import { parseOpenApiSource } from '../src/renderers/openapi-source.js';

function modelForSchema(schema: string) {
  return buildOpenApiModel(
    parseOpenApiSource(
      `openapi: 3.1.1\ninfo: { title: Schema, version: '1' }\ncomponents:\n  schemas:\n    Value: ${schema}\n`,
    ),
  );
}

describe('OpenAPI Schema Object subset', () => {
  it('keeps allOf, anyOf, enums, formats, readOnly, writeOnly, and additionalProperties', () => {
    const schema = modelForSchema(`
      type: object
      format: record
      enum: [one, 2, null]
      readOnly: true
      writeOnly: false
      additionalProperties: { type: string }
      allOf: [{ type: object }]
      anyOf: [true, { type: integer }]
`).schemas[0]?.schema;
    expect(schema).toMatchObject({
      type: 'object',
      format: 'record',
      enum: ['one', 2, null],
      readOnly: true,
      writeOnly: false,
      additionalProperties: { type: 'string' },
      compositions: [
        { kind: 'allOf', schemas: [{ type: 'object' }] },
        { kind: 'anyOf', schemas: [{ booleanSchema: true }, { type: 'integer' }] },
      ],
    });
  });

  it('allows the standard OpenAPI 3.1 dialect and preserves $ref sibling constraints', () => {
    const model = buildOpenApiModel(
      parseOpenApiSource(`
openapi: 3.1.1
jsonSchemaDialect: https://spec.openapis.org/oas/3.1/dialect/base
info: { title: Refs, version: '1' }
components:
  schemas:
    Base: { type: string }
    Refined: { $ref: '#/components/schemas/Base', description: local, minLength: 2 }
`),
    );
    expect(model.schemas[1]?.schema).toMatchObject({
      ref: { targetName: 'Base' },
      description: 'local',
    });
    expect(model.warnings.some(({ message }) => message.includes('minLength'))).toBe(true);
  });

  it.each(['$id', '$anchor', '$dynamicRef', '$dynamicAnchor'])(
    'rejects schema identifier %s',
    (field) => {
      expect(() => modelForSchema(`{ ${field}: "value" }`)).toThrow(
        `keyword "${field}" is not supported`,
      );
    },
  );

  it('rejects unsupported schema dialects and invalid schema field types', () => {
    expect(() =>
      modelForSchema('{ $schema: https://json-schema.org/draft/2020-12/schema }'),
    ).toThrow('unsupported JSON Schema dialect');
    expect(() => modelForSchema('{ type: [string, invalid] }')).toThrow(
      'must be a JSON Schema type',
    );
    expect(() => modelForSchema('{ properties: [] }')).toThrow(
      'schema "properties" must be an object',
    );
    expect(() => modelForSchema('{ additionalProperties: no }')).toThrow(
      'must be an object or boolean',
    );
  });

  it('does not resolve $ref-like data inside enum values or examples', () => {
    const model = modelForSchema(`
      type: object
      enum: [{ $ref: '../outside.yaml#/Thing' }]
      example: { $ref: '#/missing' }
      x-vendor: { $ref: '../extension.yaml#/Thing' }
`);
    expect(model.schemas[0]?.schema.enum?.[0]).toBeInstanceOf(Map);
    expect(model.warnings.map(({ summary }) => summary)).toContain('schema keyword example');
    expect(model.warnings.map(({ summary }) => summary)).toContain('schema keyword x-vendor');
  });
});
