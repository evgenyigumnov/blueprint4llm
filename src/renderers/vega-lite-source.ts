import {
  createScanner,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser';

import { VegaLiteError, toJsonPointer } from './vega-lite-error.js';

export const MAX_VEGA_LITE_JSON_DEPTH = 64;
export const MAX_VEGA_LITE_JSON_NODES = 50_000;
const TOKEN_OPEN_BRACE = 1;
const TOKEN_CLOSE_BRACE = 2;
const TOKEN_OPEN_BRACKET = 3;
const TOKEN_CLOSE_BRACKET = 4;
const TOKEN_EOF = 17;

export interface VegaLiteSource {
  value: Record<string, unknown>;
  positions: Map<string, SourcePosition>;
}

export interface SourcePosition {
  line: number;
  column: number;
}

export function parseVegaLiteSource(source: string): VegaLiteSource {
  scanDepth(source);
  const parseErrors: ParseError[] = [];
  const tree = parseTree(source, parseErrors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });

  if (parseErrors.length > 0 || tree === undefined) {
    const parseError = parseErrors[0];
    const position = sourcePosition(source, parseError?.offset ?? 0);
    const message =
      parseError === undefined ? 'empty input' : printParseErrorCode(parseError.error);
    throw new VegaLiteError(`invalid Vega-Lite JSON: ${message}`, { ...position, pointer: '' });
  }

  const nodeCount = countNodes(tree);
  if (nodeCount > MAX_VEGA_LITE_JSON_NODES) {
    throw new VegaLiteError(
      `Vega-Lite JSON has too many AST nodes: ${nodeCount} (limit ${MAX_VEGA_LITE_JSON_NODES})`,
      { ...sourcePosition(source, tree.offset), pointer: '' },
    );
  }

  const positions = new Map<string, SourcePosition>();
  const value = convertNode(tree, source, [], positions);
  if (!isRecord(value)) {
    throw new VegaLiteError('Vega-Lite specification must be a JSON object', {
      ...sourcePosition(source, tree.offset),
      pointer: '',
    });
  }
  assertFiniteNumbers(value, source, positions);
  return { value, positions };
}

export function sourcePosition(source: string, offset: number): SourcePosition {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(offset, 0), source.length);
  for (let index = 0; index < end; index += 1) {
    const character = source.charCodeAt(index);
    if (character === 13) {
      if (source.charCodeAt(index + 1) === 10 && index + 1 < end) index += 1;
      line += 1;
      column = 1;
    } else if (character === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function scanDepth(source: string): void {
  const scanner = createScanner(source, false);
  let depth = 0;
  for (;;) {
    const token = scanner.scan();
    if (token === TOKEN_EOF) return;
    if (token === TOKEN_OPEN_BRACE || token === TOKEN_OPEN_BRACKET) {
      depth += 1;
      if (depth > MAX_VEGA_LITE_JSON_DEPTH) {
        throw new VegaLiteError(
          `Vega-Lite JSON is nested too deeply: ${depth} (limit ${MAX_VEGA_LITE_JSON_DEPTH})`,
          sourcePosition(source, scanner.getTokenOffset()),
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
    if (count > MAX_VEGA_LITE_JSON_NODES) return count;
  }
  return count;
}

function convertNode(
  node: JsonNode,
  source: string,
  path: (string | number)[],
  positions: Map<string, SourcePosition>,
): unknown {
  const pointer = toJsonPointer(path);
  positions.set(pointer, sourcePosition(source, node.offset));
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
        if (seen.has(key)) {
          throw new VegaLiteError(`duplicate JSON key at ${toJsonPointer(childPath) || '/'}`, {
            ...sourcePosition(source, keyNode.offset),
            pointer: toJsonPointer(childPath),
          });
        }
        seen.add(key);
        const value = convertNode(valueNode, source, childPath, positions);
        Object.defineProperty(output, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
        positions.set(toJsonPointer(childPath), sourcePosition(source, keyNode.offset));
      }
      return output;
    }
    case 'array':
      return (node.children ?? []).map((child, index) =>
        convertNode(child, source, [...path, index], positions),
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
  source: string,
  positions: Map<string, SourcePosition>,
  path: (string | number)[] = [],
): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    const pointer = toJsonPointer(path);
    throw new VegaLiteError(`non-finite number at ${pointer || '/'}`, {
      ...(positions.get(pointer) ?? sourcePosition(source, 0)),
      pointer,
    });
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, source, positions, [...path, index]));
  } else if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      assertFiniteNumbers(value[key], source, positions, [...path, key]);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
