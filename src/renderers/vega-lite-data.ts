import { VegaLiteError, toJsonPointer } from './vega-lite-error.js';
import type { SourcePosition } from './vega-lite-source.js';

export const MAX_VEGA_LITE_ROWS = 10_000;

interface DataPolicyState {
  source: string;
  positions: Map<string, SourcePosition>;
  datasets: Map<string, unknown[]>;
  countedRows: Set<unknown[]>;
  rowCount: number;
}

/** Validates inline data and resolves every named source against root datasets. */
export function validateVegaLiteData(
  spec: Record<string, unknown>,
  source: string,
  positions: Map<string, SourcePosition>,
): Map<string, unknown[]> {
  const datasets = collectDatasets(spec, source, positions);
  const state: DataPolicyState = {
    source,
    positions,
    datasets,
    countedRows: new Set(),
    rowCount: 0,
  };
  for (const [name, rows] of datasets) {
    validateRecords(rows, `/datasets/${escapePointer(name)}`, state);
  }
  inspectSpecDataSources(spec, [], state);
  if (state.rowCount > MAX_VEGA_LITE_ROWS) {
    failAt(
      `inline data has too many source rows: ${state.rowCount} (limit ${MAX_VEGA_LITE_ROWS})`,
      '/data',
      state,
    );
  }
  return datasets;
}

function collectDatasets(
  spec: Record<string, unknown>,
  source: string,
  positions: Map<string, SourcePosition>,
): Map<string, unknown[]> {
  const output = new Map<string, unknown[]>();
  const value = spec.datasets;
  if (value === undefined || !isRecord(value)) return output;

  for (const name of Object.keys(value)) {
    const dataset = value[name];
    if (Array.isArray(dataset)) output.set(name, dataset);
    else if (isRecord(dataset) && Array.isArray(dataset.values)) {
      output.set(name, dataset.values);
    } else {
      const pointer = `/datasets/${escapePointer(name)}`;
      failAt('datasets entries must be arrays of inline records', pointer, { source, positions });
    }
  }
  return output;
}

function inspectSpecDataSources(
  spec: unknown,
  path: (string | number)[],
  state: DataPolicyState,
): void {
  if (!isRecord(spec)) return;

  if (hasOwn(spec, 'data')) inspectData(spec.data, [...path, 'data'], state);
  if (Array.isArray(spec.transform)) {
    spec.transform.forEach((operation, index) => {
      if (!isRecord(operation) || !hasOwn(operation, 'lookup')) return;
      const from = operation.from;
      if (isRecord(from) && hasOwn(from, 'data')) {
        inspectData(from.data, [...path, 'transform', index, 'from', 'data'], state);
      }
    });
  }

  for (const key of ['layer', 'concat', 'hconcat', 'vconcat']) {
    const children = spec[key];
    if (Array.isArray(children)) {
      children.forEach((child, index) =>
        inspectSpecDataSources(child, [...path, key, index], state),
      );
    }
  }
  if (hasOwn(spec, 'spec')) inspectSpecDataSources(spec.spec, [...path, 'spec'], state);
}

function inspectData(value: unknown, path: (string | number)[], state: DataPolicyState): void {
  if (value === null || value === undefined || !isRecord(value)) return;
  if (hasOwn(value, 'url')) {
    failAt(
      'external data is not supported; use data.values or datasets',
      toJsonPointer([...path, 'url']),
      state,
    );
  }
  if (hasOwn(value, 'values')) {
    if (Array.isArray(value.values)) {
      validateRecords(value.values, toJsonPointer([...path, 'values']), state);
    }
    return;
  }
  if (hasOwn(value, 'name')) {
    const name = value.name;
    if (typeof name === 'string' && !state.datasets.has(name)) {
      failAt(`unknown dataset: ${name}`, toJsonPointer([...path, 'name']), state);
    }
    return;
  }
  for (const generator of ['sequence', 'graticule', 'sphere']) {
    if (hasOwn(value, generator)) {
      failAt(
        `generated data source "${generator}" is not supported; use inline values`,
        toJsonPointer([...path, generator]),
        state,
      );
    }
  }
}

function validateRecords(rows: unknown[], pointer: string, state: DataPolicyState): void {
  if (state.countedRows.has(rows)) return;
  state.countedRows.add(rows);
  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) {
      failAt('data.values entries must be objects', `${pointer}/${index}`, state);
    }
  }
  state.rowCount += rows.length;
}

function failAt(
  message: string,
  pointer: string,
  state: Pick<DataPolicyState, 'source' | 'positions'>,
): never {
  const location = state.positions.get(pointer) ?? state.positions.get(parentPointer(pointer));
  throw new VegaLiteError(`${pointer || '/'}: ${message}`, { ...(location ?? {}), pointer });
}

function parentPointer(pointer: string): string {
  return pointer.replace(/\/[^/]*$/, '');
}

function escapePointer(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
