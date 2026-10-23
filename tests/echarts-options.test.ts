import { describe, expect, it } from 'vitest';

import {
  isEChartsRecord,
  validateEChartsColorArray,
  validateEChartsFields,
  validateEChartsFormatter,
  validateEChartsRecord,
  validateEChartsScalar,
  validateEChartsSimpleObject,
  validateEChartsStringArray,
} from '../src/renderers/echarts-options-fields.js';
import {
  MAX_ECHARTS_DATA_DIMENSIONS,
  MAX_ECHARTS_DATA_POINTS,
  MAX_ECHARTS_SERIES,
  isSupportedChartType,
  validateEChartsData,
} from '../src/renderers/echarts-options-data.js';
import { applyEChartsOptionPolicy } from '../src/renderers/echarts-options.js';

const positions = new Map([['/title/text', { line: 3, column: 12 }]]);
const context = { positions };

function apply(option: Record<string, unknown>, width = 800, height = 450) {
  return applyEChartsOptionPolicy(option, width, height, positions);
}

function cartesianSeries(type: 'bar' | 'line' | 'scatter' | 'heatmap', data: unknown[] = [1]) {
  return {
    xAxis: { type: 'category', data: ['A', 'B'] },
    yAxis: { type: 'value' },
    series: [{ type, data }],
  };
}

describe('ECharts option field validators', () => {
  it('validates records, scalar rules, callbacks, arrays, and formatter templates', () => {
    expect(isEChartsRecord({ value: 1 })).toBe(true);
    expect(isEChartsRecord([])).toBe(false);
    expect(validateEChartsRecord({ value: 1 }, [], context)).toEqual({ value: 1 });
    expect(() => validateEChartsRecord(null, [], context)).toThrow('must be an object');

    for (const [value, rule] of [
      [true, 'boolean'],
      ['text', 'string'],
      ['long text', 'text'],
      [1.5, 'number'],
      [0, 'nonnegative'],
      [2, 'positive'],
      [2, 'integer'],
      ['#abc', 'color'],
      ['45%', 'position'],
      ['{b}: {c}', 'formatter'],
      ['bar', 'enum:bar|line'],
    ] as const) {
      expect(() => validateEChartsScalar(value, [], rule, context)).not.toThrow();
    }
    for (const [value, rule] of [
      [1, 'boolean'],
      ['x'.repeat(4_097), 'text'],
      [Infinity, 'number'],
      [-1, 'nonnegative'],
      [0, 'positive'],
      [1.2, 'integer'],
      ['url(https://example.test)', 'color'],
      ['100 px', 'position'],
      ['<b>{value}</b>', 'formatter'],
      ['{unknown}', 'formatter'],
      ['pie', 'enum:bar|line'],
    ] as const) {
      expect(() => validateEChartsScalar(value, [], rule, context)).toThrow();
    }

    let callbackCalled = false;
    validateEChartsFields(
      { title: 'ok', custom: true },
      [],
      {
        title: 'text',
        custom: (value) => {
          callbackCalled = value === true;
        },
      },
      context,
    );
    expect(callbackCalled).toBe(true);
    expect(() => validateEChartsFields({ unknown: 1 }, [], {}, context)).toThrow(
      'is not supported',
    );
    expect(
      validateEChartsSimpleObject({ color: '#123456' }, [], { color: 'color' }, context),
    ).toEqual({ color: '#123456' });
    expect(validateEChartsStringArray(['A', 'B'], [], context, 2)).toEqual(['A', 'B']);
    expect(() => validateEChartsStringArray(['A', 1], [], context)).toThrow();
    expect(
      validateEChartsColorArray(['#abc', 'rgba(0, 1, 2, .5)'], [], context, 2, 2),
    ).toHaveLength(2);
    expect(() => validateEChartsColorArray([], [], context)).toThrow();
    validateEChartsFormatter('{value}%', [], context);
    expect(() => validateEChartsFormatter(() => 'no', [], context)).toThrow();
    expect(() => validateEChartsScalar(2, ['title', 'text'], 'text', context)).toThrow(
      expect.objectContaining({ line: 3, column: 12, pointer: '/title/text' }),
    );
  });
});

