import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ECHARTS_HEIGHT,
  DEFAULT_ECHARTS_WIDTH,
  MAX_ECHARTS_JSON_DEPTH,
  MAX_ECHARTS_JSON_NODES,
  MAX_ECHARTS_LINE_BYTES,
  MAX_ECHARTS_SOURCE_BYTES,
  parseEChartsMetadata,
  parseEChartsSource,
  sourcePosition,
} from '../src/renderers/echarts-source.js';
import {
  MAX_ECHARTS_DIAGNOSTIC_CHARS,
  EChartsError,
  limitEChartsMessage,
  toEChartsJsonPointer,
} from '../src/renderers/echarts-error.js';

describe('ECharts source parser', () => {
  it('parses strict JSON, preserves inert object keys, and indexes pointer positions', () => {
    const source = '{\n  "title": "Привет",\n  "series": [{"type":"bar","data":[null,4]}]\n}';
    const parsed = parseEChartsSource(source, 'width=960');

    expect(parsed.option.title).toBe('Привет');
    expect(parsed.width).toBe(960);
    expect(parsed.height).toBe(DEFAULT_ECHARTS_HEIGHT);
    expect(parsed.positions.get('/series/0/type')).toEqual({ line: 3, column: 15 });
    expect(Object.getPrototypeOf(parsed.option)).toBeNull();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it.each([
    ['', 'invalid ECharts JSON'],
    ['{/* comment */"series":[]}', 'invalid ECharts JSON'],
    ['{"series":[],}', 'invalid ECharts JSON'],
    ['[]', 'ECharts option must be a JSON object'],
    ['{"__proto__":1}', 'forbidden JSON key'],
    ['{"constructor":1}', 'forbidden JSON key'],
    ['{"value":1e999}', 'non-finite number'],
  ])('rejects invalid source %s', (source, message) => {
    expect(() => parseEChartsSource(source)).toThrow(message);
  });

  it('rejects duplicate keys at the second key and escapes pointer segments', () => {
    const source = '{"series":[],"se\u0072ies":[]}';
    expect(() => parseEChartsSource(source)).toThrow(
      expect.objectContaining({ pointer: '/series', column: 14 }),
    );
    expect(toEChartsJsonPointer(['a/b', '~x', 2])).toBe('/a~1b/~0x/2');
  });

  it('rejects input over byte, line, depth, and AST limits before rendering', () => {
    const oversized =
      '{\n' + Array.from({ length: 80 }, () => ' '.repeat(3_800)).join('\n') + '\n}';
    expect(Buffer.byteLength(oversized, 'utf8')).toBeGreaterThan(MAX_ECHARTS_SOURCE_BYTES);
    expect(() => parseEChartsSource(oversized)).toThrow('block is too large');

    const longLine = '{"x":"' + 'a'.repeat(MAX_ECHARTS_LINE_BYTES) + '"}';
    expect(() => parseEChartsSource(longLine)).toThrow('line 1 is too long');

    const nested =
      '['.repeat(MAX_ECHARTS_JSON_DEPTH + 1) + '0' + ']'.repeat(MAX_ECHARTS_JSON_DEPTH + 1);
    expect(() => parseEChartsSource(nested)).toThrow('nested too deeply');

    const manyNodes =
      '[\n' +
      Array.from({ length: 100 }, () =>
        Array.from({ length: MAX_ECHARTS_JSON_NODES / 100 }, () => '0').join(','),
      ).join(',\n') +
      '\n]';
    expect(() => parseEChartsSource(manyNodes)).toThrow('too many AST nodes');
  });

  it('accepts source, line, depth, and AST sizes exactly at their limits', () => {
    const sourceAtByteLimit = createSourceAtByteLimit();
    expect(Buffer.byteLength(sourceAtByteLimit, 'utf8')).toBe(MAX_ECHARTS_SOURCE_BYTES);
    expect(() => parseEChartsSource(sourceAtByteLimit)).not.toThrow();
    expect(() => parseEChartsSource(sourceAtByteLimit + ' ')).toThrow('block is too large');

    const utf8Line = '{"x":"' + 'é'.repeat(2_043) + 'aa"}';
    expect(Buffer.byteLength(utf8Line, 'utf8')).toBe(MAX_ECHARTS_LINE_BYTES);
    expect(() => parseEChartsSource(utf8Line)).not.toThrow();
    expect(() => parseEChartsSource(utf8Line.replace('aa"}', 'aaa"}'))).toThrow(
      'line 1 is too long',
    );

    const atDepthLimit =
      '{"x":' +
      '['.repeat(MAX_ECHARTS_JSON_DEPTH - 1) +
      '0' +
      ']'.repeat(MAX_ECHARTS_JSON_DEPTH - 1) +
      '}';
    expect(() => parseEChartsSource(atDepthLimit)).not.toThrow();

    expect(() =>
      parseEChartsSource(createSourceWithNumberNodes(MAX_ECHARTS_JSON_NODES - 1)),
    ).toThrow('must be a JSON object');
    expect(() => parseEChartsSource(createSourceWithNumberNodes(MAX_ECHARTS_JSON_NODES))).toThrow(
      'too many AST nodes',
    );
  });

  it('parses dimensions in any order and rejects malformed or repeated metadata', () => {
    expect(parseEChartsMetadata('height=600 width=960')).toEqual({ width: 960, height: 600 });
    expect(parseEChartsMetadata('width=240 height=1600')).toEqual({ width: 240, height: 1600 });
    expect(parseEChartsMetadata('')).toEqual({
      width: DEFAULT_ECHARTS_WIDTH,
      height: DEFAULT_ECHARTS_HEIGHT,
    });
    for (const metadata of [
      'color=red',
      'width=300 width=400',
      'width=240.5',
      'width=239',
      'height=1601',
      'width',
      'width=',
    ]) {
      expect(() => parseEChartsMetadata(metadata)).toThrow();
    }
  });

  it('reports CRLF and UTF-8 source positions and caps error messages', () => {
    expect(sourcePosition('a\r\nb', 3)).toEqual({ line: 2, column: 1 });
    const source = '{\r\n  "Привет": 1e999\r\n}';
    expect(() => parseEChartsSource(source)).toThrow(
      expect.objectContaining({ line: 2, column: 3, pointer: '/Привет' }),
    );

    const error = new EChartsError('x'.repeat(MAX_ECHARTS_DIAGNOSTIC_CHARS + 10), {
      line: 4,
      column: 7,
      pointer: '/series',
    });
    expect(error.message).toHaveLength(MAX_ECHARTS_DIAGNOSTIC_CHARS);
    expect(error).toMatchObject({ line: 4, column: 7, pointer: '/series' });
    expect(limitEChartsMessage('short')).toBe('short');
  });
});

function createSourceAtByteLimit(): string {
  const lengths = Array.from({ length: 67 }, () => 3_600);
  const render = () =>
    '{\n' +
    lengths
      .map((length, index) => {
        const comma = index < lengths.length - 1 ? ',' : '';
        return `  "field${index}":"${'a'.repeat(length)}"${comma}`;
      })
      .join('\n') +
    '\n}';
  let missingBytes = MAX_ECHARTS_SOURCE_BYTES - Buffer.byteLength(render(), 'utf8');
  for (let index = 0; index < lengths.length && missingBytes > 0; index += 1) {
    const comma = index < lengths.length - 1 ? ',' : '';
    const lineBytes = Buffer.byteLength(
      `  "field${index}":"${'a'.repeat(lengths[index] ?? 0)}"${comma}`,
    );
    const extraBytes = Math.min(missingBytes, MAX_ECHARTS_LINE_BYTES - lineBytes);
    lengths[index] = (lengths[index] ?? 0) + extraBytes;
    missingBytes -= extraBytes;
  }
  if (missingBytes !== 0) throw new Error('Unable to construct a source at the byte limit');
  return render();
}

function createSourceWithNumberNodes(numberCount: number): string {
  const lines: string[] = [];
  for (let offset = 0; offset < numberCount; offset += 1_000) {
    lines.push(Array.from({ length: Math.min(1_000, numberCount - offset) }, () => '0').join(','));
  }
  return `[\n${lines.join(',\n')}\n]`;
}
