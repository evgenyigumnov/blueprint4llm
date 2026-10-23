import { VegaLiteError, toJsonPointer } from './vega-lite-error.js';
import { validateVegaLiteData } from './vega-lite-data.js';
import type { SourcePosition } from './vega-lite-source.js';
import { VEGA_LITE_SCHEMA_URL } from './vega-lite-schema.js';
import { applyVegaLiteStylePolicy, isAutomaticResize } from './vega-lite-style.js';

export const VEGA_LITE_POLICY_REVISION = 'vega-lite-static-policy-v1';
export const MAX_VEGA_LITE_VIEWS = 100;
export const MAX_VEGA_LITE_TRANSFORMS = 100;
export const MAX_VEGA_LITE_RENDER_SIDE = 4_096;
export const MAX_VEGA_LITE_RENDER_PIXELS = 16_000_000;

const ALLOWED_TRANSFORMS = new Set([
  'filter',
  'calculate',
  'aggregate',
  'joinaggregate',
  'bin',
  'timeUnit',
  'stack',
  'fold',
  'lookup',
]);
const ALLOWED_MARKS = new Set([
  'bar',
  'line',
  'point',
  'circle',
  'square',
  'area',
  'rect',
  'rule',
  'tick',
  'text',
  'arc',
  'trail',
  'boxplot',
  'errorbar',
  'errorband',
]);

export interface VegaLitePolicyResult {
  warnings: string[];
}

interface PolicyState {
  source: string;
  positions: Map<string, SourcePosition>;
  datasets: Map<string, unknown[]>;
  transformCount: number;
  warnings: string[];
}

/** Enforces the static, offline Vega-Lite subset and applies safe rendering defaults. */
export function applyVegaLitePolicy(
  spec: Record<string, unknown>,
  source: string,
  positions: Map<string, SourcePosition>,
): VegaLitePolicyResult {
  const datasets = validateVegaLiteData(spec, source, positions);
  const state: PolicyState = {
    source,
    positions,
    datasets,
    transformCount: 0,
    warnings: [],
  };

  validateSchemaIdentifier(spec, state);
  inspectSpec(spec, [], undefined, state);
  validateViewCount(spec, [], undefined, state);
  applyVegaLiteStylePolicy(spec, source, positions);
  return { warnings: state.warnings };
}

function validateSchemaIdentifier(spec: Record<string, unknown>, state: PolicyState): void {
  if (!hasOwn(spec, '$schema')) return;
  if (spec.$schema !== VEGA_LITE_SCHEMA_URL) {
    failAt(
      `unsupported Vega-Lite schema; expected ${VEGA_LITE_SCHEMA_URL}`,
      '/$schema',
      state.source,
      state.positions,
    );
  }
}

function inspectSpec(
  spec: unknown,
  path: (string | number)[],
  inheritedData: unknown,
  state: PolicyState,
): void {
  if (!isRecord(spec)) return;
  const data = hasOwn(spec, 'data') ? spec.data : inheritedData;
  if (hasOwn(spec, 'selection')) {
    failAt(
      'legacy selection is not supported in static export',
      toJsonPointer([...path, 'selection']),
      state.source,
      state.positions,
    );
  }
  if (hasOwn(spec, 'projection')) {
    failAt(
      'geographic projections are not supported',
      toJsonPointer([...path, 'projection']),
      state.source,
      state.positions,
    );
  }
  if (hasOwn(spec, 'autosize') && isAutomaticResize(spec.autosize)) {
    failAt(
      'automatic resize is not supported in static export',
      toJsonPointer([...path, 'autosize']),
      state.source,
      state.positions,
    );
  }
  for (const dimension of ['width', 'height'] as const) {
    if (spec[dimension] === 'container') {
      failAt(
        `${dimension}: "container" is not supported in static export`,
        toJsonPointer([...path, dimension]),
        state.source,
        state.positions,
      );
    }
    validateDimension(spec[dimension], dimension, [...path, dimension], state);
  }
  const width = numericDimension(spec.width);
  const height = numericDimension(spec.height);
  if (width !== undefined && height !== undefined && width * height > MAX_VEGA_LITE_RENDER_PIXELS) {
    failAt(
      `view area exceeds the ${MAX_VEGA_LITE_RENDER_PIXELS} pixel limit: ${width * height}`,
      toJsonPointer(path),
      state.source,
      state.positions,
    );
  }
  validateMark(spec.mark, [...path, 'mark'], state);
  if (isRecord(spec.encoding)) {
    if (hasOwn(spec.encoding, 'href')) {
      failAt(
        'href encoding is not supported in static export',
        toJsonPointer([...path, 'encoding', 'href']),
        state.source,
        state.positions,
      );
    }
    if (hasOwn(spec.encoding, 'tooltip') && state.warnings.length === 0) {
      state.warnings.push(
        'tooltip is accepted, but static export does not provide interactive tooltips',
      );
    }
  }
  inspectParameters(
    spec.params ?? spec.param,
    [...path, spec.params === undefined ? 'param' : 'params'],
    state,
  );
  inspectTransforms(spec.transform, [...path, 'transform'], state);

  for (const key of ['layer', 'concat', 'hconcat', 'vconcat']) {
    const children = spec[key];
    if (Array.isArray(children)) {
      children.forEach((child, index) => inspectSpec(child, [...path, key, index], data, state));
    }
  }
  if (hasOwn(spec, 'spec')) inspectSpec(spec.spec, [...path, 'spec'], data, state);
}

