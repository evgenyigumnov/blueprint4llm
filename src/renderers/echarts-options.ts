import { commonSeries, rootSchema, seriesTypeFields } from './echarts-options-schema.js';
import {
  fail,
  isRecord,
  object,
  scalar,
  type Context,
  type JsonObject,
  type Path,
} from './echarts-options-validators.js';
import {
  isSupportedChartType,
  validateEChartsData,
  type EChartsChartType,
  type EChartsDataValidationResult,
} from './echarts-options-data.js';
import type { EChartsSourcePosition } from './echarts-source.js';

export const ECHARTS_POLICY_REVISION = 'echarts-static-profile-v1';
export const MAX_ECHARTS_SVG_BYTES = 4 * 1024 * 1024;
export const MAX_ECHARTS_CHART_SIDE = 1_600;
export const ECHARTS_FONT_FAMILY = 'Noto Sans, "DejaVu Sans", sans-serif';

export interface EChartsOptionPolicyResult {
  option: JsonObject;
  warnings: string[];
}

/** Enforces the documented option subset and normalizes output for static SVG rendering. */
export function applyEChartsOptionPolicy(
  input: JsonObject,
  width: number,
  height: number,
  positions: Map<string, EChartsSourcePosition>,
): EChartsOptionPolicyResult {
  const context = { positions };
  const option = structuredClone(input);
  object(rootSchema)(option, [], context);
  const radarCount = getRadarIndicatorCount(option.radar, context);
  const data = validateEChartsData(option, positions, radarCount);
  validateSeries(data.series, context);
  validateCoordinates(option, data, context);
  validateVisualMapCompatibility(option.visualMap, data, context);
  validateChartDimension(width, 'width', context);
  validateChartDimension(height, 'height', context);

  const warnings: string[] = [];
  if (option.animation === true || data.series.some((series) => series.animation === true)) {
    warnings.push('ECharts animation was requested but is disabled for static SVG output');
  }
  if (option.silent === false || data.series.some((series) => series.silent === false)) {
    warnings.push('ECharts interaction was requested but disabled for static SVG output');
  }
  if (
    data.series.some((series) => isEnabledState(series.emphasis) || isEnabledState(series.select))
  ) {
    warnings.push(
      'ECharts emphasis and selection effects were requested but are disabled for static SVG output',
    );
  }

  option.animation = false;
  option.silent = true;
  option.textStyle = {
    fontFamily: ECHARTS_FONT_FAMILY,
    ...(isRecord(option.textStyle) ? option.textStyle : {}),
  };
  if (option.backgroundColor === undefined) option.backgroundColor = '#ffffff';
  option.series = data.series.map((series) => ({
    ...series,
    animation: false,
    silent: true,
    emphasis: { disabled: true },
    select: { disabled: true },
  }));
  return { option, warnings };
}

function validateSeries(series: JsonObject[], context: Context): void {
  for (const [index, item] of series.entries()) {
    const type = item.type;
    if (!isSupportedChartType(type)) continue;
    const schema = { ...commonSeries, ...seriesTypeFields[type] };
    object(schema)(item, ['series', index], context);
    for (const key of ['xAxisIndex', 'yAxisIndex'] as const) {
      if (
        item[key] !== undefined &&
        (typeof item[key] !== 'number' || !Number.isInteger(item[key]) || item[key] < 0)
      ) {
        fail(context, ['series', index, key], 'must be a non-negative integer');
      }
    }
    if (item.coordinateSystem !== undefined) {
      const expected = type === 'radar' ? 'radar' : isCartesian(type) ? 'cartesian2d' : undefined;
      if (item.coordinateSystem !== expected) {
        fail(
          context,
          ['series', index, 'coordinateSystem'],
          'uses an incompatible coordinate system',
        );
      }
    }
    if (
      type === 'gauge' &&
      typeof item.min === 'number' &&
      typeof item.max === 'number' &&
      item.min >= item.max
    ) {
      fail(context, ['series', index, 'max'], 'must be greater than min');
    }
    if (
      type === 'gauge' &&
      typeof item.max === 'number' &&
      item.min === undefined &&
      item.max <= 0
    ) {
      fail(context, ['series', index, 'max'], 'must be greater than the default min value 0');
    }
  }
}

