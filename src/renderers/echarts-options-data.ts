import {
  fail,
  isEChartsRecord,
  validateEChartsRecord,
  validateEChartsSimpleObject,
  validateEChartsScalar,
  validateEChartsStringArray,
  type EChartsFieldRule,
  type EChartsValidationContext,
} from './echarts-options-fields.js';

export const MAX_ECHARTS_SERIES = 20;
export const MAX_ECHARTS_DATA_POINTS = 10_000;
export const MAX_ECHARTS_DATA_DIMENSIONS = 32;

export type EChartsChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'radar' | 'heatmap' | 'gauge';

export interface EChartsDataValidationResult {
  series: Record<string, unknown>[];
  chartTypes: Set<EChartsChartType>;
  pointCount: number;
  datasetDimensions?: string[];
}

const DATASET_ALLOWED_KEYS = new Set(['dimensions', 'source']);
const DATASET_ENCODE_KEYS = new Set(['x', 'y', 'value', 'itemName']);
const DATA_ITEM_STYLE_FIELDS: Record<string, EChartsFieldRule> = {
  color: 'color',
  borderColor: 'color',
  borderWidth: 'nonnegative',
  borderType: 'enum:solid|dashed|dotted',
  borderRadius: 'nonnegative',
  opacity: (value, path, context) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      fail(context, path, 'must be between 0 and 1');
    }
  },
};

export function validateEChartsData(
  option: Record<string, unknown>,
  positions: EChartsValidationContext['positions'],
  radarIndicatorCount: number | undefined,
): EChartsDataValidationResult {
  const context = { positions };
  const rawSeries = option.series;
  if (
    !Array.isArray(rawSeries) ||
    rawSeries.length === 0 ||
    rawSeries.length > MAX_ECHARTS_SERIES
  ) {
    fail(context, ['series'], `must contain between 1 and ${MAX_ECHARTS_SERIES} series`);
  }

  const series = rawSeries.map((item, index) =>
    validateEChartsRecord(item, ['series', index], context),
  );
  const chartTypes = new Set<EChartsChartType>();
  for (const [index, item] of series.entries()) {
    const type = item.type;
    if (!isSupportedChartType(type)) {
      fail(
        context,
        ['series', index, 'type'],
        'must be bar, line, pie, scatter, radar, heatmap, or gauge',
      );
    }
    chartTypes.add(type);
  }

  const dataset = option.dataset;
  if (dataset !== undefined) {
    return validateDatasetSeries(dataset, series, chartTypes, context, radarIndicatorCount);
  }
  let pointCount = 0;
  for (const [index, item] of series.entries()) {
    if (item.encode !== undefined || item.datasetIndex !== undefined) {
      fail(context, ['series', index], 'encode and datasetIndex require a root dataset.source');
    }
    const data = item.data;
    if (!Array.isArray(data) || data.length === 0) {
      fail(
        context,
        ['series', index, 'data'],
        'must be a non-empty array when dataset is not used',
      );
    }
    pointCount += data.length;
    if (pointCount > MAX_ECHARTS_DATA_POINTS) {
      fail(
        context,
        ['series', index, 'data'],
        `data exceeds the ${MAX_ECHARTS_DATA_POINTS} point limit`,
      );
    }
    data.forEach((point, pointIndex) =>
      validateDataPoint(
        point,
        item.type as EChartsChartType,
        ['series', index, 'data', pointIndex],
        context,
        radarIndicatorCount,
      ),
    );
  }
  return { series, chartTypes, pointCount };
}

export function isSupportedChartType(value: unknown): value is EChartsChartType {
  return (
    value === 'bar' ||
    value === 'line' ||
    value === 'pie' ||
    value === 'scatter' ||
    value === 'radar' ||
    value === 'heatmap' ||
    value === 'gauge'
  );
}

