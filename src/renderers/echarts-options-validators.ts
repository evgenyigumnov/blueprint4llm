import { EChartsError, toEChartsJsonPointer } from './echarts-error.js';
import type { EChartsSourcePosition } from './echarts-source.js';

export type Validator = (value: unknown, path: Path, context: Context) => void;
export type Path = (string | number)[];
export type Context = { positions: Map<string, EChartsSourcePosition> };
export type Schema = Record<string, Validator>;
export type JsonObject = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function fail(context: Context, path: Path, message: string): never {
  const pointer = toEChartsJsonPointer(path);
  throw new EChartsError((pointer || '/') + ': ' + message, {
    ...(context.positions.get(pointer) ?? {}),
    pointer,
  });
}

export function object(schema: Schema): Validator {
  return (value, path, context) => {
    if (!isRecord(value)) fail(context, path, 'must be an object');
    for (const [key, fieldValue] of Object.entries(value)) {
      const validator = schema[key];
      if (validator === undefined) {
        fail(context, [...path, key], 'is not supported by the ECharts profile');
      }
      validator(fieldValue, [...path, key], context);
    }
  };
}

export function scalar(
  kind:
    | 'text'
    | 'string'
    | 'boolean'
    | 'number'
    | 'integer'
    | 'positive'
    | 'nonnegative'
    | 'color'
    | 'position'
    | 'formatter',
): Validator {
  return (value, path, context) => {
    if (kind === 'text' && (typeof value !== 'string' || value.length > 4_096)) {
      fail(context, path, 'must be a string of at most 4096 characters');
    }
    if (kind === 'string' && typeof value !== 'string') fail(context, path, 'must be a string');
    if (kind === 'boolean' && typeof value !== 'boolean') fail(context, path, 'must be a boolean');
    if (['number', 'integer', 'positive', 'nonnegative'].includes(kind)) {
      if (typeof value !== 'number' || !Number.isFinite(value))
        fail(context, path, 'must be a finite number');
      if (kind === 'integer' && !Number.isInteger(value)) fail(context, path, 'must be an integer');
      if (kind === 'positive' && value <= 0) fail(context, path, 'must be greater than zero');
      if (kind === 'nonnegative' && value < 0) fail(context, path, 'must be zero or greater');
    }
    if (kind === 'color' && (typeof value !== 'string' || !isColor(value))) {
      fail(context, path, 'must be a color from the supported CSS subset');
    }
    if (kind === 'position' && !isPosition(value)) {
      fail(context, path, 'must be a pixel value, percentage, or alignment keyword');
    }
    if (kind === 'formatter') validateFormatter(value, path, context);
  };
}

export function enumeration(...values: string[]): Validator {
  return (value, path, context) => {
    if (typeof value !== 'string' || !values.includes(value)) {
      fail(context, path, 'must be one of ' + values.map((entry) => '"' + entry + '"').join(', '));
    }
  };
}

export function arrayOf(item: Validator, minimum: number, maximum: number): Validator {
  return (value, path, context) => {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
      fail(context, path, 'must contain between ' + minimum + ' and ' + maximum + ' items');
    }
    value.forEach((entry, index) => item(entry, [...path, index], context));
  };
}

function validateFormatter(value: unknown, path: Path, context: Context): void {
  if (typeof value !== 'string' || value.length > 512 || /<[^>]*>/.test(value)) {
    fail(context, path, 'must be a plain text formatter template of at most 512 characters');
  }
  const stripped = value.replace(/\{(?:a|b|c|d|name|value|percent)\}/g, '');
  if (/[{}]/.test(stripped)) fail(context, path, 'contains an unsupported formatter placeholder');
}

function isColor(value: string): boolean {
  const color = value.trim().toLowerCase();
  return (
    /^#[\da-f]{3,4}$|^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color) ||
    /^rgba?\(\s*[\d.%]+(?:\s*,\s*[\d.%]+){2,3}\s*\)$/.test(color) ||
    /^hsla?\(\s*[\d.]+(?:deg)?(?:\s*,\s*[\d.%]+){2,3}\s*\)$/.test(color) ||
    new Set([
      'black',
      'white',
      'red',
      'green',
      'blue',
      'orange',
      'purple',
      'yellow',
      'gray',
      'grey',
      'transparent',
      'navy',
      'teal',
      'lime',
      'aqua',
      'fuchsia',
      'silver',
      'maroon',
      'olive',
    ]).has(color)
  );
}

function isPosition(value: unknown): boolean {
  return (
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' &&
      /^(?:\d+(?:\.\d+)?%|left|center|right|top|middle|bottom)$/.test(value))
  );
}

export function objectList(item: Validator, maximum: number): Validator {
  return (value, path, context) => {
    const items = Array.isArray(value) ? value : [value];
    if (items.length === 0 || items.length > maximum) {
      fail(context, path, 'must contain between 1 and ' + maximum + ' objects');
    }
    items.forEach((entry, index) =>
      item(entry, Array.isArray(value) ? [...path, index] : path, context),
    );
  };
}

export function validatePadding(value: unknown, path: Path, context: Context): void {
  if (Array.isArray(value) && (value.length === 2 || value.length === 4)) {
    value.forEach((item, index) => scalar('nonnegative')(item, [...path, index], context));
    return;
  }
  if (typeof value !== 'number')
    fail(context, path, 'must be a number or an array of two or four numbers');
  scalar('nonnegative')(value, path, context);
}

