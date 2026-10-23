import {
  createScanner,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser';

import { ExcalidrawJsonError } from './excalidraw-json-error.js';
import { MAX_EXCALIDRAW_DEPTH } from './excalidraw-schema.js';

export interface ParsedExcalidrawTree {
  root: JsonNode;
  source: string;
}

/** Parses strict JSON after checking nesting depth and every object's duplicate keys. */
export function parseExcalidrawTree(source: string, signal?: AbortSignal): ParsedExcalidrawTree {
  throwIfAborted(signal);
  assertJsonDepth(source, signal);
  const errors: ParseError[] = [];
  const root = parseTree(source, errors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false,
  });
  throwIfAborted(signal);
  const syntaxError = errors[0];
  if (syntaxError !== undefined) {
    throw new ExcalidrawJsonError(
      `invalid Excalidraw JSON: ${printParseErrorCode(syntaxError.error)}`,
      source,
      syntaxError.offset,
    );
  }
  if (root === undefined) {
    throw new ExcalidrawJsonError('Excalidraw JSON must contain a document', source, 0);
  }
  rejectDuplicateKeys(root, source, '', signal);
  return { root, source };
}

/** Rejects deeply nested JSON before jsonc-parser builds the recursive syntax tree. */
function assertJsonDepth(source: string, signal?: AbortSignal): void {
  const scanner = createScanner(source, false);
  let depth = 0;
  let scanned = 0;
  for (let token = scanner.scan(); token !== 17; token = scanner.scan()) {
    scanned += 1;
    if (scanned % 4096 === 0) {
      throwIfAborted(signal);
    }
    if (token === 1 || token === 3) {
      depth += 1;
      if (depth > MAX_EXCALIDRAW_DEPTH) {
        throw new ExcalidrawJsonError(
          `Excalidraw JSON nesting exceeds the limit of ${MAX_EXCALIDRAW_DEPTH}`,
          source,
          scanner.getTokenOffset(),
        );
      }
    } else if (token === 2 || token === 4) {
      depth = Math.max(0, depth - 1);
    }
  }
}

function rejectDuplicateKeys(
  node: JsonNode,
  source: string,
  pointer: string,
  signal?: AbortSignal,
): void {
  if (node.type === 'object') {
    const names = new Set<string>();
    for (const property of node.children ?? []) {
      const keyNode = property.children?.[0];
      const valueNode = property.children?.[1];
      if (
        keyNode?.type !== 'string' ||
        typeof keyNode.value !== 'string' ||
        valueNode === undefined
      ) {
        throw new ExcalidrawJsonError('invalid Excalidraw JSON property', source, property.offset);
      }
      const key = keyNode.value;
      const childPointer = `${pointer}/${escapePointerSegment(key)}`;
      if (names.has(key)) {
        throw new ExcalidrawJsonError(
          `duplicate JSON property "${key}"`,
          source,
          keyNode.offset,
          childPointer,
        );
      }
      names.add(key);
      rejectDuplicateKeys(valueNode, source, childPointer, signal);
    }
  } else if (node.type === 'array') {
    for (const [index, child] of (node.children ?? []).entries()) {
      if (index % 256 === 0) {
        throwIfAborted(signal);
      }
      rejectDuplicateKeys(child, source, `${pointer}/${index}`, signal);
    }
  }
}

function escapePointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('diagram rendering was aborted');
  }
}
