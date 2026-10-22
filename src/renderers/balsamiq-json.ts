import {
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser';

import { BalsamiqJsonError } from './balsamiq-json-error.js';
import { assertJsonDepth, decodeNode, errorAt, isRecord } from './balsamiq-json-tree.js';

export const MAX_BALSAMIQ_JSON_BYTES = 256 * 1024;
export const MAX_BALSAMIQ_CONTROLS = 3_000;
export const MAX_BALSAMIQ_DEPTH = 100;
export const MAX_BALSAMIQ_CANVAS_SIDE = 4_056;

export const BALSAMIQ_CONTROL_TYPES = [
  'Canvas',
  'Label',
  'Title',
  'SubTitle',
  'Paragraph',
  'TextInput',
  'TextArea',
  'Button',
  'CheckBox',
  'RadioButton',
  'ComboBox',
  'List',
  'Rectangle',
  'Line',
] as const;

export type BalsamiqControlType = (typeof BALSAMIQ_CONTROL_TYPES)[number];
export type BalsamiqTextAlign = 'left' | 'center' | 'right';

export interface BalsamiqProperties {
  text?: string;
  color?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: BalsamiqTextAlign;
  checked?: boolean;
  selected?: boolean;
}

export interface BalsamiqControl {
  id: string;
  type: BalsamiqControlType;
  x: number;
  y: number;
  width: number;
  height: number;
  zOrder: number;
  properties: BalsamiqProperties;
  order: number;
}

export interface BalsamiqMockup {
  width: number;
  height: number;
  controls: BalsamiqControl[];
  canvas?: BalsamiqControl;
}

/** Parses, validates, and normalizes one Balsamiq Mockups 3 JSON wireframe. */
export function parseBalsamiqJson(source: string): BalsamiqMockup {
  const byteLength = Buffer.byteLength(source, 'utf8');
  if (byteLength > MAX_BALSAMIQ_JSON_BYTES) {
    throw new BalsamiqJsonError(
      `Balsamiq JSON is too large: ${byteLength} bytes (limit ${MAX_BALSAMIQ_JSON_BYTES} bytes)`,
      source,
      0,
    );
  }

  assertJsonDepth(source, MAX_BALSAMIQ_DEPTH);
  const parseErrors: ParseError[] = [];
  const root = parseTree(source, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false,
  });
  const parseError = parseErrors[0];
  if (parseError !== undefined) {
    throw new BalsamiqJsonError(
      `invalid Balsamiq JSON: ${printParseErrorCode(parseError.error)}`,
      source,
      parseError.offset,
    );
  }
  if (root === undefined) {
    throw new BalsamiqJsonError('Balsamiq JSON must contain a document', source, 0);
  }

  const value = decodeNode(root, source);
  if (!isRecord(value)) {
    throw errorAt(source, root, [], 'Balsamiq JSON must be an object');
  }
  const mockup = value.mockup;
  if (!isRecord(mockup)) {
    throw errorAt(source, root, ['mockup'], 'Balsamiq JSON must contain a mockup object');
  }
  const controlsNode = mockup.controls;
  if (!isRecord(controlsNode)) {
    throw errorAt(source, root, ['mockup', 'controls'], 'mockup.controls must be an object');
  }
  if (!Array.isArray(controlsNode.control)) {
    throw errorAt(
      source,
      root,
      ['mockup', 'controls', 'control'],
      'controls.control must be an array',
    );
  }
  if (controlsNode.control.length === 0) {
    throw errorAt(
      source,
      root,
      ['mockup', 'controls', 'control'],
      'controls.control must not be empty',
    );
  }
  if (controlsNode.control.length > MAX_BALSAMIQ_CONTROLS) {
    throw errorAt(
      source,
      root,
      ['mockup', 'controls', 'control'],
      `Balsamiq mockup has too many controls (limit ${MAX_BALSAMIQ_CONTROLS})`,
    );
  }

  const rootWidth = readMockupDimension(mockup, 'mockupW', 'measuredW', source, root);
  const rootHeight = readMockupDimension(mockup, 'mockupH', 'measuredH', source, root);
  const ids = new Set<string>();
  let canvas: BalsamiqControl | undefined;
  const controls: BalsamiqControl[] = [];

  controlsNode.control.forEach((controlValue: unknown, index: number) => {
    const controlPath: Array<string | number> = ['mockup', 'controls', 'control', index];
    const control = normalizeControl(controlValue, source, root, controlPath, index, ids);
    if (control.type === 'Canvas') {
      if (canvas !== undefined) {
        throw errorAt(
          source,
          root,
          controlPath,
          'Balsamiq mockup must contain at most one Canvas control',
        );
      }
      canvas = control;
    } else {
      controls.push(control);
    }
  });

  const width = rootWidth ?? canvas?.width;
  const height = rootHeight ?? canvas?.height;
  if (width === undefined) {
    throw errorAt(
      source,
      root,
      ['mockup', 'mockupW'],
      'mockup must include measuredW/mockupW or a Canvas control with a width',
    );
  }
  if (height === undefined) {
    throw errorAt(
      source,
      root,
      ['mockup', 'mockupH'],
      'mockup must include measuredH/mockupH or a Canvas control with a height',
    );
  }

  controls.sort((left, right) => left.zOrder - right.zOrder || left.order - right.order);
  return {
    width,
    height,
    controls,
    ...(canvas === undefined ? {} : { canvas }),
  };
}