export function validatePair(value: unknown, path: Path, context: Context): void {
  if (!Array.isArray(value) || value.length !== 2) fail(context, path, 'must contain two values');
  value.forEach((item, index) => {
    if (typeof item === 'number') scalar('number')(item, [...path, index], context);
    else scalar('position')(item, [...path, index], context);
  });
}

export function validateSizePair(value: unknown, path: Path, context: Context): void {
  if (Array.isArray(value)) {
    if (value.length === 0 || value.length > 2)
      fail(context, path, 'must contain one or two size values');
    value.forEach((item, index) => validateSize(item, [...path, index], context));
    return;
  }
  validateSize(value, path, context);
}

export function validateSize(value: unknown, path: Path, context: Context): void {
  if (typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value)) return;
  scalar('positive')(value, path, context);
}

export function validateBoundaryGap(value: unknown, path: Path, context: Context): void {
  if (typeof value === 'boolean') return;
  validatePair(value, path, context);
}

export function validateAxisBound(value: unknown, path: Path, context: Context): void {
  if (value === 'dataMin' || value === 'dataMax') return;
  scalar('number')(value, path, context);
}

export function validateAxisInterval(value: unknown, path: Path, context: Context): void {
  if (value === 'auto') return;
  scalar('nonnegative')(value, path, context);
}

export function validateSymbol(value: unknown, path: Path, context: Context): void {
  enumeration(
    'circle',
    'rect',
    'roundRect',
    'triangle',
    'diamond',
    'pin',
    'arrow',
    'none',
  )(value, path, context);
}

export function validateSymbolSize(value: unknown, path: Path, context: Context): void {
  if (Array.isArray(value)) {
    if (value.length !== 2) fail(context, path, 'must be a positive number or a two-value size');
    value.forEach((part, index) => scalar('positive')(part, [...path, index], context));
    return;
  }
  scalar('positive')(value, path, context);
}

export function validateFontWeight(value: unknown, path: Path, context: Context): void {
  if (
    [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(value as number) ||
    (typeof value === 'string' && ['normal', 'bold', 'bolder', 'lighter'].includes(value))
  )
    return;
  fail(context, path, 'must be a supported font weight');
}

export function validateOpacity(value: unknown, path: Path, context: Context): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(context, path, 'must be between 0 and 1');
  }
}

export function validateSmooth(value: unknown, path: Path, context: Context): void {
  if (typeof value === 'boolean' || (typeof value === 'number' && value >= 0 && value <= 1)) return;
  fail(context, path, 'must be a boolean or a number between 0 and 1');
}

export function validateDimension(value: unknown, path: Path, context: Context): void {
  if (typeof value === 'string') scalar('text')(value, path, context);
  else scalar('integer')(value, path, context);
}

export function validateGaugeStops(value: unknown, path: Path, context: Context): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) {
    fail(context, path, 'must contain 1 to 16 color stops');
  }
  value.forEach((stop, index) => {
    const stopPath = [...path, index];
    if (!Array.isArray(stop) || stop.length !== 2)
      fail(context, stopPath, 'must contain a ratio and a color');
    if (typeof stop[0] !== 'number' || stop[0] < 0 || stop[0] > 1)
      fail(context, [...stopPath, 0], 'must be between 0 and 1');
    scalar('color')(stop[1], [...stopPath, 1], context);
  });
}

export function optionalColor(value: unknown, path: Path, context: Context): void {
  if (value !== null) validateColorOrGradient(value, path, context);
}

export function validateColorOrGradient(value: unknown, path: Path, context: Context): void {
  if (typeof value === 'string') {
    scalar('color')(value, path, context);
    return;
  }
  if (!isRecord(value)) fail(context, path, 'must be a supported color or linear gradient');
  object({
    type: enumeration('linear'),
    x: scalar('number'),
    y: scalar('number'),
    x2: scalar('number'),
    y2: scalar('number'),
    global: scalar('boolean'),
    colorStops: arrayOf(object({ offset: validateOpacity, color: scalar('color') }), 2, 8),
  })(value, path, context);
  for (const key of ['x', 'y', 'x2', 'y2', 'type', 'colorStops'] as const) {
    if (value[key] === undefined)
      fail(context, [...path, key], 'is required for a linear gradient');
  }
  for (const key of ['x', 'y', 'x2', 'y2'] as const) {
    const coordinate = value[key];
    if (typeof coordinate !== 'number' || coordinate < 0 || coordinate > 1) {
      fail(context, [...path, key], 'must be between 0 and 1');
    }
  }
  const stops = value.colorStops;
  if (!Array.isArray(stops))
    fail(context, [...path, 'colorStops'], 'must be a gradient stop array');
  stops.forEach((stop, index) => {
    if (!isRecord(stop) || stop.offset === undefined || stop.color === undefined) {
      fail(context, [...path, 'colorStops', index], 'requires an offset and color');
    }
  });
}

export function legacyContainLabel(value: unknown, path: Path, context: Context): void {
  if (value !== false) {
    fail(context, path, 'true is not supported by ECharts 6; set explicit grid margins instead');
  }
}

export function falseOnly(value: unknown, path: Path, context: Context): void {
  if (value !== false)
    fail(context, path, 'must be false because this renderer produces static charts');
}

export function ignore(_value: unknown, _path: Path, _context: Context): void {}
