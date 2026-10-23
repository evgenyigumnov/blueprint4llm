import type { Node as JsonNode } from 'jsonc-parser';

import { getProperty } from './excalidraw-json-fields.js';
import type { ExcalidrawElement } from './excalidraw-schema.js';

/** Collects element references and their JSON offsets for precise diagnostics. */
export function readElementReferences(
  node: JsonNode,
  startBindingId: string | undefined,
  endBindingId: string | undefined,
  containerId: string | undefined,
  frameId: string | undefined,
  boundElementIds: string[],
): ExcalidrawElement['references'] {
  const references: ExcalidrawElement['references'] = [];
  for (const [field, id] of [
    ['startBinding', startBindingId],
    ['endBinding', endBindingId],
    ['containerId', containerId],
    ['frameId', frameId],
  ] as const) {
    if (id === undefined) continue;
    const referenceNode = getProperty(node, field)?.value;
    const idNode =
      field === 'containerId' || referenceNode === undefined
        ? referenceNode
        : (getProperty(referenceNode, 'elementId')?.value ?? referenceNode);
    references.push({ id, offset: idNode?.offset ?? node.offset });
  }
  const bound = getProperty(node, 'boundElements')?.value;
  for (const [index, id] of boundElementIds.entries()) {
    const idNode = bound?.children?.[index];
    const valueNode = idNode === undefined ? undefined : getProperty(idNode, 'id')?.value;
    references.push({ id, offset: valueNode?.offset ?? idNode?.offset ?? node.offset });
  }
  return references;
}
