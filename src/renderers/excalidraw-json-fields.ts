import type { Node as JsonNode } from 'jsonc-parser';

import {
  assertXmlSafeString,
  errorAt,
  numberValue,
  stringValue,
} from './excalidraw-json-values.js';
import {
  MAX_EXCALIDRAW_GROUP_IDS,
  MAX_EXCALIDRAW_NUMBER,
  MAX_EXCALIDRAW_POINTS_PER_ELEMENT,
  type ExcalidrawArrowhead,
  type ExcalidrawElement,
  type ExcalidrawStrokeStyle,
  type ExcalidrawTextAlign,
} from './excalidraw-schema.js';

export interface Property {
  value: JsonNode;
  key: JsonNode;
}

const COLOR_PATTERN = /^(?:transparent|#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8})$/i;

export function parseBackgroundColor(source: string, root: JsonNode): string {
  const appState = getProperty(root, 'appState')?.value;
  if (appState === undefined) {
    return '#ffffff';
  }
  if (appState.type !== 'object') {
    throw errorAt(source, appState, '/appState', 'appState must be an object');
  }
  const background = getProperty(appState, 'viewBackgroundColor')?.value;
  if (background === undefined) {
    return '#ffffff';
  }
  const color = stringValue(background);
  if (color === undefined || !COLOR_PATTERN.test(color)) {
    throw errorAt(
      source,
      background,
      '/appState/viewBackgroundColor',
      'viewBackgroundColor must be a supported hex color or "transparent"',
    );
  }
  return color.toLowerCase();
}

export function validateOptionalObjects(source: string, root: JsonNode): void {
  const files = getProperty(root, 'files')?.value;
  if (files !== undefined && files.type !== 'object') {
    throw errorAt(source, files, '/files', 'files must be an object');
  }
}

export function readPoints(
  source: string,
  node: JsonNode,
  pointer: string,
  addPointCount: (count: number) => void,
): ExcalidrawElement['points'] {
  const property = getProperty(node, 'points');
  if (property === undefined) {
    return undefined;
  }
  if (property.value.type !== 'array') {
    throw errorAt(source, property.value, `${pointer}/points`, 'points must be an array');
  }
  const pointNodes = property.value.children ?? [];
  if (pointNodes.length < 2) {
    throw errorAt(
      source,
      property.value,
      `${pointer}/points`,
      'points must contain at least two coordinate pairs',
    );
  }
  if (pointNodes.length > MAX_EXCALIDRAW_POINTS_PER_ELEMENT) {
    throw errorAt(
      source,
      property.value,
      `${pointer}/points`,
      `points exceed the per-element limit of ${MAX_EXCALIDRAW_POINTS_PER_ELEMENT}`,
    );
  }
  addPointCount(pointNodes.length);
  const points = pointNodes.map((pointNode, index) => {
    const pointPointer = `${pointer}/points/${index}`;
    if (pointNode.type !== 'array' || (pointNode.children ?? []).length !== 2) {
      throw errorAt(source, pointNode, pointPointer, 'each point must be a [x, y] pair');
    }
    const pair = pointNode.children ?? [];
    return {
      x: readPointCoordinate(source, pair[0]!, `${pointPointer}/0`),
      y: readPointCoordinate(source, pair[1]!, `${pointPointer}/1`),
    };
  });
  return points;
}

export function readPointCoordinate(source: string, node: JsonNode, pointer: string): number {
  const value = numberValue(node);
  if (value === undefined || Math.abs(value) > MAX_EXCALIDRAW_NUMBER) {
    throw errorAt(
      source,
      node,
      pointer,
      `coordinate must be a finite number between -${MAX_EXCALIDRAW_NUMBER} and ${MAX_EXCALIDRAW_NUMBER}`,
    );
  }
  return value;
}

export function readGroupIds(source: string, node: JsonNode, pointer: string): string[] {
  const property = getProperty(node, 'groupIds');
  if (property === undefined) {
    return [];
  }
  if (property.value.type !== 'array') {
    throw errorAt(
      source,
      property.value,
      `${pointer}/groupIds`,
      'groupIds must be an array of strings',
    );
  }
  const groups = property.value.children ?? [];
  if (groups.length > MAX_EXCALIDRAW_GROUP_IDS) {
    throw errorAt(
      source,
      property.value,
      `${pointer}/groupIds`,
      `groupIds exceed the limit of ${MAX_EXCALIDRAW_GROUP_IDS}`,
    );
  }
  return groups.map((group, index) => {
    const value = stringValue(group);
    if (value === undefined || value.trim() === '') {
      throw errorAt(
        source,
        group,
        `${pointer}/groupIds/${index}`,
        'group ID must be a non-empty string',
      );
    }
    assertXmlSafeString(source, group, `${pointer}/groupIds/${index}`, value);
    return value;
  });
}

export function readStrokeStyle(
  source: string,
  node: JsonNode,
  pointer: string,
): ExcalidrawStrokeStyle {
  const value = readString(source, node, pointer, 'strokeStyle', 'solid');
  if (value !== 'solid' && value !== 'dashed' && value !== 'dotted') {
    throw errorAt(
      source,
      getProperty(node, 'strokeStyle')?.value ?? node,
      `${pointer}/strokeStyle`,
      'strokeStyle must be solid, dashed, or dotted',
    );
  }
  return value;
}

export function readTextAlign(
  source: string,
  node: JsonNode,
  pointer: string,
): ExcalidrawTextAlign {
  const value = readString(source, node, pointer, 'textAlign', 'left');
  if (value !== 'left' && value !== 'center' && value !== 'right') {
    throw errorAt(
      source,
      getProperty(node, 'textAlign')?.value ?? node,
      `${pointer}/textAlign`,
      'textAlign must be left, center, or right',
    );
  }
  return value;
}

export function readArrowhead(
  source: string,
  node: JsonNode,
  pointer: string,
  field: 'startArrowhead' | 'endArrowhead',
): ExcalidrawArrowhead | undefined {
  const property = getProperty(node, field);
  if (property === undefined) {
    return undefined;
  }
  if (property.value.type === 'null') {
    return null;
  }
  const value = stringValue(property.value);
  if (value === undefined || value === '') {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be a string or null`,
    );
  }
  return value as ExcalidrawArrowhead;
}

export function readBindingId(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): string | undefined {
  const property = getProperty(node, field);
  if (property === undefined || property.value.type === 'null') {
    return undefined;
  }
  if (property.value.type !== 'object') {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be an object or null`,
    );
  }
  return requiredString(source, property.value, `${pointer}/${field}`, 'elementId');
}

