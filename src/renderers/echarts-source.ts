import {
  createScanner,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser';

import { EChartsError, toEChartsJsonPointer } from './echarts-error.js';

export const ECHARTS_VERSION = '6.1.0';
export const MAX_ECHARTS_SOURCE_BYTES = 256 * 1024;
export const MAX_ECHARTS_JSON_DEPTH = 32;
export const MAX_ECHARTS_JSON_NODES = 100_000;
export const MAX_ECHARTS_LINE_BYTES = 4 * 1024;
export const DEFAULT_ECHARTS_WIDTH = 800;
export const DEFAULT_ECHARTS_HEIGHT = 450;
export const MIN_ECHARTS_DIMENSION = 240;
export const MAX_ECHARTS_DIMENSION = 1_600;

const TOKEN_OPEN_BRACE = 1;
const TOKEN_CLOSE_BRACE = 2;
const TOKEN_OPEN_BRACKET = 3;
const TOKEN_CLOSE_BRACKET = 4;
const TOKEN_EOF = 17;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export interface EChartsSource {
  option: Record<string, unknown>;
  width: number;
  height: number;
  positions: Map<string, EChartsSourcePosition>;
}

export interface EChartsSourcePosition {
  line: number;
  column: number;
}

export function parseEChartsSource(source: string, metadata = ''): EChartsSource {
  const sourceBytes = Buffer.byteLength(source, 'utf8');
  if (sourceBytes > MAX_ECHARTS_SOURCE_BYTES) {
    throw new EChartsError(
      `ECharts block is too large: ${sourceBytes} bytes (limit ${MAX_ECHARTS_SOURCE_BYTES} bytes)`,
    );
  }
  assertLineLengths(source);
  const locate = createSourcePositionLookup(source);
  scanDepth(source, locate);

  const parseErrors: ParseError[] = [];
  const tree = parseTree(source, parseErrors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  if (parseErrors.length > 0 || tree === undefined) {
    const parseError = parseErrors[0];
    const position = locate(parseError?.offset ?? 0);
    const detail = parseError === undefined ? 'empty input' : printParseErrorCode(parseError.error);
    throw new EChartsError(`invalid ECharts JSON: ${detail}`, { ...position, pointer: '' });
  }

  const nodeCount = countNodes(tree);
  if (nodeCount > MAX_ECHARTS_JSON_NODES) {
    throw new EChartsError(
      `ECharts JSON has too many AST nodes: ${nodeCount} (limit ${MAX_ECHARTS_JSON_NODES})`,
      { ...locate(tree.offset), pointer: '' },
    );
  }

  const positions = new Map<string, EChartsSourcePosition>();
  const value = convertNode(tree, locate, [], positions);
  if (!isRecord(value)) {
    throw new EChartsError('ECharts option must be a JSON object', {
      ...locate(tree.offset),
      pointer: '',
    });
  }
  assertFiniteNumbers(value, positions, locate);
  const dimensions = parseEChartsMetadata(metadata);
  return { option: value, ...dimensions, positions };
}

export function parseEChartsMetadata(metadata: string): { width: number; height: number } {
  const dimensions = { width: DEFAULT_ECHARTS_WIDTH, height: DEFAULT_ECHARTS_HEIGHT };
  const seen = new Set<string>();
  for (const token of metadata.trim().split(/\s+/).filter(Boolean)) {
    const separator = token.indexOf('=');
    if (separator <= 0 || separator === token.length - 1) {
      throw new EChartsError(`invalid ECharts metadata token "${token}"`);
    }
    const name = token.slice(0, separator);
    const value = token.slice(separator + 1);
    if (name !== 'width' && name !== 'height') {
      throw new EChartsError(`unknown ECharts metadata option "${name}"; expected width or height`);
    }
    if (seen.has(name)) throw new EChartsError(`duplicate ECharts metadata option "${name}"`);
    seen.add(name);
    if (!/^\d+$/.test(value)) {
      throw new EChartsError(
        `ECharts ${name} must be an integer between ${MIN_ECHARTS_DIMENSION} and ${MAX_ECHARTS_DIMENSION}`,
      );
    }
    const size = Number(value);
    if (size < MIN_ECHARTS_DIMENSION || size > MAX_ECHARTS_DIMENSION) {
      throw new EChartsError(
        `ECharts ${name} must be an integer between ${MIN_ECHARTS_DIMENSION} and ${MAX_ECHARTS_DIMENSION}`,
      );
    }
    dimensions[name] = size;
  }
  return dimensions;
}

export function sourcePosition(source: string, offset: number): EChartsSourcePosition {
  return createSourcePositionLookup(source)(offset);
}

function assertLineLengths(source: string): void {
  for (const [index, line] of source.split(/\r\n|\r|\n/).entries()) {
    const bytes = Buffer.byteLength(line, 'utf8');
    if (bytes > MAX_ECHARTS_LINE_BYTES) {
      throw new EChartsError(
        `ECharts JSON line ${index + 1} is too long: ${bytes} bytes (limit ${MAX_ECHARTS_LINE_BYTES} bytes)`,
        { line: index + 1, column: 1, pointer: '' },
      );
    }
  }
}

function scanDepth(source: string, locate: (offset: number) => EChartsSourcePosition): void {
  const scanner = createScanner(source, false);
  let depth = 0;
  for (;;) {
    const token = scanner.scan();
    if (token === TOKEN_EOF) return;
    if (token === TOKEN_OPEN_BRACE || token === TOKEN_OPEN_BRACKET) {
      depth += 1;
      if (depth > MAX_ECHARTS_JSON_DEPTH) {
        throw new EChartsError(
          `ECharts JSON is nested too deeply: ${depth} (limit ${MAX_ECHARTS_JSON_DEPTH})`,
          locate(scanner.getTokenOffset()),
        );
      }
    } else if (token === TOKEN_CLOSE_BRACE || token === TOKEN_CLOSE_BRACKET) {
      depth = Math.max(0, depth - 1);
    }
  }
}

function countNodes(node: JsonNode): number {
  let count = 1;
  for (const child of node.children ?? []) {
    count += countNodes(child);
    if (count > MAX_ECHARTS_JSON_NODES) return count;
  }
  return count;
}

function convertNode(
  node: JsonNode,
  locate: (offset: number) => EChartsSourcePosition,
  path: (string | number)[],
  positions: Map<string, EChartsSourcePosition>,
): unknown {
  const pointer = toEChartsJsonPointer(path);
  positions.set(pointer, locate(node.offset));
  switch (node.type) {
    case 'object': {
      const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      const seen = new Set<string>();
      for (const property of node.children ?? []) {
        const keyNode = property.children?.[0];
        const valueNode = property.children?.[1];
        if (keyNode?.type !== 'string' || valueNode === undefined) continue;
        const key = String(keyNode.value);
        const childPath = [...path, key];
        const childPointer = toEChartsJsonPointer(childPath);
        if (seen.has(key)) {
          throw new EChartsError(`duplicate JSON key at ${childPointer || '/'}`, {
            ...locate(keyNode.offset),
            pointer: childPointer,
          });
        }
        seen.add(key);
        if (FORBIDDEN_KEYS.has(key)) {
          throw new EChartsError(`forbidden JSON key at ${childPointer}`, {
            ...locate(keyNode.offset),
            pointer: childPointer,
          });
        }
        const value = convertNode(valueNode, locate, childPath, positions);
        Object.defineProperty(output, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
        positions.set(childPointer, locate(keyNode.offset));
      }
      return output;
    }
    case 'array':
      return (node.children ?? []).map((child, index) =>
        convertNode(child, locate, [...path, index], positions),
      );
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return node.value;
    case 'property':
      return undefined;
  }
}

function assertFiniteNumbers(
  value: unknown,
  positions: Map<string, EChartsSourcePosition>,
  locate: (offset: number) => EChartsSourcePosition,
  path: (string | number)[] = [],
): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    const pointer = toEChartsJsonPointer(path);
    throw new EChartsError(`non-finite number at ${pointer || '/'}`, {
      ...(positions.get(pointer) ?? locate(0)),
      pointer,
    });
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, positions, locate, [...path, index]));
  } else if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      assertFiniteNumbers(value[key], positions, locate, [...path, key]);
    }
  }
}

function createSourcePositionLookup(source: string): (offset: number) => EChartsSourcePosition {
  const starts: Array<{ offset: number; line: number }> = [{ offset: 0, line: 1 }];
  let line = 1;
  for (let index = 0; index < source.length; index += 1) {
    const character = source.charCodeAt(index);
    if (character === 13) {
      line += 1;
      starts.push({ offset: index + 1, line });
      if (source.charCodeAt(index + 1) === 10) {
        index += 1;
        starts.push({ offset: index + 1, line });
      }
    } else if (character === 10) {
      line += 1;
      starts.push({ offset: index + 1, line });
    }
  }

  return (offset) => {
    const end = Math.min(Math.max(offset, 0), source.length);
    let low = 0;
    let high = starts.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((starts[middle]?.offset ?? 0) <= end) low = middle + 1;
      else high = middle;
    }
    const start = starts[Math.max(0, low - 1)] ?? { offset: 0, line: 1 };
    return { line: start.line, column: end - start.offset + 1 };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
