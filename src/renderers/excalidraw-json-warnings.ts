import type { Node as JsonNode } from 'jsonc-parser';

import { offsetToPosition } from './excalidraw-json-error.js';
import { getProperty } from './excalidraw-json-fields.js';
import { isSupportedShapeType, type ExcalidrawElement } from './excalidraw-schema.js';
import type { DiagramWarning } from './types.js';

interface AggregatedWarning {
  count: number;
  id: string;
  offset: number;
  pointer: string;
  message?: string;
}

/** Collects and formats warnings while keeping only each kind's first source position. */
export class ExcalidrawWarningCollector {
  private readonly warnings = new Map<string, AggregatedWarning>();

  addElement(node: JsonNode, element: ExcalidrawElement): void {
    const { id, jsonPointer: pointer } = element;
    const fieldOffset = (field: string) => getProperty(node, field)?.value.offset ?? node.offset;
    if (element.isDeleted) return;
    if (element.roughness > 0) {
      this.add('roughness', id, fieldOffset('roughness'), `${pointer}/roughness`);
    }
    if (element.fillStyle !== 'solid') {
      this.add(`fill:${element.fillStyle}`, id, fieldOffset('fillStyle'), `${pointer}/fillStyle`);
    }
    if (element.roundness !== null) {
      this.add('roundness', id, fieldOffset('roundness'), `${pointer}/roundness`);
    }
    if (element.type === 'text' && element.fontFamily !== 2) {
      this.add(
        `font:${element.fontFamily}`,
        id,
        fieldOffset('fontFamily'),
        `${pointer}/fontFamily`,
      );
    }
    if (element.link !== undefined && element.link !== '') {
      this.add('link', id, fieldOffset('link'), `${pointer}/link`);
    }
    if (element.type === 'frame' || element.type === 'magicframe') {
      this.add('frame-no-clip', id, node.offset, pointer);
    }
    if (element.type === 'arrow' && element.elbowed) {
      this.add('elbowed-arrow', id, fieldOffset('elbowed'), `${pointer}/elbowed`);
      return;
    }
    if (!isSupportedShapeType(element.type)) {
      this.add(`unsupported:${element.type}`, id, node.offset, pointer);
      return;
    }
    if (
      element.points !== undefined &&
      element.points.every(
        ({ x, y }) => x === element.points?.[0]?.x && y === element.points?.[0]?.y,
      )
    ) {
      this.add('degenerate-path', id, fieldOffset('points'), `${pointer}/points`);
    }
    for (const field of ['startArrowhead', 'endArrowhead'] as const) {
      const head = element[field];
      if (head !== undefined && head !== null && head !== 'arrow' && head !== 'triangle') {
        this.add(`arrowhead:${head}`, id, fieldOffset(field), `${pointer}/${field}`);
      }
    }
  }

  addReferences(elements: ExcalidrawElement[], elementsById: Map<string, ExcalidrawElement>): void {
    for (const element of elements) {
      if (element.isDeleted) continue;
      for (const reference of element.references) {
        const target = elementsById.get(reference.id);
        if (target === undefined || target.isDeleted) {
          this.add(
            `missing-reference:${element.id}:${reference.id}`,
            element.id,
            reference.offset,
            element.jsonPointer,
            `element "${element.id}" refers to missing or deleted element "${reference.id}"; saved geometry is kept`,
          );
        }
      }
    }
  }

  addEmptyScene(offset: number): void {
    this.add('empty-scene', 'scene', offset, '/elements');
  }

  toWarnings(source: string): DiagramWarning[] {
    return [...this.warnings.entries()].map(([kind, warning]) => {
      const position = offsetToPosition(source, warning.offset);
      return { message: this.formatMessage(kind, warning), ...position };
    });
  }

  private add(key: string, id: string, offset: number, pointer: string, message?: string): void {
    const current = this.warnings.get(key);
    if (current !== undefined) {
      current.count += 1;
      return;
    }
    const warning: AggregatedWarning = { count: 1, id, offset, pointer };
    if (message !== undefined) warning.message = message;
    this.warnings.set(key, warning);
  }

  private formatMessage(kind: string, warning: AggregatedWarning): string {
    if (warning.message !== undefined) {
      return warning.message;
    }
    if (kind === 'roughness') {
      return `roughness is rendered as a smooth outline for ${warning.count} element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    if (kind.startsWith('fill:')) {
      return `fill style "${kind.slice(5)}" is rendered as a solid fill for ${warning.count} element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    if (kind === 'roundness') {
      return `roundness is rendered with sharp corners for ${warning.count} element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    if (kind.startsWith('font:')) {
      return `Excalidraw font family ${kind.slice(5)} is replaced with sans-serif for ${warning.count} text element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    if (kind === 'link') {
      return `links are not active in the static SVG for ${warning.count} element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    if (kind === 'frame-no-clip')
      return `frame "${warning.id}" is shown without clipping its children`;
    if (kind === 'degenerate-path') {
      return `line "${warning.id}" has identical points and is rendered as a point without arrowheads`;
    }
    if (kind === 'empty-scene') return 'empty Excalidraw scene; a placeholder is shown';
    if (kind === 'elbowed-arrow') {
      return `arrow "${warning.id}" uses elbow routing and is shown as a placeholder`;
    }
    if (kind.startsWith('unsupported:')) {
      const type = kind.slice('unsupported:'.length);
      return `unsupported element type "${type}" is shown as a placeholder for ${warning.count} element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    if (kind.startsWith('arrowhead:')) {
      return `arrowhead "${kind.slice('arrowhead:'.length)}" is replaced with "arrow" for ${warning.count} element${plural(warning.count)} (first ID "${warning.id}")`;
    }
    return `element "${warning.id}" uses an unsupported Excalidraw feature`;
  }
}

function plural(count: number): string {
  return count === 1 ? '' : 's';
}
