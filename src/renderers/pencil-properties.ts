import type { Node as JsonNode } from 'jsonc-parser';

import { pencilErrorAt } from './pencil-json-error.js';
import { validatePencilPaint } from './pencil-property-paint.js';
import { validatePencilPath } from './pencil-property-path.js';
import type { PencilNodeType } from './pencil-schema.js';

const MAX_PENCIL_PROPERTY_SIDE = 16_384;
const MAX_PENCIL_POLYGON_COUNT = 256;

const COMMON_PROPERTIES = new Set([
  'id',
  'type',
  'x',
  'y',
  'width',
  'height',
  'enabled',
  'opacity',
  'rotation',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
]);

const NODE_PROPERTIES: Record<PencilNodeType, ReadonlySet<string>> = {
  frame: new Set([
    ...COMMON_PROPERTIES,
    'children',
    'layout',
    'gap',
    'padding',
    'justifyContent',
    'alignItems',
    'clip',
    'cornerRadius',
  ]),
  group: new Set([
    ...COMMON_PROPERTIES,
    'children',
    'layout',
    'gap',
    'padding',
    'justifyContent',
    'alignItems',
  ]),
  rectangle: new Set([...COMMON_PROPERTIES, 'cornerRadius']),
  ellipse: COMMON_PROPERTIES,
  polygon: new Set([...COMMON_PROPERTIES, 'polygonCount']),
  path: new Set([...COMMON_PROPERTIES, 'geometry', 'viewBox', 'fillRule']),
  text: new Set([
    ...COMMON_PROPERTIES,
    'content',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'textAlign',
    'textAlignVertical',
    'textGrowth',
    'letterSpacing',
    'lineHeight',
    'underline',
    'strikethrough',
  ]),
};

export function validatePencilNodeProperties(
  node: Record<string, unknown>,
  type: PencilNodeType,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  for (const key of Object.keys(node)) {
    if (!NODE_PROPERTIES[type].has(key)) {
      throw pencilErrorAt(
        source,
        root,
        [...path, key],
        `Pencil node "${id}" has an unsupported property "${key}"`,
      );
    }
  }

  for (const key of ['x', 'y', 'rotation', 'letterSpacing'] as const) {
    if (node[key] !== undefined) {
      requireFiniteNumber(node[key], source, root, [...path, key], `Pencil node "${id}" ${key}`);
    }
  }
  for (const key of ['width', 'height', 'fontSize', 'lineHeight'] as const) {
    if (node[key] !== undefined) {
      const value = requirePositiveNumber(
        node[key],
        source,
        root,
        [...path, key],
        `Pencil node "${id}" ${key}`,
      );
      if ((key === 'fontSize' || key === 'lineHeight') && value > MAX_PENCIL_PROPERTY_SIDE) {
        throw pencilErrorAt(
          source,
          root,
          [...path, key],
          `Pencil node "${id}" ${key} exceeds ${MAX_PENCIL_PROPERTY_SIDE}`,
        );
      }
    }
  }
  if (node.opacity !== undefined) {
    const opacity = requireFiniteNumber(
      node.opacity,
      source,
      root,
      [...path, 'opacity'],
      `Pencil node "${id}" opacity`,
    );
    if (opacity < 0 || opacity > 1) {
      throw pencilErrorAt(
        source,
        root,
        [...path, 'opacity'],
        `Pencil node "${id}" opacity must be between 0 and 1`,
      );
    }
  }
  if (node.enabled !== undefined && typeof node.enabled !== 'boolean') {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'enabled'],
      `Pencil node "${id}" enabled must be a boolean`,
    );
  }
  for (const key of ['fill', 'stroke'] as const) {
    if (node[key] !== undefined) {
      validatePencilPaint(node[key], source, root, [...path, key], `Pencil node "${id}" ${key}`);
    }
  }
  if (node.strokeWidth !== undefined) {
    const strokeWidth = requireNonNegativeNumber(
      node.strokeWidth,
      source,
      root,
      [...path, 'strokeWidth'],
      `Pencil node "${id}" strokeWidth`,
    );
    if (strokeWidth > MAX_PENCIL_PROPERTY_SIDE) {
      throw pencilErrorAt(
        source,
        root,
        [...path, 'strokeWidth'],
        `Pencil node "${id}" strokeWidth exceeds ${MAX_PENCIL_PROPERTY_SIDE}`,
      );
    }
  }
  validateEnum(node, 'strokeLinecap', ['butt', 'round', 'square'], source, root, path, id);
  validateEnum(node, 'strokeLinejoin', ['miter', 'bevel', 'round'], source, root, path, id);

  if (node.cornerRadius !== undefined) {
    validateCornerRadius(node.cornerRadius, source, root, [...path, 'cornerRadius'], id);
  }
  validateEnum(node, 'layout', ['none', 'horizontal', 'vertical'], source, root, path, id);
  for (const key of ['gap', 'padding'] as const) {
    if (node[key] !== undefined) {
      validateSpacing(node[key], key, source, root, [...path, key], id);
    }
  }
  validateEnum(
    node,
    'justifyContent',
    ['start', 'center', 'end', 'space_between', 'space_around'],
    source,
    root,
    path,
    id,
  );
  validateEnum(node, 'alignItems', ['start', 'center', 'end'], source, root, path, id);
  if (node.clip !== undefined && typeof node.clip !== 'boolean') {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'clip'],
      `Pencil node "${id}" clip must be a boolean`,
    );
  }
  if (node.polygonCount !== undefined) {
    const count = requirePositiveNumber(
      node.polygonCount,
      source,
      root,
      [...path, 'polygonCount'],
      `Pencil node "${id}" polygonCount`,
    );
    if (!Number.isInteger(count) || count < 3) {
      throw pencilErrorAt(
        source,
        root,
        [...path, 'polygonCount'],
        `Pencil node "${id}" polygonCount must be an integer of at least 3`,
      );
    }
    if (count > MAX_PENCIL_POLYGON_COUNT) {
      throw pencilErrorAt(
        source,
        root,
        [...path, 'polygonCount'],
        `Pencil node "${id}" polygonCount exceeds ${MAX_PENCIL_POLYGON_COUNT}`,
      );
    }
  }
  if (type === 'path') {
    validatePencilPath(node, source, root, path, id);
  }
  validateEnum(node, 'fillRule', ['nonzero', 'evenodd'], source, root, path, id);

  if (type === 'text') {
    validateTextProperties(node, source, root, path, id);
  }
}

