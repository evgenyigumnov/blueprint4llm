import type { Node as JsonNode, Segment } from 'jsonc-parser';

/** A Pencil input error with a one-based location inside the JSONC source. */
export class PencilJsonError extends Error {
  constructor(message: string, source: string, offset: number) {
    const location = offsetToPosition(source, offset);
    super(message);
    this.name = 'PencilJsonError';
    this.line = location.line;
    this.column = location.column;
  }

  readonly line: number;
  readonly column: number;
}

export function decodeJsonNode(node: JsonNode, source: string): unknown {
  if (node.type === 'array') {
    return (node.children ?? []).map((child) => decodeJsonNode(child, source));
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
        throw new PencilJsonError('invalid Pencil JSONC property', source, property.offset);
      }
      const key = keyNode.value;
      if (Object.hasOwn(object, key)) {
        throw new PencilJsonError(`duplicate JSON property "${key}"`, source, keyNode.offset);
      }
      object[key] = decodeJsonNode(valueNode, source);
    }
    return object;
  }
  return node.value;
}

export function pencilErrorAt(
  source: string,
  root: JsonNode,
  path: Segment[],
  message: string,
): PencilJsonError {
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
  return new PencilJsonError(message, source, current?.offset ?? root.offset);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function offsetToPosition(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(offset, 0), source.length);
  for (let index = 0; index < end; index += 1) {
    const char = source[index];
    if (char === '\r') {
      if (source[index + 1] === '\n' && index + 1 < end) {
        index += 1;
      }
      line += 1;
      column = 1;
    } else if (char === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}
