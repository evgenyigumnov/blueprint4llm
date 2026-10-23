import { EChartsError, toEChartsJsonPointer } from './echarts-error.js';
import type { EChartsSourcePosition } from './echarts-source.js';

export interface EChartsValidationContext {
  positions: Map<string, EChartsSourcePosition>;
}

export type EChartsFieldRule =
  | 'boolean'
  | 'string'
  | 'text'
  | 'number'
  | 'nonnegative'
  | 'positive'
  | 'integer'
  | 'color'
  | 'position'
  | 'formatter'
  | `enum:${string}`
  | ((value: unknown, path: (string | number)[], context: EChartsValidationContext) => void);

export function validateEChartsRecord(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(context, path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

export function validateEChartsFields(
  value: Record<string, unknown>,
  path: (string | number)[],
  schema: Record<string, EChartsFieldRule>,
  context: EChartsValidationContext,
): void {
  for (const [key, fieldValue] of Object.entries(value)) {
    const rule = schema[key];
    const fieldPath = [...path, key];
    if (rule === undefined) fail(context, fieldPath, 'is not supported by the ECharts profile');
    if (typeof rule === 'function') {
      rule(fieldValue, fieldPath, context);
    } else {
      validateEChartsScalar(fieldValue, fieldPath, rule, context);
    }
  }
}

export function validateEChartsScalar(
  value: unknown,
  path: (string | number)[],
  rule: Exclude<EChartsFieldRule, (...args: never[]) => void>,
  context: EChartsValidationContext,
): void {
  if (rule.startsWith('enum:')) {
    const allowed = rule.slice('enum:'.length).split('|');
    if (typeof value !== 'string' || !allowed.includes(value)) {
      fail(context, path, `must be one of ${allowed.map((item) => `"${item}"`).join(', ')}`);
    }
    return;
  }
  switch (rule) {
    case 'boolean':
      if (typeof value !== 'boolean') fail(context, path, 'must be a boolean');
      return;
    case 'string':
      if (typeof value !== 'string') fail(context, path, 'must be a string');
      return;
    case 'text':
      if (typeof value !== 'string' || value.length > 4_096) {
        fail(context, path, 'must be a string of at most 4096 characters');
      }
      return;
    case 'number':
    case 'nonnegative':
    case 'positive':
    case 'integer':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(context, path, 'must be a finite number');
      }
      if (rule === 'nonnegative' && value < 0) fail(context, path, 'must be zero or greater');
      if (rule === 'positive' && value <= 0) fail(context, path, 'must be greater than zero');
      if (rule === 'integer' && !Number.isInteger(value)) fail(context, path, 'must be an integer');
      return;
    case 'color':
      if (typeof value !== 'string' || !isSupportedColor(value)) {
        fail(context, path, 'must be a CSS color from the supported color subset');
      }
      return;
    case 'position':
      if (!(
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' &&
          /^(?:\d+(?:\.\d+)?%|(?:left|center|right|top|middle|bottom))$/.test(value))
      )) {
        fail(context, path, 'must be a finite pixel value, percentage, or alignment keyword');
      }
      return;
    case 'formatter':
      if (typeof value !== 'string' || value.length > 512 || /<[^>]*>/.test(value)) {
        fail(context, path, 'must be a plain text formatter template of at most 512 characters');
      }
      if (
        value.replace(/\{(?:a|b|c|d|name|value|percent)\}/g, '').includes('{') ||
        value.replace(/\{(?:a|b|c|d|name|value|percent)\}/g, '').includes('}')
      ) {
        fail(context, path, 'contains an unsupported formatter placeholder');
      }
      return;
  }
}

export function validateEChartsSimpleObject(
  value: unknown,
  path: (string | number)[],
  schema: Record<string, EChartsFieldRule>,
  context: EChartsValidationContext,
): Record<string, unknown> {
  const record = validateEChartsRecord(value, path, context);
  validateEChartsFields(record, path, schema, context);
  return record;
}

export function validateEChartsStringArray(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
  maximum = 10_000,
): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(context, path, `must be an array of at most ${maximum} strings`);
  }
  value.forEach((item, index) => validateEChartsScalar(item, [...path, index], 'text', context));
  return value as string[];
}

export function validateEChartsColorArray(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
  minimum = 1,
  maximum = 32,
): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail(context, path, `must contain between ${minimum} and ${maximum} colors`);
  }
  value.forEach((item, index) => validateEChartsScalar(item, [...path, index], 'color', context));
  return value as string[];
}

export function validateEChartsFormatter(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
): void {
  validateEChartsScalar(value, path, 'formatter', context);
}

export function isEChartsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fail(
  context: EChartsValidationContext,
  path: (string | number)[],
  message: string,
): never {
  const pointer = toEChartsJsonPointer(path);
  throw new EChartsError(`${pointer || '/'}: ${message}`, {
    ...(context.positions.get(pointer) ?? {}),
    pointer,
  });
}

function isSupportedColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (/^#[\da-f]{3,4}$|^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(normalized)) return true;
  if (/^rgba?\(\s*[\d.%]+(?:\s*,\s*[\d.%]+){2,3}\s*\)$/.test(normalized)) return true;
  if (/^hsla?\(\s*[\d.]+(?:deg)?(?:\s*,\s*[\d.%]+){2,3}\s*\)$/.test(normalized)) return true;
  return new Set([
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
  ]).has(normalized);
}