describe('ECharts chart data validation', () => {
  it('accepts each supported chart type and inline point shape', () => {
    const cases: Array<[string, Record<string, unknown>, number | undefined]> = [
      [
        'bar',
        {
          xAxis: { type: 'category', data: ['A', 'B'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [1, null, ['C', 3], { name: 'D', value: null }] }],
        },
        undefined,
      ],
      [
        'line',
        {
          xAxis: { type: 'category', data: ['A'] },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: [{ value: ['A', 2] }] }],
        },
        undefined,
      ],
      [
        'scatter',
        {
          xAxis: { type: 'value' },
          yAxis: { type: 'value' },
          series: [{ type: 'scatter', data: [[1, 2], { name: 'B', value: [3, 4] }] }],
        },
        undefined,
      ],
      ['pie', { series: [{ type: 'pie', data: [{ name: 'A', value: 2 }] }] }, undefined],
      [
        'radar',
        {
          radar: {
            indicator: [
              { name: 'A', max: 10 },
              { name: 'B', max: 10 },
            ],
          },
          series: [{ type: 'radar', data: [{ name: 'One', value: [2, 3] }] }],
        },
        2,
      ],
      [
        'heatmap',
        {
          xAxis: { type: 'category', data: ['A'] },
          yAxis: { type: 'category', data: ['B'] },
          visualMap: { min: 0, max: 5, inRange: { color: ['#fff', '#000'] } },
          series: [{ type: 'heatmap', data: [[0, 0, 2]] }],
        },
        undefined,
      ],
      ['gauge', { series: [{ type: 'gauge', data: [{ name: 'A', value: 50 }] }] }, undefined],
    ];
    expect(isSupportedChartType('gauge')).toBe(true);
    expect(isSupportedChartType('map')).toBe(false);
    for (const [type, option, radarCount] of cases) {
      const result = validateEChartsData(option, positions, radarCount);
      expect(result.chartTypes.has(type as never)).toBe(true);
    }
  });

  it('validates rectangular datasets, encode references, and row limits', () => {
    const option = {
      dataset: {
        dimensions: ['month', 'sales'],
        source: [
          ['Jan', 10],
          ['Feb', null],
        ],
      },
      series: [{ type: 'bar', encode: { x: 'month', y: 'sales' } }],
    };
    expect(validateEChartsData(option, positions, undefined)).toMatchObject({
      pointCount: 2,
      datasetDimensions: ['month', 'sales'],
    });
    expect(() =>
      validateEChartsData(
        { ...option, dataset: { ...option.dataset, source: [['Jan']] } },
        positions,
        undefined,
      ),
    ).toThrow('exactly 2 values');
    expect(() =>
      validateEChartsData(
        { ...option, dataset: { ...option.dataset, transform: [] } },
        positions,
        undefined,
      ),
    ).toThrow('transforms');
    expect(() =>
      validateEChartsData(
        { ...option, series: [{ type: 'bar', encode: { x: 'missing', y: 'sales' } }] },
        positions,
        undefined,
      ),
    ).toThrow('references missing dimension');
    expect(() =>
      validateEChartsData(
        { ...option, series: [{ type: 'bar', encode: { x: 'month' } }] },
        positions,
        undefined,
      ),
    ).toThrow('is required');
  });

  it('accepts exact series, point, dataset row, and dimension limits', () => {
    const series = Array.from({ length: MAX_ECHARTS_SERIES }, (_, index) => ({
      type: 'bar',
      data: Array.from({ length: MAX_ECHARTS_DATA_POINTS / MAX_ECHARTS_SERIES }, () => index),
    }));
    expect(validateEChartsData({ series }, positions, undefined).pointCount).toBe(
      MAX_ECHARTS_DATA_POINTS,
    );
    expect(() =>
      validateEChartsData({ series: [...series, series[0]] }, positions, undefined),
    ).toThrow(`between 1 and ${MAX_ECHARTS_SERIES} series`);

    const dimensions = Array.from(
      { length: MAX_ECHARTS_DATA_DIMENSIONS },
      (_, index) => `D${index}`,
    );
    const source = Array.from({ length: MAX_ECHARTS_DATA_POINTS }, (_, index) => [
      `M${index}`,
      ...Array.from({ length: MAX_ECHARTS_DATA_DIMENSIONS - 1 }, () => index),
    ]);
    const datasetOption = {
      dataset: { dimensions, source },
      series: [{ type: 'bar', encode: { x: 'D0', y: 'D1' } }],
    };
    expect(validateEChartsData(datasetOption, positions, undefined)).toMatchObject({
      pointCount: MAX_ECHARTS_DATA_POINTS,
      datasetDimensions: dimensions,
    });
    expect(() =>
      validateEChartsData(
        {
          ...datasetOption,
          dataset: { ...datasetOption.dataset, dimensions: [...dimensions, 'D32'] },
        },
        positions,
        undefined,
      ),
    ).toThrow(`at most ${MAX_ECHARTS_DATA_DIMENSIONS} strings`);
  });

  it('rejects unsupported points, invalid counts, and mixed static chart families', () => {
    expect(() => validateEChartsData({ series: [] }, positions, undefined)).toThrow('series');
    expect(() =>
      validateEChartsData({ series: [{ type: 'map', data: [1] }] }, positions, undefined),
    ).toThrow('must be bar');
    expect(() =>
      validateEChartsData({ series: [{ type: 'bar', data: ['bad'] }] }, positions, undefined),
    ).toThrow('must be a number');
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        series: [
          { type: 'bar', data: [1] },
          { type: 'pie', data: [{ name: 'A', value: 1 }] },
        ],
      }),
    ).toThrow('incompatible coordinate systems');
    expect(() =>
      validateEChartsData(
        { series: [{ type: 'bar', data: Array.from({ length: 10_001 }, () => 1) }] },
        positions,
        undefined,
      ),
    ).toThrow('point limit');
  });
});