function normalizeControl(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  order: number,
  ids: Set<string>,
): BalsamiqControl {
  if (!isRecord(value)) {
    throw errorAt(source, root, path, `control at index ${order + 1} must be an object`);
  }
  const id = requiredString(
    value.ID,
    source,
    root,
    [...path, 'ID'],
    `control at index ${order + 1} ID`,
  );
  if (ids.has(id)) {
    throw errorAt(
      source,
      root,
      [...path, 'ID'],
      `Balsamiq mockup contains duplicate control ID "${id}"`,
    );
  }
  ids.add(id);

  const rawType = value.typeID;
  if (typeof rawType !== 'string' || !isControlType(rawType)) {
    const typeLabel = typeof rawType === 'string' ? ` "${rawType}"` : '';
    throw errorAt(
      source,
      root,
      [...path, 'typeID'],
      `Balsamiq control "${id}" has an unsupported typeID${typeLabel}`,
    );
  }

  const properties = normalizeProperties(
    value.properties,
    source,
    root,
    [...path, 'properties'],
    id,
  );
  const x = readFiniteNumber(value.x, source, root, [...path, 'x'], `control "${id}" x`);
  const y = readFiniteNumber(value.y, source, root, [...path, 'y'], `control "${id}" y`);
  const width = readSize(value, 'w', 'measuredW', source, root, path, id);
  const height = readSize(value, 'h', 'measuredH', source, root, path, id);
  const zOrder = readFiniteNumber(
    value.zOrder,
    source,
    root,
    [...path, 'zOrder'],
    `control "${id}" zOrder`,
  );
  assertCoordinate(x, source, root, [...path, 'x'], `control "${id}" x`);
  assertCoordinate(y, source, root, [...path, 'y'], `control "${id}" y`);
  assertSize(width, source, root, [...path, 'w'], `control "${id}" width`, rawType === 'Line');
  assertSize(height, source, root, [...path, 'h'], `control "${id}" height`, rawType === 'Line');
  if (Math.abs(zOrder) > 1_000_000) {
    throw errorAt(source, root, [...path, 'zOrder'], `control "${id}" zOrder is out of range`);
  }

  return { id, type: rawType, x, y, width, height, zOrder, properties, order };
}