function validateMark(mark: unknown, path: (string | number)[], state: PolicyState): void {
  if (mark === undefined) return;
  const name = typeof mark === 'string' ? mark : isRecord(mark) ? mark.type : undefined;
  if (name === 'image') {
    failAt(
      'image marks are not supported in static export',
      toJsonPointer(path),
      state.source,
      state.positions,
    );
  }
  if (typeof name === 'string' && !ALLOWED_MARKS.has(name)) {
    failAt(
      `mark "${name}" is not supported in static export`,
      toJsonPointer(path),
      state.source,
      state.positions,
    );
  }
}

function inspectParameters(
  parameters: unknown,
  path: (string | number)[],
  state: PolicyState,
): void {
  if (!Array.isArray(parameters)) return;
  parameters.forEach((parameter, index) => {
    if (!isRecord(parameter)) return;
    for (const property of ['select', 'bind', 'expr']) {
      if (hasOwn(parameter, property)) {
        failAt(
          'interactive parameters are not supported in static export',
          toJsonPointer([...path, index, property]),
          state.source,
          state.positions,
        );
      }
    }
  });
}

function inspectTransforms(
  transforms: unknown,
  path: (string | number)[],
  state: PolicyState,
): void {
  if (!Array.isArray(transforms)) return;
  state.transformCount += transforms.length;
  if (state.transformCount > MAX_VEGA_LITE_TRANSFORMS) {
    failAt(
      `too many transforms: ${state.transformCount} (limit ${MAX_VEGA_LITE_TRANSFORMS})`,
      toJsonPointer(path),
      state.source,
      state.positions,
    );
  }
  transforms.forEach((transform, index) => {
    if (!isRecord(transform)) return;
    const operation = Object.keys(transform).find((key) => key !== 'as') ?? 'unknown';
    if (!ALLOWED_TRANSFORMS.has(operation)) {
      failAt(
        `transform "${operation}" is not supported in static export`,
        toJsonPointer([...path, index, operation]),
        state.source,
        state.positions,
      );
    }
  });
}

function validateViewCount(
  spec: unknown,
  path: (string | number)[],
  inheritedData: unknown,
  state: PolicyState,
): number {
  if (!isRecord(spec)) return 0;
  const data = hasOwn(spec, 'data') ? spec.data : inheritedData;
  let views = 0;
  const composition = ['layer', 'concat', 'hconcat', 'vconcat'].find((key) =>
    Array.isArray(spec[key]),
  );
  if (composition !== undefined) {
    const children = spec[composition] as unknown[];
    const childViews = children.map((child, index) =>
      validateViewCount(child, [...path, composition, index], data, state),
    );
    views =
      composition === 'layer'
        ? Math.max(1, ...childViews)
        : childViews.reduce((total, count) => total + count, 0);
  } else if (hasOwn(spec, 'spec')) {
    views = validateViewCount(spec.spec, [...path, 'spec'], data, state);
  } else if (hasOwn(spec, 'mark')) {
    views = 1;
  }

  if (isRecord(spec.facet)) {
    views *= countFacetCombinations(spec.facet, rowsForData(data, state.datasets));
  }
  if (isRecord(spec.repeat)) {
    views *= countRepeatCombinations(spec.repeat);
  }
  if (views > MAX_VEGA_LITE_VIEWS) {
    const pointer = toJsonPointer(path);
    failAt(
      `too many views after facet/repeat expansion: ${views} (limit ${MAX_VEGA_LITE_VIEWS})`,
      pointer,
      state.source,
      state.positions,
    );
  }
  return views;
}

function countFacetCombinations(facet: Record<string, unknown>, rows: unknown[]): number {
  let combinations = 1;
  for (const key of ['row', 'column']) {
    const definition = facet[key];
    const field =
      isRecord(definition) && typeof definition.field === 'string' ? definition.field : undefined;
    if (field === undefined) continue;
    const values = rows.map((row) => (isRecord(row) ? readField(row, field) : undefined));
    const hasUnresolvedField = values.some((value) => value === undefined);
    combinations *= Math.max(1, hasUnresolvedField ? rows.length : new Set(values).size);
  }
  return combinations;
}

function countRepeatCombinations(repeat: Record<string, unknown>): number {
  let combinations = 1;
  for (const value of Object.values(repeat)) {
    if (Array.isArray(value)) combinations *= Math.max(1, value.length);
  }
  return combinations;
}

function rowsForData(data: unknown, datasets: Map<string, unknown[]>): unknown[] {
  if (!isRecord(data)) return [];
  if (Array.isArray(data.values)) return data.values;
  return typeof data.name === 'string' ? (datasets.get(data.name) ?? []) : [];
}

function readField(row: Record<string, unknown>, field: string): unknown {
  let value: unknown = row;
  for (const segment of field.split('.')) {
    if (!isRecord(value) || !hasOwn(value, segment)) return undefined;
    value = value[segment];
  }
  return value;
}

function validateDimension(
  value: unknown,
  dimension: 'width' | 'height',
  path: (string | number)[],
  state: PolicyState,
): void {
  const number = numericDimension(value);
  if (number === undefined) return;
  if (number <= 0 || number > MAX_VEGA_LITE_RENDER_SIDE) {
    failAt(
      `${dimension} must be positive and no larger than ${MAX_VEGA_LITE_RENDER_SIDE} px; received ${number}`,
      toJsonPointer(path),
      state.source,
      state.positions,
    );
  }
}

function numericDimension(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (isRecord(value) && typeof value.step === 'number') return value.step;
  return undefined;
}

function failAt(
  message: string,
  pointer: string,
  _source: string,
  positions: Map<string, SourcePosition>,
): never {
  const location = positions.get(pointer) ?? positions.get(parentPointer(pointer));
  throw new VegaLiteError(`${pointer || '/'}: ${message}`, { ...(location ?? {}), pointer });
}

function parentPointer(pointer: string): string {
  return pointer.replace(/\/[^/]*$/, '');
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
