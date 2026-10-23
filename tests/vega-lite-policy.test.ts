import { describe, expect, it } from 'vitest';

import { applyVegaLitePolicy } from '../src/renderers/vega-lite-policy.js';
import { parseVegaLiteSource } from '../src/renderers/vega-lite-source.js';

function apply(spec: Record<string, unknown>) {
  return applyVegaLitePolicy(spec, JSON.stringify(spec), new Map());
}

describe('Vega-Lite static format policy', () => {
  it('sets safe background, font, and unit view dimensions', () => {
    const spec: Record<string, unknown> = { mark: 'bar' };
    expect(apply(spec).warnings).toEqual([]);
    expect(spec.background).toBe('white');
    expect(spec.config).toMatchObject({ font: 'sans-serif' });
    expect(spec.width).toBe(480);
    expect(spec.height).toBe(300);
  });

  it('preserves explicit styles, sizes, and transparent backgrounds', () => {
    const spec = {
      background: null,
      config: { font: 'Inter', view: { background: 'transparent' } },
      width: 240,
      height: { step: 24 },
      mark: 'bar',
    } as Record<string, unknown>;
    apply(spec);
    expect(spec.background).toBeNull();
    expect(spec.config).toEqual({ font: 'Inter', view: { background: 'transparent' } });
    expect(spec.width).toBe(240);
    expect(spec.height).toEqual({ step: 24 });
  });

  it('preserves dimensions and background supplied through Vega-Lite config', () => {
    const spec: Record<string, unknown> = {
      mark: 'point',
      config: {
        background: '#111111',
        view: { continuousWidth: 220, continuousHeight: 160 },
      },
    };
    apply(spec);
    expect(spec.background).toBeUndefined();
    expect(spec.width).toBeUndefined();
    expect(spec.height).toBeUndefined();
  });

  it('accepts only the exact v6 schema identifier', () => {
    expect(() =>
      apply({ $schema: 'https://vega.github.io/schema/vega-lite/v5.json', mark: 'point' }),
    ).toThrow(
      '/$schema: unsupported Vega-Lite schema; expected https://vega.github.io/schema/vega-lite/v6.json',
    );
  });

  it('does not merge user configuration through prototype setters', () => {
    const parsed = parseVegaLiteSource(
      '{"mark":"point","data":{"values":[]},"config":{"__proto__":{"polluted":true}}}',
    );
    const spec = parsed.value;
    applyVegaLitePolicy(spec, '', parsed.positions);
    const config = spec.config as Record<string, unknown>;
    expect(Object.getPrototypeOf(config)).toBeNull();
    expect(Object.hasOwn(config, '__proto__')).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('accepts supported marks and compositions', () => {
    for (const mark of [
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
    ]) {
      expect(() => apply({ mark })).not.toThrow();
    }
    expect(() => apply({ layer: [{ mark: 'bar' }, { mark: 'line' }] })).not.toThrow();
    expect(() => apply({ hconcat: [{ mark: 'bar' }, { mark: 'line' }] })).not.toThrow();
    expect(() => apply({ vconcat: [{ mark: 'bar' }, { mark: 'line' }] })).not.toThrow();
    expect(() => apply({ concat: [{ mark: 'bar' }, { mark: 'line' }] })).not.toThrow();
    expect(() =>
      apply({ facet: { row: { field: 'group' } }, spec: { mark: 'point' } }),
    ).not.toThrow();
    expect(() => apply({ repeat: { column: ['a', 'b'] }, spec: { mark: 'point' } })).not.toThrow();
  });

  it('rejects image, geographic, and unsupported marks', () => {
    expect(() => apply({ mark: 'image' })).toThrow('image marks are not supported');
    expect(() => apply({ mark: 'geoshape' })).toThrow('mark "geoshape" is not supported');
    expect(() => apply({ mark: 'unknown' })).toThrow('mark "unknown" is not supported');
  });

  it('accepts embedded rows, empty data, null sources, and ordinary URL values', () => {
    expect(() => apply({ mark: 'point', data: { values: [] } })).not.toThrow();
    expect(() => apply({ mark: 'point', data: null })).not.toThrow();
    expect(() =>
      apply({
        mark: 'point',
        data: { values: [{ url: 'https://example.test/data.json', href: 'ordinary value' }] },
      }),
    ).not.toThrow();
    expect(() =>
      apply({ mark: 'point', usermeta: { data: { url: 'https://example.test/metadata.json' } } }),
    ).not.toThrow();
  });

  it('resolves each named dataset once, including lookup sources', () => {
    const rows = Array.from({ length: 10_000 }, (_value, index) => ({ id: index }));
    const spec = {
      datasets: { users: rows },
      data: { name: 'users' },
      transform: [{ lookup: 'id', from: { data: { name: 'users' }, key: 'id', fields: ['id'] } }],
      mark: 'point',
    };
    expect(() => apply(spec)).not.toThrow();
  });

  it('allows inline lookup tables and supported transforms', () => {
    const spec = {
      data: { values: [{ id: 1, value: 4 }] },
      transform: [
        { filter: 'datum.value > 0' },
        { calculate: 'datum.value * 2', as: 'double' },
        { aggregate: [{ op: 'sum', field: 'double', as: 'total' }] },
        { joinaggregate: [{ op: 'count', as: 'count' }] },
        { bin: true, field: 'double' },
        { timeUnit: 'year', field: 'date' },
        { stack: 'value', groupby: ['id'] },
        { fold: ['a', 'b'] },
        {
          lookup: 'id',
          from: { data: { values: [{ id: 1, label: 'one' }] }, key: 'id', fields: ['label'] },
        },
      ],
      mark: 'point',
    };
    expect(() => apply(spec)).not.toThrow();
  });

  it('rejects external data and unresolved data or lookup names', () => {
    expect(() => apply({ data: { url: 'file:///etc/passwd' }, mark: 'point' })).toThrow(
      'external data is not supported; use data.values or datasets',
    );
    expect(() => apply({ data: { name: 'missing' }, mark: 'point' })).toThrow(
      'unknown dataset: missing',
    );
    expect(() =>
      apply({
        data: { values: [] },
        transform: [
          { lookup: 'id', from: { data: { url: 'https://example.test/data.json' }, key: 'id' } },
        ],
        mark: 'point',
      }),
    ).toThrow('external data is not supported');
    expect(() =>
      apply({
        data: { values: [] },
        transform: [{ lookup: 'id', from: { data: { name: 'missing' }, key: 'id' } }],
        mark: 'point',
      }),
    ).toThrow('unknown dataset: missing');
    expect(() => apply({ data: { sequence: { start: 1, stop: 10 } }, mark: 'point' })).toThrow(
      'generated data source "sequence" is not supported',
    );
  });

  it('requires object rows and counts distinct facet values when estimating views', () => {
    expect(() => apply({ data: { values: [1] }, mark: 'point' })).toThrow(
      'data.values entries must be objects',
    );
    const rows = Array.from({ length: 101 }, (_value, index) => ({
      group: { name: `group-${index}` },
    }));
    expect(() =>
      apply({
        data: { values: rows },
        facet: { row: { field: 'group.name' } },
        spec: { mark: 'point' },
      }),
    ).toThrow('too many views after facet/repeat expansion: 101');
  });

  it('rejects unsupported transforms, legacy selections, and interactive params', () => {
    expect(() => apply({ transform: [{ density: 'value' }], mark: 'line' })).toThrow(
      'transform "density" is not supported',
    );
    expect(() => apply({ selection: { brush: { type: 'interval' } }, mark: 'point' })).toThrow(
      'legacy selection is not supported',
    );
    for (const property of ['select', 'bind', 'expr']) {
      expect(() => apply({ params: [{ name: 'mode', [property]: {} }], mark: 'point' })).toThrow(
        'interactive parameters are not supported',
      );
    }
    expect(() => apply({ params: [{ name: 'constant', value: 3 }], mark: 'point' })).not.toThrow();
  });

  it('accepts tooltip with one static-export warning per block', () => {
    const result = apply({
      encoding: { tooltip: [{ field: 'value', type: 'quantitative' }] },
      mark: 'point',
    });
    expect(result.warnings).toEqual([
      'tooltip is accepted, but static export does not provide interactive tooltips',
    ]);
  });

  it('rejects geographic projection, href, container sizing, resize, and CSS URLs', () => {
    expect(() => apply({ mark: 'point', projection: { type: 'mercator' } })).toThrow(
      'geographic projections',
    );
    expect(() =>
      apply({ mark: 'point', encoding: { href: { field: 'url', type: 'nominal' } } }),
    ).toThrow('href encoding');
    expect(() => apply({ mark: 'point', href: 'https://example.test' })).toThrow('href values');
    expect(() => apply({ mark: 'point', width: 'container' })).toThrow('width: "container"');
    expect(() => apply({ mark: 'point', autosize: { type: 'fit', resize: true } })).toThrow(
      'automatic resize',
    );
    expect(() => apply({ mark: 'point', autosize: 'fit-x' })).toThrow('automatic resize');
    expect(() => apply({ mark: 'point', width: 5_000 })).toThrow('no larger than 4096 px');
    expect(() => apply({ mark: 'point', width: 4_096, height: 4_096 })).toThrow(
      'view area exceeds',
    );
    expect(() =>
      apply({ mark: 'point', config: { bar: { fill: 'url(https://example.test/fill.svg)' } } }),
    ).toThrow('external CSS url() resources');
    expect(() =>
      apply({ mark: 'point', config: { bar: { fill: 'url(#local-gradient)' } } }),
    ).not.toThrow();
  });

  it('checks the total source-row limit across data values and datasets', () => {
    const rows = Array.from({ length: 10_001 }, (_value, index) => ({ index }));
    expect(() => apply({ data: { values: rows }, mark: 'point' })).toThrow(
      'too many source rows: 10001',
    );
  });

  it('checks transform and expanded view limits before launching Chromium', () => {
    expect(() =>
      apply({ transform: Array.from({ length: 101 }, () => ({ filter: 'true' })), mark: 'point' }),
    ).toThrow('too many transforms: 101');
    expect(() =>
      apply({
        repeat: { column: Array.from({ length: 101 }, (_value, index) => String(index)) },
        spec: { mark: 'point' },
      }),
    ).toThrow('too many views after facet/repeat expansion');
    expect(() => apply({ concat: Array.from({ length: 101 }, () => ({ mark: 'point' })) })).toThrow(
      'too many views after facet/repeat expansion',
    );
  });
});