function validateCornerRadius(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  const description = `Pencil node "${id}" cornerRadius`;
  if (Array.isArray(value)) {
    if (value.length !== 4) {
      throw pencilErrorAt(source, root, path, `${description} must be a number or a 4-item array`);
    }
    value.forEach((radius, index) =>
      requireNonNegativeNumber(radius, source, root, [...path, index], description),
    );
  } else {
    requireNonNegativeNumber(value, source, root, path, description);
  }
}

function validateTextProperties(
  node: Record<string, unknown>,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 16;
  const lineHeight = typeof node.lineHeight === 'number' ? node.lineHeight : 1.2;
  if (fontSize * lineHeight > MAX_PENCIL_PROPERTY_SIDE) {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'lineHeight'],
      `Pencil node "${id}" fontSize × lineHeight exceeds ${MAX_PENCIL_PROPERTY_SIDE}`,
    );
  }
  if (node.content !== undefined && typeof node.content !== 'string') {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'content'],
      `Pencil node "${id}" content must be a string`,
    );
  }
  if (node.fontFamily !== undefined && typeof node.fontFamily !== 'string') {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'fontFamily'],
      `Pencil node "${id}" fontFamily must be a string`,
    );
  }
  if (node.fontWeight !== undefined && !isFontWeight(node.fontWeight)) {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'fontWeight'],
      `Pencil node "${id}" fontWeight is invalid`,
    );
  }
  validateEnum(node, 'fontStyle', ['normal', 'italic', 'oblique'], source, root, path, id);
  validateEnum(node, 'textAlign', ['left', 'center', 'right', 'justify'], source, root, path, id);
  validateEnum(node, 'textAlignVertical', ['top', 'middle', 'bottom'], source, root, path, id);
  validateEnum(
    node,
    'textGrowth',
    ['auto', 'fixed-width', 'fixed-width-height'],
    source,
    root,
    path,
    id,
  );
  for (const key of ['underline', 'strikethrough'] as const) {
    if (node[key] !== undefined && typeof node[key] !== 'boolean') {
      throw pencilErrorAt(
        source,
        root,
        [...path, key],
        `Pencil node "${id}" ${key} must be a boolean`,
      );
    }
  }
}

function validateSpacing(
  value: unknown,
  key: 'gap' | 'padding',
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  const description = `Pencil node "${id}" ${key}`;
  if (Array.isArray(value)) {
    if (key !== 'padding' || (value.length !== 2 && value.length !== 4)) {
      throw pencilErrorAt(
        source,
        root,
        path,
        `${description} must be a number or a 2- or 4-item array`,
      );
    }
    value.forEach((item, index) =>
      requireNonNegativeNumber(item, source, root, [...path, index], description),
    );
  } else {
    requireNonNegativeNumber(value, source, root, path, description);
  }
}

function validateEnum(
  node: Record<string, unknown>,
  key: string,
  values: readonly string[],
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  const value = node[key];
  if (value !== undefined && (typeof value !== 'string' || !values.includes(value))) {
    throw pencilErrorAt(
      source,
      root,
      [...path, key],
      `Pencil node "${id}" ${key} must be ${values.join(', ')}`,
    );
  }
}

function requireFiniteNumber(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  description: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw pencilErrorAt(source, root, path, `${description} must be a finite number`);
  }
  return value;
}

function requirePositiveNumber(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  description: string,
): number {
  const number = requireFiniteNumber(value, source, root, path, description);
  if (number <= 0) {
    throw pencilErrorAt(source, root, path, `${description} must be greater than 0`);
  }
  return number;
}

function requireNonNegativeNumber(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  description: string,
): number {
  const number = requireFiniteNumber(value, source, root, path, description);
  if (number < 0) {
    throw pencilErrorAt(source, root, path, `${description} must not be negative`);
  }
  return number;
}

function isFontWeight(value: unknown): boolean {
  return (
    (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 1000) ||
    (typeof value === 'string' && /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(value))
  );
}
