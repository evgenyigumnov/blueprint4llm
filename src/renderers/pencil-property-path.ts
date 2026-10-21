import type { Node as JsonNode } from 'jsonc-parser';

import { pencilErrorAt } from './pencil-json-error.js';

const MAX_PENCIL_PROPERTY_SIDE = 16_384;

/** Checks SVG path data and its optional source coordinate box. */
export function validatePencilPath(
  node: Record<string, unknown>,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  if (typeof node.geometry !== 'string' || node.geometry.trim() === '') {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'geometry'],
      `Pencil path node "${id}" must specify geometry`,
    );
  }
  if (
    !/^\s*[Mm]/.test(node.geometry) ||
    !/^[\s\d.,+\-eEmMzZlLhHvVcCsSqQtTaA]+$/.test(node.geometry)
  ) {
    throw pencilErrorAt(
      source,
      root,
      [...path, 'geometry'],
      `Pencil node "${id}" geometry must contain SVG path commands and numbers only`,
    );
  }
  if (node.viewBox !== undefined) {
    validatePathViewBox(node.viewBox, source, root, [...path, 'viewBox'], id);
  }
}

function validatePathViewBox(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): void {
  if (!Array.isArray(value) || value.length !== 4) {
    throw pencilErrorAt(
      source,
      root,
      path,
      `Pencil node "${id}" viewBox must contain x, y, width, and height`,
    );
  }
  value.forEach((part, index) => {
    if (typeof part !== 'number' || !Number.isFinite(part)) {
      throw pencilErrorAt(
        source,
        root,
        [...path, index],
        `Pencil node "${id}" viewBox must contain finite numbers`,
      );
    }
  });
  const width = value[2] as number;
  const height = value[3] as number;
  if (width <= 0 || height <= 0) {
    throw pencilErrorAt(
      source,
      root,
      path,
      `Pencil node "${id}" viewBox width and height must be greater than 0`,
    );
  }
  if (
    value.some((part) => Math.abs(part as number) > MAX_PENCIL_PROPERTY_SIDE) ||
    width < 0.001 ||
    height < 0.001
  ) {
    throw pencilErrorAt(
      source,
      root,
      path,
      `Pencil node "${id}" viewBox values must be within ±${MAX_PENCIL_PROPERTY_SIDE} and dimensions must be at least 0.001`,
    );
  }
}