function validateDatasetSeries(
  value: unknown,
  series: Record<string, unknown>[],
  chartTypes: Set<EChartsChartType>,
  context: EChartsValidationContext,
  radarIndicatorCount: number | undefined,
): EChartsDataValidationResult {
  const dataset = validateEChartsRecord(value, ['dataset'], context);
  for (const key of Object.keys(dataset)) {
    if (!DATASET_ALLOWED_KEYS.has(key)) {
      fail(
        context,
        ['dataset', key],
        'is not supported; dataset transforms and external sources are disabled',
      );
    }
  }
  const dimensions = validateEChartsStringArray(
    dataset.dimensions,
    ['dataset', 'dimensions'],
    context,
    MAX_ECHARTS_DATA_DIMENSIONS,
  );
  if (dimensions.length === 0 || new Set(dimensions).size !== dimensions.length) {
    fail(context, ['dataset', 'dimensions'], 'must contain unique dimension names');
  }
  if (dataset.source === undefined) fail(context, ['dataset', 'source'], 'is required');
  const source = validateDatasetSource(dataset.source, dimensions, context);
  const pointCount = source.length;
  if (pointCount > MAX_ECHARTS_DATA_POINTS) {
    fail(context, ['dataset', 'source'], `source exceeds the ${MAX_ECHARTS_DATA_POINTS} row limit`);
  }

  for (const [index, item] of series.entries()) {
    if (item.data !== undefined) {
      fail(context, ['series', index, 'data'], 'cannot be combined with root dataset.source');
    }
    if (item.datasetIndex !== undefined && item.datasetIndex !== 0) {
      fail(context, ['series', index, 'datasetIndex'], 'only dataset index 0 is supported');
    }
    if (item.encode === undefined)
      fail(context, ['series', index, 'encode'], 'is required when using dataset.source');
    const encode = validateEChartsRecord(item.encode, ['series', index, 'encode'], context);
    for (const key of Object.keys(encode)) {
      if (!DATASET_ENCODE_KEYS.has(key)) {
        fail(context, ['series', index, 'encode', key], 'is not supported by the ECharts profile');
      }
    }
    const type = item.type as EChartsChartType;
    const required = requiredEncodeKeys(type);
    for (const key of required) {
      if (encode[key] === undefined)
        fail(context, ['series', index, 'encode', key], 'is required for this series type');
    }
    for (const [key, encodedDimension] of Object.entries(encode)) {
      validateEncodeDimension(
        encodedDimension,
        dimensions,
        ['series', index, 'encode', key],
        context,
      );
    }
    if (
      type === 'radar' &&
      Array.isArray(encode.value) &&
      radarIndicatorCount !== encode.value.length
    ) {
      fail(
        context,
        ['series', index, 'encode', 'value'],
        `must map exactly ${String(radarIndicatorCount)} radar dimensions`,
      );
    }
  }
  return { series, chartTypes, pointCount, datasetDimensions: dimensions };
}

function validateDatasetSource(
  value: unknown,
  dimensions: string[],
  context: EChartsValidationContext,
): unknown[][] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(context, ['dataset', 'source'], 'must be a non-empty array of rows');
  }
  value.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== dimensions.length) {
      fail(
        context,
        ['dataset', 'source', rowIndex],
        `must contain exactly ${dimensions.length} values`,
      );
    }
    row.forEach((cell, columnIndex) => {
      if (cell !== null && typeof cell !== 'string' && typeof cell !== 'number') {
        fail(
          context,
          ['dataset', 'source', rowIndex, columnIndex],
          'must be a string, finite number, or null',
        );
      }
      if (typeof cell === 'number' && !Number.isFinite(cell)) {
        fail(context, ['dataset', 'source', rowIndex, columnIndex], 'must be finite');
      }
      if (typeof cell === 'string') {
        validateEChartsScalar(cell, ['dataset', 'source', rowIndex, columnIndex], 'text', context);
      }
    });
  });
  return value as unknown[][];
}

function validateEncodeDimension(
  value: unknown,
  dimensions: string[],
  path: (string | number)[],
  context: EChartsValidationContext,
): void {
  const references = Array.isArray(value) ? value : [value];
  if (references.length === 0) fail(context, path, 'must reference at least one dataset dimension');
  references.forEach((reference, index) => {
    const referencePath = Array.isArray(value) ? [...path, index] : path;
    if (typeof reference === 'string') {
      if (!dimensions.includes(reference))
        fail(context, referencePath, `references missing dimension "${reference}"`);
    } else if (typeof reference === 'number' && Number.isInteger(reference)) {
      if (reference < 0 || reference >= dimensions.length)
        fail(context, referencePath, 'references a missing dataset dimension');
    } else {
      fail(context, referencePath, 'must be a dimension name, index, or array of dimensions');
    }
  });
}

function requiredEncodeKeys(type: EChartsChartType): readonly string[] {
  switch (type) {
    case 'bar':
    case 'line':
    case 'scatter':
      return ['x', 'y'];
    case 'heatmap':
      return ['x', 'y', 'value'];
    case 'pie':
      return ['itemName', 'value'];
    case 'gauge':
      return ['value'];
    case 'radar':
      return ['value'];
  }
}

