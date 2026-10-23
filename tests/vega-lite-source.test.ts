import { describe, expect, it } from 'vitest';

import {
  MAX_VEGA_LITE_JSON_DEPTH,
  MAX_VEGA_LITE_JSON_NODES,
  parseVegaLiteSource,
  sourcePosition,
} from '../src/renderers/vega-lite-source.js';
import { MAX_VEGA_LITE_DIAGNOSTIC_CHARS, VegaLiteError } from '../src/renderers/vega-lite-error.js';

describe('Vega-Lite JSON source parsing', () => {
  it('parses a strict object and indexes pointer positions', () => {
    const source = '{\n  "title": "Latency",\n  "data": {"values": [{"x": 1}]}\n}';
    const parsed = parseVegaLiteSource(source);

    expect(parsed.value.title).toBe('Latency');
    expect(parsed.positions.get('/data/values/0/x')).toEqual({ line: 3, column: 24 });
    expect(Object.getPrototypeOf(parsed.value)).toBeNull();
  });

  it.each([
    ['', 'ValueExpected'],
    ['{ invalid }', 'InvalidSymbol'],
    ['{/* comment */"mark":"point"}', 'InvalidCommentToken'],
    ['{"mark":"point",}', 'PropertyNameExpected'],
  ])('rejects invalid JSON: %s', (source, message) => {
    expect(() => parseVegaLiteSource(source)).toThrow(message);
  });

  it('rejects duplicate keys, including escaped spellings, at the second key', () => {
    const source = '{"mark":"point","ma\\u0072k":"line"}';
    try {
      parseVegaLiteSource(source);
      throw new Error('expected duplicate key rejection');
    } catch (error) {
      expect(error).toMatchObject({ name: 'VegaLiteError', line: 1, column: 17, pointer: '/mark' });
      expect(error).toHaveProperty('message', 'duplicate JSON key at /mark');
    }
  });

  it('rejects arrays at the root and non-finite JSON numbers', () => {
    expect(() => parseVegaLiteSource('[]')).toThrow(
      'Vega-Lite specification must be a JSON object',
    );
    expect(() => parseVegaLiteSource('{"width":1e999}')).toThrow('non-finite number at /width');
  });

  it('checks nesting with a scanner before parsing the tree', () => {
    const source = `${'['.repeat(MAX_VEGA_LITE_JSON_DEPTH + 1)}0${']'.repeat(MAX_VEGA_LITE_JSON_DEPTH + 1)}`;
    expect(() => parseVegaLiteSource(source)).toThrow('nested too deeply');
  });

  it('stops counting once the AST node limit is exceeded', () => {
    const source = `[${Array.from({ length: MAX_VEGA_LITE_JSON_NODES }, () => '0').join(',')}]`;
    expect(() => parseVegaLiteSource(source)).toThrow('too many AST nodes');
  });

  it('reports positions correctly with CRLF and non-ASCII text', () => {
    const source = '{\r\n  "title": "Привет",\r\n  "width": 1e999\r\n}';
    try {
      parseVegaLiteSource(source);
      throw new Error('expected non-finite number rejection');
    } catch (error) {
      expect(error).toMatchObject({ name: 'VegaLiteError', line: 3, column: 3, pointer: '/width' });
    }
    expect(sourcePosition('a\r\nb', 3)).toEqual({ line: 2, column: 1 });
  });

  it('keeps prototype-like keys as inert own data', () => {
    const parsed = parseVegaLiteSource('{"__proto__":{"polluted":true},"constructor":1}');
    expect(Object.getPrototypeOf(parsed.value)).toBeNull();
    expect(Object.hasOwn(parsed.value, '__proto__')).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('caps diagnostic text without discarding source coordinates', () => {
    const error = new VegaLiteError('x'.repeat(MAX_VEGA_LITE_DIAGNOSTIC_CHARS + 100), {
      line: 4,
      column: 7,
      pointer: '/title',
    });
    expect(error.message).toHaveLength(MAX_VEGA_LITE_DIAGNOSTIC_CHARS);
    expect(error).toMatchObject({ line: 4, column: 7, pointer: '/title' });
  });
});
