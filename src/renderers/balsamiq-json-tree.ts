import { createScanner, type Node as JsonNode } from 'jsonc-parser';

import { BalsamiqJsonError } from './balsamiq-json-error.js';

/** Rejects deeply nested JSON before the parser recursively builds the value. */
export function assertJsonDepth(source: string, maxDepth: number): void {
  const scanner = createScanner(source, false);
  let depth = 0;
  for (let token = scanner.scan(); token !== 17; token = scanner.scan()) {
    if (token === 1 || token === 3) {
      depth += 1;
      if (depth > maxDepth) {
        throw new BalsamiqJsonError(
          `Balsamiq JSON nesting exceeds the limit of ${maxDepth}`,
          source,
          scanner.getTokenOffset(),
        );
      }
    } else if (token === 2 || token === 4) {
      depth = Math.max(0, depth - 1);
    }
  }
}

/** Converts a parsed JSON tree while rejecting duplicate keys and unsafe prototypes. */
export function decodeNode(node: JsonNode, source: string): unknown {
  if (node.type === 'array') {
    return (node.children ?? []).map((child) => decodeNode(child, source));
  }
  if (node.type === 'object') {
    const object: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const property of node.children ?? []) {
      const keyNode = property.children?.[0];
      const valueNode = property.children?.[1];
      if (
        keyNode?.type !== 'string' ||
        typeof keyNode.value !== 'string' ||
        valueNode === undefined
      ) {
        throw new BalsamiqJsonError('invalid Balsamiq JSON property', source, property.offset);
      }
      if (Object.hasOwn(object, keyNode.value)) {
        throw new BalsamiqJsonError(
          `duplicate JSON property "${keyNode.value}"`,
          source,
          keyNode.offset,
        );
      }
      object[keyNode.value] = decodeNode(valueNode, source);
    }
    return object;
  }
  return node.value;
}

export function errorAt(
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  message: string,
): BalsamiqJsonError {
  let current: JsonNode | undefined = root;
  for (const segment of path) {
    if (current === undefined) {
      break;
    }
    if (typeof segment === 'number') {
      current = current.children?.[segment];
    } else {
      current = (current.children ?? [])
        .map((property) => property.children)
        .find((parts) => parts?.[0]?.value === segment)?.[1];
    }
  }
  return new BalsamiqJsonError(message, source, current?.offset ?? root.offset);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