function normalizeProperties(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): BalsamiqProperties {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw errorAt(source, root, path, `control "${id}" properties must be an object`);
  }
  const result: BalsamiqProperties = {};
  if (value.text !== undefined) {
    if (typeof value.text !== 'string') {
      throw errorAt(source, root, [...path, 'text'], `control "${id}" text must be a string`);
    }
    result.text = value.text;
  }
  if (value.color !== undefined) {
    result.color = normalizeColor(value.color, source, root, [...path, 'color'], id);
  }
  if (value.size !== undefined) {
    const fontSize = readFiniteNumber(
      value.size,
      source,
      root,
      [...path, 'size'],
      `control "${id}" size`,
    );
    if (fontSize < 6 || fontSize > 72) {
      throw errorAt(
        source,
        root,
        [...path, 'size'],
        `control "${id}" size must be between 6 and 72`,
      );
    }
    result.fontSize = fontSize;
  }
  if (value.bold !== undefined) {
    result.bold = readBoolean(value.bold, source, root, [...path, 'bold'], `control "${id}" bold`);
  }
  if (value.italic !== undefined) {
    result.italic = readBoolean(
      value.italic,
      source,
      root,
      [...path, 'italic'],
      `control "${id}" italic`,
    );
  }
  if (value.checked !== undefined) {
    result.checked = readBoolean(
      value.checked,
      source,
      root,
      [...path, 'checked'],
      `control "${id}" checked`,
    );
  }
  if (value.selected !== undefined) {
    result.selected = readBoolean(
      value.selected,
      source,
      root,
      [...path, 'selected'],
      `control "${id}" selected`,
    );
  }
  if (value.align !== undefined) {
    if (value.align !== 'left' && value.align !== 'center' && value.align !== 'right') {
      throw errorAt(
        source,
        root,
        [...path, 'align'],
        `control "${id}" align must be left, center, or right`,
      );
    }
    result.align = value.align;
  }
  return result;
}

function normalizeColor(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): string {
  if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) {
    return value.toLowerCase();
  }
  if ((typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= 0xffffff) {
      return `#${numeric.toString(16).padStart(6, '0')}`;
    }
  }
  throw errorAt(source, root, path, `control "${id}" color must be a 24-bit Balsamiq color`);
}

function readSize(
  control: Record<string, unknown>,
  primaryKey: 'w' | 'h',
  measuredKey: 'measuredW' | 'measuredH',
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  id: string,
): number {
  const key = control[primaryKey] === undefined ? measuredKey : primaryKey;
  const value = control[key];
  const label = `control "${id}" ${primaryKey === 'w' ? 'width' : 'height'}`;
  return readFiniteNumber(value, source, root, [...path, key], label);
}

function optionalDimension(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const number = readFiniteNumber(value, source, root, path, label);
  assertSize(number, source, root, path, label, false);
  return number;
}

function readMockupDimension(
  mockup: Record<string, unknown>,
  compatibilityKey: 'mockupW' | 'mockupH',
  documentedKey: 'measuredW' | 'measuredH',
  source: string,
  root: JsonNode,
): number | undefined {
  const key = mockup[compatibilityKey] === undefined ? documentedKey : compatibilityKey;
  return optionalDimension(mockup[key], source, root, ['mockup', key], `mockup.${key}`);
}

function readFiniteNumber(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  label: string,
): number {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number)) {
    throw errorAt(source, root, path, `${label} must be a finite number`);
  }
  return number;
}

function readBoolean(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  label: string,
): boolean {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw errorAt(source, root, path, `${label} must be true or false`);
}

function requiredString(
  value: unknown,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  label: string,
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw errorAt(source, root, path, `${label} must be a non-empty string`);
  }
  return value;
}

function assertCoordinate(
  value: number,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  label: string,
): void {
  if (Math.abs(value) > MAX_BALSAMIQ_CANVAS_SIDE) {
    throw errorAt(
      source,
      root,
      path,
      `${label} is out of range (limit ${MAX_BALSAMIQ_CANVAS_SIDE} px per side)`,
    );
  }
}

function assertSize(
  value: number,
  source: string,
  root: JsonNode,
  path: Array<string | number>,
  label: string,
  allowZero: boolean,
): void {
  if ((allowZero ? value < 0 : value <= 0) || value > MAX_BALSAMIQ_CANVAS_SIDE) {
    throw errorAt(
      source,
      root,
      path,
      `${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'} and at most ${MAX_BALSAMIQ_CANVAS_SIDE}`,
    );
  }
}

function isControlType(value: string): value is BalsamiqControlType {
  return (BALSAMIQ_CONTROL_TYPES as readonly string[]).includes(value);
}
