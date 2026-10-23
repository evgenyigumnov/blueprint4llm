import type { EChartsChartType } from './echarts-options-data.js';
import {
  arrayOf,
  enumeration,
  fail,
  ignore,
  isRecord,
  object,
  objectList,
  optionalColor,
  scalar,
  validateAxisBound,
  validateAxisInterval,
  validateBoundaryGap,
  validateColorOrGradient,
  validateDimension,
  validateFontWeight,
  validateGaugeStops,
  validateOpacity,
  validatePadding,
  validatePair,
  validateSize,
  validateSizePair,
  validateSmooth,
  validateSymbol,
  validateSymbolSize,
  falseOnly,
  legacyContainLabel,
  type Context,
  type Path,
  type Schema,
} from './echarts-options-validators.js';

const fontFamily = (value: unknown, path: Path, context: Context): void => {
  scalar('text')(value, path, context);
  if (typeof value === 'string' && /["&<]/.test(value)) {
    fail(context, path, 'must not contain double quotes, ampersands, or less-than signs');
  }
};

const textStyle = object({
  color: scalar('color'),
  fontStyle: enumeration('normal', 'italic', 'oblique'),
  fontWeight: validateFontWeight,
  fontSize: scalar('positive'),
  fontFamily,
  lineHeight: scalar('nonnegative'),
  width: scalar('nonnegative'),
  overflow: enumeration('truncate', 'break', 'breakAll'),
  align: enumeration('left', 'center', 'right'),
  verticalAlign: enumeration('top', 'middle', 'bottom'),
  backgroundColor: validateColorOrGradient,
  borderColor: scalar('color'),
  borderWidth: scalar('nonnegative'),
  borderRadius: scalar('nonnegative'),
  padding: validatePadding,
});

const lineStyle = object({
  color: scalar('color'),
  width: scalar('nonnegative'),
  type: enumeration('solid', 'dashed', 'dotted'),
  opacity: validateOpacity,
  cap: enumeration('butt', 'round', 'square'),
  join: enumeration('bevel', 'round', 'miter'),
  curveness: scalar('number'),
});

const itemStyle = object({
  color: validateColorOrGradient,
  borderColor: scalar('color'),
  borderWidth: scalar('nonnegative'),
  borderType: enumeration('solid', 'dashed', 'dotted'),
  borderRadius: scalar('nonnegative'),
  opacity: validateOpacity,
  shadowBlur: scalar('nonnegative'),
  shadowColor: scalar('color'),
  shadowOffsetX: scalar('number'),
  shadowOffsetY: scalar('number'),
});

const areaStyle = object({
  color: validateColorOrGradient,
  opacity: validateOpacity,
  origin: enumeration('auto', 'start', 'end'),
});

const label = object({
  show: scalar('boolean'),
  position: enumeration(
    'top',
    'left',
    'right',
    'bottom',
    'inside',
    'insideLeft',
    'insideRight',
    'insideTop',
    'insideBottom',
    'insideTopLeft',
    'insideBottomLeft',
    'insideTopRight',
    'insideBottomRight',
    'outside',
    'center',
  ),
  distance: scalar('nonnegative'),
  rotate: scalar('number'),
  offset: validatePair,
  formatter: scalar('formatter'),
  color: scalar('color'),
  fontSize: scalar('positive'),
  fontFamily,
  fontWeight: validateFontWeight,
  align: enumeration('left', 'center', 'right'),
  verticalAlign: enumeration('top', 'middle', 'bottom'),
  backgroundColor: scalar('color'),
  borderColor: scalar('color'),
  borderWidth: scalar('nonnegative'),
  borderRadius: scalar('nonnegative'),
  padding: validatePadding,
  opacity: validateOpacity,
});

const title = object({
  show: scalar('boolean'),
  text: scalar('text'),
  subtext: scalar('text'),
  left: scalar('position'),
  top: scalar('position'),
  right: scalar('position'),
  bottom: scalar('position'),
  itemGap: scalar('nonnegative'),
  padding: validatePadding,
  backgroundColor: validateColorOrGradient,
  borderColor: scalar('color'),
  borderWidth: scalar('nonnegative'),
  borderRadius: scalar('nonnegative'),
  textStyle,
  subtextStyle: textStyle,
});

const legend = object({
  show: scalar('boolean'),
  type: enumeration('plain'),
  orient: enumeration('horizontal', 'vertical'),
  left: scalar('position'),
  top: scalar('position'),
  right: scalar('position'),
  bottom: scalar('position'),
  width: scalar('position'),
  height: scalar('position'),
  itemWidth: scalar('nonnegative'),
  itemHeight: scalar('nonnegative'),
  itemGap: scalar('nonnegative'),
  icon: validateSymbol,
  data: arrayOf(scalar('text'), 0, 200),
  formatter: scalar('formatter'),
  textStyle,
  selectedMode: falseOnly,
});

const grid = object({
  show: scalar('boolean'),
  left: scalar('position'),
  right: scalar('position'),
  top: scalar('position'),
  bottom: scalar('position'),
  width: scalar('position'),
  height: scalar('position'),
  containLabel: legacyContainLabel,
  backgroundColor: scalar('color'),
  borderColor: scalar('color'),
  borderWidth: scalar('nonnegative'),
  shadowBlur: scalar('nonnegative'),
  shadowColor: scalar('color'),
});

const axis = object({
  type: enumeration('category', 'value', 'time'),
  name: scalar('text'),
  show: scalar('boolean'),
  position: enumeration('top', 'bottom', 'left', 'right'),
  offset: scalar('number'),
  nameLocation: enumeration('start', 'middle', 'center', 'end'),
  nameGap: scalar('nonnegative'),
  nameRotate: scalar('number'),
  nameTextStyle: textStyle,
  inverse: scalar('boolean'),
  boundaryGap: validateBoundaryGap,
  min: validateAxisBound,
  max: validateAxisBound,
  scale: scalar('boolean'),
  splitNumber: scalar('positive'),
  minInterval: scalar('positive'),
  maxInterval: scalar('positive'),
  interval: validateAxisInterval,
  logBase: scalar('positive'),
  data: arrayOf(scalar('text'), 0, 10_000),
  axisLine: object({ show: scalar('boolean'), onZero: scalar('boolean'), lineStyle }),
  axisTick: object({
    show: scalar('boolean'),
    alignWithLabel: scalar('boolean'),
    inside: scalar('boolean'),
    length: scalar('nonnegative'),
    lineStyle,
  }),
  axisLabel: object({
    show: scalar('boolean'),
    interval: validateAxisInterval,
    rotate: scalar('number'),
    margin: scalar('nonnegative'),
    formatter: scalar('formatter'),
    color: scalar('color'),
    fontSize: scalar('positive'),
    fontFamily,
    fontWeight: validateFontWeight,
    align: enumeration('left', 'center', 'right'),
    verticalAlign: enumeration('top', 'middle', 'bottom'),
    hideOverlap: scalar('boolean'),
    showMinLabel: scalar('boolean'),
    showMaxLabel: scalar('boolean'),
  }),
  splitLine: object({ show: scalar('boolean'), interval: validateAxisInterval, lineStyle }),
  splitArea: object({ show: scalar('boolean'), interval: validateAxisInterval, areaStyle }),
});

const radar = object({
  shape: enumeration('polygon', 'circle'),
  radius: validateSizePair,
  center: validatePair,
  startAngle: scalar('number'),
  splitNumber: scalar('positive'),
  name: object({ show: scalar('boolean'), formatter: scalar('formatter'), textStyle }),
  axisLine: object({ show: scalar('boolean'), lineStyle }),
  splitLine: object({ show: scalar('boolean'), lineStyle }),
  splitArea: object({ show: scalar('boolean'), areaStyle }),
  indicator: validateRadarIndicators,
});

const visualMap = object({
  type: enumeration('continuous'),
  min: scalar('number'),
  max: scalar('number'),
  dimension: validateDimension,
  orient: enumeration('horizontal', 'vertical'),
  left: scalar('position'),
  top: scalar('position'),
  right: scalar('position'),
  bottom: scalar('position'),
  itemWidth: scalar('nonnegative'),
  itemHeight: scalar('nonnegative'),
  precision: scalar('integer'),
  calculable: falseOnly,
  realtime: falseOnly,
  text: arrayOf(scalar('text'), 0, 2),
  inRange: object({ color: arrayOf(scalar('color'), 2, 16) }),
  outOfRange: object({ color: arrayOf(scalar('color'), 1, 16) }),
  textStyle,
  inverse: scalar('boolean'),
  show: scalar('boolean'),
});

export const commonSeries: Schema = {
  type: scalar('string'),
  name: scalar('text'),
  data: ignore,
  encode: ignore,
  datasetIndex: scalar('integer'),
  xAxisIndex: scalar('integer'),
  yAxisIndex: scalar('integer'),
  coordinateSystem: enumeration('cartesian2d', 'radar'),
  label,
  itemStyle,
  lineStyle,
  areaStyle,
  emphasis: object({ disabled: scalar('boolean') }),
  select: object({ disabled: scalar('boolean') }),
  silent: scalar('boolean'),
  animation: scalar('boolean'),
  selectedMode: falseOnly,
};

export const seriesTypeFields: Record<EChartsChartType, Schema> = {
  bar: {
    stack: scalar('text'),
    barWidth: validateSize,
    barMaxWidth: validateSize,
    barMinHeight: scalar('nonnegative'),
    barGap: validateSize,
    barCategoryGap: validateSize,
    showBackground: scalar('boolean'),
    backgroundStyle: itemStyle,
    roundCap: scalar('boolean'),
  },
  line: {
    stack: scalar('text'),
    smooth: validateSmooth,
    step: enumeration('start', 'middle', 'end'),
    connectNulls: scalar('boolean'),
    showSymbol: scalar('boolean'),
    symbol: validateSymbol,
    symbolSize: validateSymbolSize,
  },
  scatter: { symbol: validateSymbol, symbolSize: validateSymbolSize },
  pie: {
    radius: validateSizePair,
    center: validatePair,
    roseType: enumeration('radius', 'area'),
    clockwise: scalar('boolean'),
    startAngle: scalar('number'),
    minAngle: scalar('nonnegative'),
    padAngle: scalar('nonnegative'),
    avoidLabelOverlap: scalar('boolean'),
    stillShowZeroSum: scalar('boolean'),
    percentPrecision: scalar('integer'),
    labelLine: object({
      show: scalar('boolean'),
      length: scalar('nonnegative'),
      length2: scalar('nonnegative'),
      smooth: scalar('boolean'),
      lineStyle,
    }),
  },
  radar: { symbol: validateSymbol, symbolSize: validateSymbolSize },
  heatmap: {
    blurSize: scalar('nonnegative'),
    minOpacity: validateOpacity,
    maxOpacity: validateOpacity,
  },
  gauge: {
    min: scalar('number'),
    max: scalar('number'),
    startAngle: scalar('number'),
    endAngle: scalar('number'),
    splitNumber: scalar('positive'),
    radius: validateSizePair,
    center: validatePair,
    axisLine: object({
      show: scalar('boolean'),
      lineStyle: object({ width: scalar('nonnegative'), color: validateGaugeStops }),
    }),
    axisTick: object({
      show: scalar('boolean'),
      distance: scalar('nonnegative'),
      length: scalar('nonnegative'),
      lineStyle,
    }),
    splitLine: object({
      show: scalar('boolean'),
      distance: scalar('nonnegative'),
      length: scalar('nonnegative'),
      lineStyle,
    }),
    axisLabel: object({
      show: scalar('boolean'),
      distance: scalar('nonnegative'),
      formatter: scalar('formatter'),
      color: scalar('color'),
      fontSize: scalar('positive'),
      fontFamily,
    }),
    pointer: object({
      show: scalar('boolean'),
      icon: validateSymbol,
      length: scalar('position'),
      width: scalar('nonnegative'),
      itemStyle,
    }),
    progress: object({
      show: scalar('boolean'),
      overlap: scalar('boolean'),
      width: scalar('nonnegative'),
      itemStyle,
    }),
    anchor: object({ show: scalar('boolean'), size: scalar('nonnegative'), itemStyle }),
    detail: object({
      show: scalar('boolean'),
      formatter: scalar('formatter'),
      color: scalar('color'),
      fontSize: scalar('positive'),
      fontFamily,
      fontWeight: validateFontWeight,
      offsetCenter: validatePair,
    }),
    title: object({
      show: scalar('boolean'),
      formatter: scalar('formatter'),
      color: scalar('color'),
      fontSize: scalar('positive'),
      fontFamily,
      fontWeight: validateFontWeight,
      offsetCenter: validatePair,
    }),
  },
};

export const rootSchema: Schema = {
  title,
  legend,
  grid: objectList(grid, 4),
  xAxis: objectList(axis, 4),
  yAxis: objectList(axis, 4),
  radar,
  visualMap,
  dataset: ignore,
  series: ignore,
  color: arrayOf(validateColorOrGradient, 1, 32),
  backgroundColor: optionalColor,
  textStyle,
  animation: scalar('boolean'),
  silent: scalar('boolean'),
};

function validateRadarIndicators(value: unknown, path: Path, context: Context): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) {
    fail(context, path, 'must contain between 1 and 32 indicators');
  }
  value.forEach((entry, index) => {
    const indicatorPath: Path = [...path, index];
    if (!isRecord(entry)) fail(context, indicatorPath, 'must be an object');
    object({ name: scalar('text'), min: scalar('number'), max: scalar('number') })(
      entry,
      indicatorPath,
      context,
    );
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      fail(context, [...indicatorPath, 'name'], 'is required and cannot be empty');
    }
    if (typeof entry.min === 'number' && typeof entry.max === 'number' && entry.min >= entry.max) {
      fail(context, [...indicatorPath, 'max'], 'must be greater than min');
    }
  });
}
