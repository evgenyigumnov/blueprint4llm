import { describe, expect, it } from 'vitest';

import {
  MAX_OPENAPI_AST_DEPTH,
  MAX_OPENAPI_AST_NODES,
  MAX_OPENAPI_SOURCE_BYTES,
  parseOpenApiSource,
} from '../src/renderers/openapi-source.js';
import type { OpenApiObject } from '../src/renderers/openapi-types.js';

function jsonWithExtra(extra: string): string {
  return `{"openapi":"3.1.1","extra":${extra}}`;
}

describe('parseOpenApiSource', () => {
  it('parses equivalent YAML and JSON into ordered maps', () => {
    const json = parseOpenApiSource(
      '{"openapi":"3.1.1","info":{"title":"Orders","version":"1"},"paths":{}}',
    );
    const yaml = parseOpenApiSource(
      'openapi: 3.1.1\ninfo:\n  title: Orders\n  version: "1"\npaths: {}\n',
    );

    expect(json.format).toBe('json');
    expect(yaml.format).toBe('yaml');
    expect(json.value).toEqual(yaml.value);
    expect(json.value).toBeInstanceOf(Map);
    expect([...(json.value as OpenApiObject).keys()]).toEqual(['openapi', 'info', 'paths']);
  });

  it('indexes YAML locations across CRLF lines and Unicode text', () => {
    const source = 'openapi: 3.1.1\r\ninfo:\r\n  title: Привет\r\n';
    const parsed = parseOpenApiSource(source);
    const offset = source.indexOf('Привет');

    expect(parsed.positions.get('#/info/title')).toEqual({ line: 3, column: 10 });
    expect(parsed.positions.get('#/info/title')?.column).toBe(
      offset - source.lastIndexOf('\n', offset),
    );
  });

  it('escapes JSON Pointer path segments and indexes empty keys and array items', () => {
    const source = '{"openapi":"3.1.1","a/b":{"~key":[{"":"x"}]}}';
    const parsed = parseOpenApiSource(source);

    expect(parsed.positions.get('#/a~1b/~0key/0/')).toEqual({
      line: 1,
      column: source.indexOf('"x"') + 1,
    });
  });

  it.each([
    ['trailing comma', '{"openapi":"3.1.1",}', 'invalid JSON'],
    ['comments', '{\n  // no JSON comments\n  "openapi":"3.1.1"\n}', 'invalid JSON'],
  ])('enforces JSON grammar for %s', (_label, source, expectedMessage) => {
    expect(() => parseOpenApiSource(source)).toThrow(expectedMessage);
  });

  it('reports syntax errors at their source-local line and column', () => {
    const jsonSource = '{\n  "openapi": "3.1.1",\n}';
    const yamlSource = 'openapi: 3.1.1\ninfo: [\n';

    expect(() => parseOpenApiSource(jsonSource)).toThrow(
      expect.objectContaining({ name: 'OpenApiError', line: 3, column: 1 }),
    );
    expect(() => parseOpenApiSource(yamlSource)).toThrow(
      expect.objectContaining({ name: 'OpenApiError', line: 3, column: 1 }),
    );
  });

  it.each([
    ['JSON', '{"openapi":"3.1.1",\n"info":{},\n"info":{}}', 3],
    ['YAML', 'openapi: 3.1.1\ninfo: {}\ninfo: {}\n', 3],
  ])('rejects duplicate keys in %s with the duplicate-key position', (_format, source, line) => {
    try {
      parseOpenApiSource(source);
      throw new Error('expected a duplicate-key error');
    } catch (error) {
      expect(error).toMatchObject({ name: 'OpenApiError', line, column: 1 });
      expect(error).toHaveProperty('message', 'duplicate mapping key');
    }
  });

  it('accepts only OpenAPI 3.1.1 and locates the version field', () => {
    const source = 'openapi: 3.0.3\ninfo: {}\n';

    expect(() => parseOpenApiSource(source)).toThrow(
      expect.objectContaining({
        message: 'unsupported OpenAPI version: 3.0.3; supported: 3.1.1',
        pointer: '#/openapi',
        line: 1,
        column: 10,
      }),
    );
  });

  it.each([
    ['missing version', 'info: {}\n', 'missing required field "openapi"'],
    ['non-string version', 'openapi: 3.1\n', 'OpenAPI field "openapi" must be a string'],
    ['non-object root', '["item"]', 'OpenAPI document must be an object'],
  ])('reports an invalid root for %s', (_label, source, expectedMessage) => {
    expect(() => parseOpenApiSource(source)).toThrow(expectedMessage);
  });

  it.each([
    ['YAML alias', 'openapi: 3.1.1\na: &base {x: 1}\nb: *base\n', 'YAML aliases'],
    ['merge key', 'openapi: 3.1.1\na:\n  <<: {x: 1}\n', 'merge keys'],
    ['custom tag', 'openapi: 3.1.1\na: !custom value\n', 'custom YAML tags'],
    ['multiple documents', 'openapi: 3.1.1\n---\nopenapi: 3.1.1\n', 'multiple YAML documents'],
    ['YAML 1.1 directive', '%YAML 1.1\n---\nopenapi: 3.1.1\n', 'only YAML 1.2'],
    ['non-string key', 'openapi: 3.1.1\n1: value\n', 'mapping keys must be strings'],
    ['.nan', 'openapi: 3.1.1\nextra: .nan\n', 'non-finite YAML numbers'],
    ['.inf', 'openapi: 3.1.1\nextra: -.Inf\n', 'non-finite YAML numbers'],
  ])('rejects unsupported YAML feature: %s', (_label, source, expectedMessage) => {
    expect(() => parseOpenApiSource(source)).toThrow(expectedMessage);
  });

  it('preserves prototype-sensitive property names as ordinary map keys', () => {
    const parsed = parseOpenApiSource('{"openapi":"3.1.1","__proto__":{"polluted":true}}');
    const value = parsed.value as OpenApiObject;

    expect(value.has('__proto__')).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('accepts the exact UTF-8 source-size limit and rejects one byte over it', () => {
    const template = '{"openapi":"3.1.1","padding":""}';
    const exactSource = template.replace(
      '""',
      `"${'x'.repeat(MAX_OPENAPI_SOURCE_BYTES - template.length)}"`,
    );

    expect(Buffer.byteLength(exactSource, 'utf8')).toBe(MAX_OPENAPI_SOURCE_BYTES);
    expect(() => parseOpenApiSource(exactSource)).not.toThrow();
    expect(() => parseOpenApiSource(`${exactSource} `)).toThrow(
      `limit ${MAX_OPENAPI_SOURCE_BYTES} bytes`,
    );
  });

  it('accepts the exact AST depth limit and rejects one level beyond it', () => {
    const withinDepth = MAX_OPENAPI_AST_DEPTH - 2;
    const beyondDepth = MAX_OPENAPI_AST_DEPTH - 1;
    const withinLimit = jsonWithExtra(`${'['.repeat(withinDepth)}0${']'.repeat(withinDepth)}`);
    const tooDeep = jsonWithExtra(`${'['.repeat(beyondDepth)}0${']'.repeat(beyondDepth)}`);

    expect(() => parseOpenApiSource(withinLimit)).not.toThrow();
    expect(() => parseOpenApiSource(tooDeep)).toThrow(`depth limit of ${MAX_OPENAPI_AST_DEPTH}`);
  });

  it('accepts the exact AST node limit and rejects one node beyond it', () => {
    const withinLimit = jsonWithExtra(`[${'0,'.repeat(MAX_OPENAPI_AST_NODES - 6)}0]`);
    const tooMany = jsonWithExtra(`[${'0,'.repeat(MAX_OPENAPI_AST_NODES - 5)}0]`);

    expect(() => parseOpenApiSource(withinLimit)).not.toThrow();
    expect(() => parseOpenApiSource(tooMany)).toThrow(`node limit of ${MAX_OPENAPI_AST_NODES}`);
  });
});