function validateDataPoint(
  point: unknown,
  type: EChartsChartType,
  path: (string | number)[],
  context: EChartsValidationContext,
  radarIndicatorCount: number | undefined,
): void {
  if (type === 'bar' || type === 'line') {
    if (point === null || typeof point === 'number') {
      validateNullableNumber(point, path, context);
      return;
    }
    if (Array.isArray(point) && point.length === 2) {
      validateCategoryValue(point[0], [...path, 0], context);
      validateNullableNumber(point[1], [...path, 1], context);
      return;
    }
    if (isEChartsRecord(point)) {
      validateDataObject(point, path, context, { value: 'number-or-pair', name: true });
      validateNullableNumberOrPair(point.value, [...path, 'value'], context);
      return;
    }
    fail(context, path, 'must be a number, null, category/value pair, or supported data object');
  }
  if (type === 'scatter') {
    validateCoordinatePoint(point, path, context, 2);
    return;
  }
  if (type === 'heatmap') {
    validateCoordinatePoint(point, path, context, 3);
    const values = isEChartsRecord(point) ? point.value : point;
    validateNullableNumber(
      (values as unknown[])[2],
      [...path, ...(isEChartsRecord(point) ? ['value', 2] : [2])],
      context,
    );
    return;
  }
  if (type === 'pie' || type === 'gauge') {
    if (!isEChartsRecord(point))
      fail(context, path, 'must be an object with name and value fields');
    validateDataObject(point, path, context, { value: 'number', name: true });
    validateNullableNumber(point.value, [...path, 'value'], context);
    return;
  }
  if (type === 'radar') {
    if (!isEChartsRecord(point))
      fail(context, path, 'must be an object with name and value fields');
    validateDataObject(point, path, context, { value: 'array', name: true });
    if (!Array.isArray(point.value) || point.value.length !== radarIndicatorCount) {
      fail(context, [...path, 'value'], `must contain ${String(radarIndicatorCount)} radar values`);
    }
    point.value.forEach((item, index) =>
      validateNullableNumber(item, [...path, 'value', index], context),
    );
  }
}

function validateCoordinatePoint(
  point: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
  length: number,
): void {
  const value = isEChartsRecord(point) ? point.value : point;
  if (isEChartsRecord(point))
    validateDataObject(point, path, context, { value: 'array', name: true });
  if (!Array.isArray(value) || value.length !== length) {
    fail(context, path, `must be a ${length}-value coordinate tuple or supported data object`);
  }
  validateCategoryValue(
    value[0],
    [...path, ...(isEChartsRecord(point) ? ['value', 0] : [0])],
    context,
  );
  validateCategoryValue(
    value[1],
    [...path, ...(isEChartsRecord(point) ? ['value', 1] : [1])],
    context,
  );
}

function validateDataObject(
  value: Record<string, unknown>,
  path: (string | number)[],
  context: EChartsValidationContext,
  fields: { value: 'number' | 'number-or-pair' | 'array'; name: boolean },
): void {
  const schema = {
    value: (
      fieldValue: unknown,
      fieldPath: (string | number)[],
      fieldContext: EChartsValidationContext,
    ) => {
      if (fields.value === 'number') validateNullableNumber(fieldValue, fieldPath, fieldContext);
      if (fields.value === 'number-or-pair')
        validateNullableNumberOrPair(fieldValue, fieldPath, fieldContext);
      if (fields.value === 'array' && !Array.isArray(fieldValue))
        fail(fieldContext, fieldPath, 'must be an array');
    },
    ...(fields.name ? { name: 'text' as const } : {}),
    itemStyle: (
      fieldValue: unknown,
      fieldPath: (string | number)[],
      fieldContext: EChartsValidationContext,
    ) => validateEChartsSimpleObject(fieldValue, fieldPath, DATA_ITEM_STYLE_FIELDS, fieldContext),
  };
  validateEChartsSimpleObject(value, path, schema, context);
}

function validateNullableNumberOrPair(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
): void {
  if (Array.isArray(value) && value.length === 2) {
    validateCategoryValue(value[0], [...path, 0], context);
    validateNullableNumber(value[1], [...path, 1], context);
    return;
  }
  validateNullableNumber(value, path, context);
}

function validateNullableNumber(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
): void {
  if (value === null) return;
  validateEChartsScalar(value, path, 'number', context);
}

function validateCategoryValue(
  value: unknown,
  path: (string | number)[],
  context: EChartsValidationContext,
): void {
  if (typeof value === 'number') {
    validateEChartsScalar(value, path, 'number', context);
    return;
  }
  validateEChartsScalar(value, path, 'text', context);
}
