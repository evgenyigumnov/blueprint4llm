import type { Node as JsonNode } from 'jsonc-parser';

import { ExcalidrawJsonError } from './excalidraw-json-error.js';

export function numberValue(node: JsonNode): number | undefined {
  return node.type === 'number' && typeof node.value === 'number' && Number.isFinite(node.value)
    ? node.value
    : undefined;
}

export function stringValue(node: JsonNode): string | undefined {
  return node.type === 'string' && typeof node.value === 'string' ? node.value : undefined;
}

export function assertXmlSafeString(
  source: string,
  node: JsonNode,
  pointer: string,
  value: string,
): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const forbiddenControl =
      codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d;
    const forbiddenXmlCharacter =
      (codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint === 0xfffe || codePoint === 0xffff;
    if (forbiddenControl || forbiddenXmlCharacter) {
      throw errorAt(
        source,
        node,
        pointer,
        'string contains a character that cannot be represented in SVG',
      );
    }
  }
}

export function errorAt(
  source: string,
  node: JsonNode,
  pointer: string,
  message: string,
): ExcalidrawJsonError {
  return new ExcalidrawJsonError(message, source, node.offset, pointer);
}
