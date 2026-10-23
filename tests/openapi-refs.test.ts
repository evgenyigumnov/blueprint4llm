import { describe, expect, it } from 'vitest';

import {
  OpenApiReferenceResolver,
  MAX_OPENAPI_REFERENCES,
  parseReferencePointer,
} from '../src/renderers/openapi-refs.js';
import { parseOpenApiSource } from '../src/renderers/openapi-source.js';
import type { OpenApiValue } from '../src/renderers/openapi-types.js';

function resolverFor(sourceText: string) {
  const source = parseOpenApiSource(sourceText);
  const warnings: string[] = [];
  const resolver = new OpenApiReferenceResolver(source, {
    warn: (message) => warnings.push(message),
  });
  return { source, resolver, warnings };
}

describe('OpenAPI local references', () => {
  it('decodes percent encoding and JSON Pointer escapes', () => {
    const { source } = resolverFor('{"openapi":"3.1.1","a/b":{"~key":[{"":"ok"}]}}');
    expect(parseReferencePointer('#/a%7E1b/~0key/0/', '#/test/$ref', source)).toBe(
      '#/a~1b/~0key/0/',
    );
  });

  it.each([
    ['external file', '../common.yaml#/Thing', 'external $ref is not supported'],
    ['URL', 'https://example.test/api.yaml#/Thing', 'external $ref is not supported'],
    ['empty fragment', '#', 'fragment-only $ref values'],
    ['bad percent escape', '#/components/%Q1', 'invalid percent-encoding'],
    ['bad pointer escape', '#/components/~2', 'invalid JSON Pointer escape'],
  ])('rejects unsupported reference syntax: %s', (_label, reference, message) => {
    const { source } = resolverFor('{"openapi":"3.1.1"}');
    expect(() => parseReferencePointer(reference, '#/paths/~1x/get/$ref', source)).toThrow(message);
  });

  it('resolves map keys, array indices, and empty pointer segments safely', () => {
    const { resolver } = resolverFor(
      '{"openapi":"3.1.1","components":{"parameters":[{"name":"","in":"query"}],"schemas":{"S":{"properties":{"":{"type":"string"}}}}}}',
    );
    expect(resolver.resolve('#/components/parameters/0', '#/x/$ref', 'parameter')).toMatchObject({
      pointer: '#/components/parameters/0',
    });
    expect(
      resolver.resolve('#/components/schemas/S/properties/', '#/x/$ref', 'schema').pointer,
    ).toBe('#/components/schemas/S/properties/');
  });

  it('rejects unresolved targets and targets with the wrong object kind', () => {
    const { resolver } = resolverFor('{"openapi":"3.1.1","components":{"schemas":{"Order":true}}}');
    expect(() => resolver.resolve('#/components/schemas/Missing', '#/x/$ref', 'schema')).toThrow(
      'unresolved $ref: #/components/schemas/Missing',
    );
    expect(() => resolver.resolve('#/components/schemas/Order', '#/x/$ref', 'response')).toThrow(
      'must be a response object',
    );
  });

  it('keeps schema cycles as edges instead of recursively expanding them', () => {
    const { resolver } = resolverFor(
      '{"openapi":"3.1.1","components":{"schemas":{"Node":{"$ref":"#/components/schemas/Node"}}}}',
    );
    expect(
      resolver.resolve('#/components/schemas/Node', '#/components/schemas/Node/$ref', 'schema'),
    ).toMatchObject({
      pointer: '#/components/schemas/Node',
    });
  });

  it('resolves Reference Object chains and applies allowed description siblings', () => {
    const { resolver, warnings } = resolverFor(
      '{"openapi":"3.1.1","components":{"responses":{"First":{"$ref":"#/components/responses/Second","description":"Override"},"Second":{"$ref":"#/components/responses/Final","x-note":true},"Final":{"description":"Ready"}}}}',
    );
    const resolved = resolver.resolveObject(
      new Map([
        ['$ref', '#/components/responses/First'],
        ['summary', 'From caller'],
      ]),
      '#/paths/~1x/get/responses/200',
      'response',
    );
    expect(resolved.pointer).toBe('#/components/responses/Final');
    expect(resolved.value.get('description')).toBe('Override');
    expect(resolved.value.get('summary')).toBe('From caller');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('x-note');
  });

  it('rejects non-schema reference cycles and path item merges', () => {
    const cyclic = resolverFor(
      '{"openapi":"3.1.1","components":{"responses":{"A":{"$ref":"#/components/responses/B"},"B":{"$ref":"#/components/responses/A"}}}}',
    );
    expect(() =>
      cyclic.resolver.resolveObject(
        new Map([['$ref', '#/components/responses/A']]),
        '#/paths/~1x/get/responses/200',
        'response',
      ),
    ).toThrow('cyclic $ref chain');

    const pathItem = resolverFor('{"openapi":"3.1.1","components":{"pathItems":{"P":{"get":{}}}}}');
    expect(() =>
      pathItem.resolver.resolveObject(
        new Map<string, OpenApiValue>([
          ['$ref', '#/components/pathItems/P'],
          ['get', new Map<string, OpenApiValue>()],
        ]),
        '#/paths/~1x',
        'path item',
      ),
    ).toThrow('Path Item $ref with local operations or parameters');
  });

  it('enforces the reference-count limit', () => {
    const { resolver } = resolverFor('{"openapi":"3.1.1","components":{"schemas":{"A":true}}}');
    for (let index = 0; index < MAX_OPENAPI_REFERENCES; index += 1) {
      resolver.resolve('#/components/schemas/A', '#/x/$ref', 'schema');
    }
    expect(() => resolver.resolve('#/components/schemas/A', '#/x/$ref', 'schema')).toThrow(
      `limit ${MAX_OPENAPI_REFERENCES}`,
    );
  });
});