describe('ECharts option policy', () => {
  it('normalizes static output and supplies the white background and font defaults', () => {
    const option = { ...cartesianSeries('bar'), animation: true, silent: false };
    const result = apply(option);
    expect(result.option).toMatchObject({
      animation: false,
      silent: true,
      backgroundColor: '#ffffff',
    });
    expect(result.option.textStyle).toMatchObject({
      fontFamily: 'Noto Sans, DejaVu Sans, sans-serif',
    });
    expect(result.option.series).toMatchObject([
      { animation: false, silent: true, emphasis: { disabled: true }, select: { disabled: true } },
    ]);
    expect(result.warnings).toEqual([
      'ECharts animation was requested but is disabled for static SVG output',
      'ECharts interaction was requested but disabled for static SVG output',
    ]);
  });

  it('rejects font families that would break ECharts SVG style attributes', () => {
    for (const fontFamily of ['"DejaVu Sans"', 'A&B', 'A<B']) {
      expect(() => apply({ ...cartesianSeries('bar'), textStyle: { fontFamily } })).toThrow(
        '/textStyle/fontFamily: must not contain double quotes, ampersands, or less-than signs',
      );
    }
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        title: { textStyle: { fontFamily: '"DejaVu Sans"' } },
      }),
    ).toThrow('/title/textStyle/fontFamily');
    expect(() =>
      apply({ ...cartesianSeries('bar'), textStyle: { fontFamily: 'Noto Sans, DejaVu Sans' } }),
    ).not.toThrow();
  });

  it('accepts mixed bar and line, dataset charts, and documented chart-specific options', () => {
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        series: [
          { type: 'bar', data: [1] },
          { type: 'line', data: [2], smooth: 0.5, symbol: 'circle', symbolSize: [8, 10] },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      apply({
        dataset: { dimensions: ['x', 'y'], source: [['A', 3]] },
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', encode: { x: 'x', y: 'y' }, barWidth: '40%' }],
      }),
    ).not.toThrow();
    expect(() =>
      apply({
        radar: {
          indicator: [
            { name: 'A', min: 0, max: 10 },
            { name: 'B', max: 10 },
          ],
          shape: 'circle',
          radius: ['20%', '80%'],
          center: ['50%', '55%'],
        },
        series: [
          { type: 'radar', data: [{ name: 'One', value: [5, 7] }], areaStyle: { opacity: 0.2 } },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      apply({
        visualMap: { min: 0, max: 10, dimension: 2, inRange: { color: ['#fff', '#000'] } },
        xAxis: { type: 'category', data: ['A'] },
        yAxis: { type: 'category', data: ['B'] },
        series: [{ type: 'heatmap', data: [[0, 0, 2]], label: { show: true, offset: [0, 1] } }],
      }),
    ).not.toThrow();
    expect(() =>
      apply({
        series: [
          {
            type: 'gauge',
            min: 0,
            max: 100,
            progress: { show: false },
            axisLine: { lineStyle: { color: [[1, '#123456']] } },
            data: [{ value: 40 }],
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        color: [
          {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#123456' },
              { offset: 1, color: '#abcdef' },
            ],
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        series: [{ type: 'bar', data: [1], itemStyle: { color: { type: 'linear' } } }],
      }),
    ).toThrow('is required for a linear gradient');
  });

  it('rejects unprofiled features and reports source location with JSON Pointer', () => {
    expect(() => apply({ ...cartesianSeries('bar'), tooltip: {} })).toThrow(
      '/tooltip: is not supported',
    );
    expect(() => apply({ ...cartesianSeries('bar'), grid: { containLabel: true } })).toThrow(
      'set explicit grid margins',
    );
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        xAxis: { type: 'category', data: ['A'], axisLabel: { formatter: '<img>' } },
      }),
    ).toThrow('plain text formatter');
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        series: [{ type: 'bar', data: [1], emphasis: { focus: 'series' } }],
      }),
    ).toThrow('is not supported');
    try {
      apply({ title: { text: 2 }, series: [{ type: 'pie', data: [{ name: 'A', value: 1 }] }] });
    } catch (error) {
      expect(error).toMatchObject({ line: 3, column: 12, pointer: '/title/text' });
    }
  });

  it('checks chart-specific bounds, coordinate indexes, visual maps, and dimensions', () => {
    expect(() =>
      apply({ series: [{ type: 'pie', data: [{ name: 'A', value: 1 }] }] }, 240, 1_600),
    ).not.toThrow();
    expect(() =>
      apply({ ...cartesianSeries('bar'), series: [{ type: 'bar', xAxisIndex: 2, data: [1] }] }),
    ).toThrow('references a missing xAxis');
    expect(() =>
      apply({
        ...cartesianSeries('bar'),
        series: [{ type: 'bar', data: [1], coordinateSystem: 'radar' }],
      }),
    ).toThrow('incompatible coordinate system');
    expect(() =>
      apply({
        radar: { indicator: [{ name: 'A', min: 10, max: 10 }] },
        series: [{ type: 'radar', data: [{ value: [1] }] }],
      }),
    ).toThrow('greater than min');
    expect(() =>
      apply({ series: [{ type: 'gauge', min: 20, max: 10, data: [{ value: 3 }] }] }),
    ).toThrow('greater than min');
    expect(() =>
      apply({ ...cartesianSeries('heatmap'), series: [{ type: 'heatmap', data: [[0, 0, 1]] }] }),
    ).toThrow('visualMap');
    expect(() =>
      apply({ series: [{ type: 'pie', data: [{ name: 'A', value: 1 }] }] }, 239),
    ).toThrow('integer between 240 and 1600');
    expect(() =>
      apply({ series: [{ type: 'pie', data: [{ name: 'A', value: 1 }] }] }, 800, 1_601),
    ).toThrow('integer between 240 and 1600');
  });
});
