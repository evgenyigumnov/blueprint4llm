import { fromHtml } from 'hast-util-from-html';
import type { Element, RootContent } from 'hast';

import type { DiagramError } from './types.js';

const PLANTUML_ERROR_MARKER =
  /Syntax Error\?|No diagram found|No description found|Error found in diagram/i;

/** Extracts the error message and source line included in PlantUML's error SVG. */
export function parsePlantUmlSvgErrors(svg: string): DiagramError[] {
  const tree = fromHtml(svg, { fragment: true });
  const textNodes = collectTextNodes(tree.children);
  const errorText = findErrorMarker(tree.children);
  if (errorText === undefined) {
    return [];
  }

  const sourceLocation = textNodes.join('\n').match(/\[From [^\]]*\(line\s+(\d+)\)\s*\]/i);
  const line = sourceLocation?.[1] === undefined ? undefined : Number(sourceLocation[1]);
  return [
    {
      message: errorText.trim(),
      ...(line === undefined || !Number.isFinite(line) ? {} : { line }),
    },
  ];
}

function findErrorMarker(nodes: readonly RootContent[]): string | undefined {
  for (const node of nodes) {
    if (node.type !== 'element') {
      continue;
    }
    const text = collectTextNodes(node.children).join('');
    if (
      node.tagName.toLowerCase() === 'text' &&
      isPlantUmlErrorColor(node) &&
      PLANTUML_ERROR_MARKER.test(text)
    ) {
      return text;
    }
    const nested = findErrorMarker(node.children);
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

function isPlantUmlErrorColor(node: Element): boolean {
  const fill = node.properties.fill;
  return typeof fill === 'string' && /^(?:#ff0000|red)$/i.test(fill.trim());
}

/** Preserves diagnostics emitted when the engine denies a file or library include. */
export function parsePlantUmlConsoleErrors(messages: readonly string[]): DiagramError[] {
  return messages
    .filter((message) => /cannot include|cannot load|failed to load|disabled/i.test(message))
    .map((message) => ({ message: message.replace(/^PlantUML:\s*/i, '').trim() }));
}

function collectTextNodes(nodes: readonly RootContent[]): string[] {
  const text: string[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      text.push(node.value);
    } else if (node.type === 'element') {
      text.push(...collectTextNodes(node.children));
    }
  }
  return text;
}
