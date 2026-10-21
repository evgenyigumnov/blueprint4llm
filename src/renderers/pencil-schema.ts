import type { Node as JsonNode } from 'jsonc-parser';

import { isRecord, pencilErrorAt } from './pencil-json-error.js';
import { validatePencilNodeProperties } from './pencil-properties.js';

export const MAX_PENCIL_JSON_BYTES = 1024 * 1024;
export const MAX_PENCIL_NODES = 10_000;
export const MAX_PENCIL_DEPTH = 100;
export const PENCIL_SUPPORTED_VERSIONS = ['2.21'] as const;

export type PencilNodeType =
  'frame' | 'group' | 'rectangle' | 'ellipse' | 'polygon' | 'path' | 'text';

export interface PencilNode {
  id: string;
  type: PencilNodeType;
  [property: string]: unknown;
}

export interface PencilDocument {
  version: (typeof PENCIL_SUPPORTED_VERSIONS)[number];
  children: PencilNode[];
}

interface ValidationState {
  ids: Set<string>;
  count: number;
}

/** Checks the document version and converts validated node data to a safe model. */
export function validatePencilDocument(
  value: unknown,
  source: string,
  root: JsonNode,
): PencilDocument {
  if (!isRecord(value)) {
    throw pencilErrorAt(source, root, [], 'Pencil document must be an object');
  }
  rejectUnknownProperties(value, new Set(['version', 'children']), source, root, []);

  const version = value.version;
  if (typeof version !== 'string' || version.trim() === '') {
    throw pencilErrorAt(
      source,
      root,
      ['version'],
      'Pencil document must contain a non-empty string version',
    );
  }
  const supportedVersion = PENCIL_SUPPORTED_VERSIONS.find((supported) => supported === version);
  if (supportedVersion === undefined) {
    throw pencilErrorAt(
      source,
      root,
      ['version'],
      `unsupported Pencil schema version "${version}" (supported: ${PENCIL_SUPPORTED_VERSIONS.join(', ')})`,
    );
  }
  if (!Array.isArray(value.children)) {
    throw pencilErrorAt(
      source,
      root,
      ['children'],
      'Pencil document must contain a children array',
    );
  }

  const state: ValidationState = { ids: new Set(), count: 0 };
  const children = validateChildren(value.children, source, root, ['children'], state, 1);
  return { version: supportedVersion, children };
}

function validateChildren(
  values: unknown[],
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  state: ValidationState,
  depth: number,
): PencilNode[] {
  if (depth > MAX_PENCIL_DEPTH) {
    throw pencilErrorAt(
      source,
      root,
      path,
      `Pencil node nesting exceeds the limit of ${MAX_PENCIL_DEPTH}`,
    );
  }

  const nodes: PencilNode[] = [];
  for (const [index, value] of values.entries()) {
    const nodePath = [...path, index];
    if (!isRecord(value)) {
      throw pencilErrorAt(
        source,
        root,
        nodePath,
        `Pencil node at index ${index + 1} must be an object`,
      );
    }
    const id = value.id;
    if (typeof id !== 'string' || id.trim() === '') {
      throw pencilErrorAt(
        source,
        root,
        [...nodePath, 'id'],
        'Pencil node id must be a non-empty string',
      );
    }
    if (id.includes('/')) {
      throw pencilErrorAt(
        source,
        root,
        [...nodePath, 'id'],
        `Pencil node id "${id}" must not contain "/"`,
      );
    }
    if (state.ids.has(id)) {
      throw pencilErrorAt(
        source,
        root,
        [...nodePath, 'id'],
        `Pencil document contains duplicate node id "${id}"`,
      );
    }
    state.ids.add(id);

    const type = value.type;
    if (typeof type !== 'string' || !isPencilNodeType(type)) {
      throw pencilErrorAt(
        source,
        root,
        [...nodePath, 'type'],
        `Pencil node "${id}" has an unsupported type${typeof type === 'string' ? ` "${type}"` : ''}`,
      );
    }
    state.count += 1;
    if (state.count > MAX_PENCIL_NODES) {
      throw pencilErrorAt(
        source,
        root,
        nodePath,
        `Pencil document has too many nodes (limit ${MAX_PENCIL_NODES})`,
      );
    }

    validatePencilNodeProperties(value, type, source, root, nodePath, id);
    const node = value as PencilNode;
    if (value.children !== undefined) {
      if (type !== 'frame' && type !== 'group') {
        throw pencilErrorAt(
          source,
          root,
          [...nodePath, 'children'],
          `Pencil ${type} node "${id}" cannot contain children`,
        );
      }
      if (!Array.isArray(value.children)) {
        throw pencilErrorAt(
          source,
          root,
          [...nodePath, 'children'],
          `Pencil node "${id}" children must be an array`,
        );
      }
      node.children = validateChildren(
        value.children,
        source,
        root,
        [...nodePath, 'children'],
        state,
        depth + 1,
      );
    }
    nodes.push(node);
  }
  return nodes;
}

function isPencilNodeType(value: string): value is PencilNodeType {
  return ['frame', 'group', 'rectangle', 'ellipse', 'polygon', 'path', 'text'].includes(value);
}

function rejectUnknownProperties(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw pencilErrorAt(
        source,
        root,
        [...path, key],
        `Pencil document has an unsupported property "${key}"`,
      );
    }
  }
}