function validateCoordinates(
  option: JsonObject,
  data: EChartsDataValidationResult,
  context: Context,
): void {
  const families = new Set([...data.chartTypes].map(family));
  if (families.size !== 1) fail(context, ['series'], 'cannot mix incompatible coordinate systems');
  const cartesian = families.has('cartesian');
  const xAxes = listLength(option.xAxis);
  const yAxes = listLength(option.yAxis);
  if (cartesian && (xAxes === 0 || yAxes === 0)) {
    fail(context, ['series'], 'cartesian series require xAxis and yAxis options');
  }
  if (
    !cartesian &&
    (option.xAxis !== undefined || option.yAxis !== undefined || option.grid !== undefined)
  ) {
    fail(context, ['xAxis'], 'axes and grid are only supported for cartesian series');
  }
  if (families.has('radar') && option.radar === undefined)
    fail(context, ['radar'], 'is required for radar series');
  if (!families.has('radar') && option.radar !== undefined)
    fail(context, ['radar'], 'is only supported for radar series');
  for (const [index, item] of data.series.entries()) {
    if (!isCartesian(item.type as EChartsChartType)) {
      if (item.xAxisIndex !== undefined || item.yAxisIndex !== undefined) {
        fail(context, ['series', index], 'axis indexes do not apply to this series type');
      }
      continue;
    }
    const xIndex = (item.xAxisIndex as number | undefined) ?? 0;
    const yIndex = (item.yAxisIndex as number | undefined) ?? 0;
    if (xIndex >= xAxes)
      fail(context, ['series', index, 'xAxisIndex'], 'references a missing xAxis');
    if (yIndex >= yAxes)
      fail(context, ['series', index, 'yAxisIndex'], 'references a missing yAxis');
  }
}

function validateVisualMapCompatibility(
  value: unknown,
  data: EChartsDataValidationResult,
  context: Context,
): void {
  const heatmap = data.chartTypes.has('heatmap');
  if (heatmap && value === undefined)
    fail(context, ['visualMap'], 'is required for heatmap series');
  if (!heatmap && value !== undefined)
    fail(context, ['visualMap'], 'is only supported for heatmap series');
  if (!isRecord(value)) return;
  if (typeof value.min !== 'number' || typeof value.max !== 'number' || value.min >= value.max) {
    fail(context, ['visualMap'], 'requires min and max values where min is less than max');
  }
  const colors = isRecord(value.inRange) ? value.inRange.color : undefined;
  if (!Array.isArray(colors) || colors.length < 2) {
    fail(context, ['visualMap', 'inRange', 'color'], 'must provide at least two gradient colors');
  }
  if (value.dimension !== undefined) {
    if (data.datasetDimensions === undefined && value.dimension !== 2) {
      fail(
        context,
        ['visualMap', 'dimension'],
        'inline heatmap data uses dimension 2 for its value',
      );
    }
    if (
      data.datasetDimensions !== undefined &&
      !data.datasetDimensions.includes(String(value.dimension)) &&
      !(
        typeof value.dimension === 'number' &&
        Number.isInteger(value.dimension) &&
        value.dimension >= 0 &&
        value.dimension < data.datasetDimensions.length
      )
    ) {
      fail(context, ['visualMap', 'dimension'], 'references a missing dataset dimension');
    }
  }
}

function getRadarIndicatorCount(value: unknown, context: Context): number | undefined {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    !Array.isArray(value.indicator) ||
    value.indicator.length === 0 ||
    value.indicator.length > 32
  ) {
    fail(context, ['radar', 'indicator'], 'must contain between 1 and 32 indicators');
  }
  value.indicator.forEach((entry, index) => {
    const path: Path = ['radar', 'indicator', index];
    if (!isRecord(entry)) fail(context, path, 'must be an object');
    object({ name: scalar('text'), min: scalar('number'), max: scalar('number') })(
      entry,
      path,
      context,
    );
    if (typeof entry.min === 'number' && typeof entry.max === 'number' && entry.min >= entry.max) {
      fail(context, [...path, 'max'], 'must be greater than min');
    }
  });
  return value.indicator.length;
}

function validateChartDimension(value: number, name: string, context: Context): void {
  if (!Number.isInteger(value) || value < 240 || value > MAX_ECHARTS_CHART_SIDE) {
    fail(context, [name], 'must be an integer between 240 and ' + MAX_ECHARTS_CHART_SIDE);
  }
}

function listLength(value: unknown): number {
  return value === undefined ? 0 : Array.isArray(value) ? value.length : 1;
}

function family(type: EChartsChartType): 'cartesian' | 'radar' | 'standalone' {
  if (isCartesian(type)) return 'cartesian';
  return type === 'radar' ? 'radar' : 'standalone';
}

function isCartesian(type: EChartsChartType): boolean {
  return type === 'bar' || type === 'line' || type === 'scatter' || type === 'heatmap';
}

function isEnabledState(value: unknown): boolean {
  return isRecord(value) && value.disabled !== true;
}