export function readNullableId(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): string | undefined {
  const property = getProperty(node, field);
  if (property === undefined || property.value.type === 'null') {
    return undefined;
  }
  const value = stringValue(property.value);
  if (value === undefined || value.trim() === '') {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be a non-empty string or null`,
    );
  }
  assertXmlSafeString(source, property.value, `${pointer}/${field}`, value);
  return value;
}

export function readBoundElementIds(source: string, node: JsonNode, pointer: string): string[] {
  const property = getProperty(node, 'boundElements');
  if (property === undefined || property.value.type === 'null') {
    return [];
  }
  if (property.value.type !== 'array') {
    throw errorAt(
      source,
      property.value,
      `${pointer}/boundElements`,
      'boundElements must be an array or null',
    );
  }
  return (property.value.children ?? []).map((bound, index) => {
    const boundPointer = `${pointer}/boundElements/${index}`;
    if (bound.type !== 'object') {
      throw errorAt(source, bound, boundPointer, 'bound element must be an object');
    }
    return requiredString(source, bound, boundPointer, 'id');
  });
}

export function readNullableString(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): string | undefined {
  const property = getProperty(node, field);
  if (property === undefined || property.value.type === 'null') {
    return undefined;
  }
  const value = stringValue(property.value);
  if (value === undefined) {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be a string or null`,
    );
  }
  return value;
}

export function readColor(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
  fallback: string,
): string {
  const property = getProperty(node, field);
  if (property === undefined) {
    return fallback;
  }
  const value = stringValue(property.value);
  if (value === undefined || !COLOR_PATTERN.test(value)) {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be a hex color or "transparent"`,
    );
  }
  return value.toLowerCase();
}

export function readRoughness(source: string, node: JsonNode, pointer: string): number {
  const value = readNumber(source, node, pointer, 'roughness', 0, 0, 2, false);
  if (value !== 0 && value !== 1 && value !== 2) {
    throw errorAt(
      source,
      getProperty(node, 'roughness')?.value ?? node,
      `${pointer}/roughness`,
      'roughness must be 0, 1, or 2',
    );
  }
  return value;
}

export function readNumber(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
  fallback: number,
  min: number,
  max: number,
  required: boolean,
): number {
  const property = getProperty(node, field);
  if (property === undefined) {
    if (required) {
      throw errorAt(source, node, `${pointer}/${field}`, `${field} must be a finite number`);
    }
    return fallback;
  }
  const value = numberValue(property.value);
  if (value === undefined || value < min || value > max) {
    const range = min < 0 ? `between ${min} and ${max}` : `between ${min} and ${max}`;
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be a finite number ${range}`,
    );
  }
  return value;
}

export function readBoolean(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
  fallback: boolean,
): boolean {
  const property = getProperty(node, field);
  if (property === undefined) {
    return fallback;
  }
  if (property.value.type !== 'boolean' || typeof property.value.value !== 'boolean') {
    throw errorAt(source, property.value, `${pointer}/${field}`, `${field} must be a boolean`);
  }
  return property.value.value;
}

export function readString(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
  fallback: string,
): string {
  const property = getProperty(node, field);
  if (property === undefined) {
    return fallback;
  }
  const value = stringValue(property.value);
  if (value === undefined) {
    throw errorAt(source, property.value, `${pointer}/${field}`, `${field} must be a string`);
  }
  return value;
}

export function requiredString(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): string {
  const property = requiredField(source, node, pointer, field);
  const value = stringValue(property.value);
  if (value === undefined) {
    throw errorAt(source, property.value, `${pointer}/${field}`, `${field} must be a string`);
  }
  return value;
}

export function requiredNumber(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): number {
  const property = requiredField(source, node, pointer, field);
  const value = numberValue(property.value);
  if (value === undefined) {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be a finite number`,
    );
  }
  return value;
}

export function requiredField(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): Property {
  const property = getProperty(node, field);
  if (property === undefined) {
    throw errorAt(source, node, `${pointer}/${field}`, `missing required field "${field}"`);
  }
  return property;
}

export function requiredProperty(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
): JsonNode {
  return requiredField(source, node, pointer, field).value;
}

export function getProperty(node: JsonNode, name: string): Property | undefined {
  for (const property of node.children ?? []) {
    const key = property.children?.[0];
    const value = property.children?.[1];
    if (key?.value === name && value !== undefined) {
      return { key, value };
    }
  }
  return undefined;
}

export function readOpaqueJsonValue(
  source: string,
  node: JsonNode,
  pointer: string,
  field: string,
  fallback: unknown,
): unknown {
  const property = getProperty(node, field);
  if (property === undefined || property.value.type === 'null') {
    return fallback;
  }
  if (property.value.type !== 'object') {
    throw errorAt(
      source,
      property.value,
      `${pointer}/${field}`,
      `${field} must be an object or null`,
    );
  }
  return { present: true };
}
