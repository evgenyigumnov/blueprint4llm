import type { Node as JsonNode } from 'jsonc-parser';

import { pencilErrorAt } from './pencil-json-error.js';

/** Allows one solid color fill or stroke in string or schema-object form. */
export function validatePencilPaint(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  description: string,
): void {
  if (typeof value === 'string') {
    validateColor(value, source, root, path, description);
    return;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const paint = value as Record<string, unknown>;
    if (paint.type !== 'color') {
      throw pencilErrorAt(
        source,
        root,
        [...path, 'type'],
        `${description} supports only solid color paints`,
      );
    }
    const allowed = new Set(['type', 'color', 'enabled']);
    for (const key of Object.keys(paint)) {
      if (!allowed.has(key)) {
        throw pencilErrorAt(
          source,
          root,
          [...path, key],
          `${description} has an unsupported paint property "${key}"`,
        );
      }
    }
    if (paint.enabled !== undefined && typeof paint.enabled !== 'boolean') {
      throw pencilErrorAt(
        source,
        root,
        [...path, 'enabled'],
        `${description} enabled must be a boolean`,
      );
    }
    validateColor(paint.color, source, root, [...path, 'color'], description);
    return;
  }
  throw pencilErrorAt(source, root, path, `${description} must be a solid hex color or "none"`);
}

function validateColor(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  description: string,
): void {
  if (
    typeof value !== 'string' ||
    (value !== 'none' && !/^#[\da-f]{3}(?:[\da-f]{3}|[\da-f]{5})?$/i.test(value))
  ) {
    throw pencilErrorAt(source, root, path, `${description} must be a solid hex color or "none"`);
  }
}
