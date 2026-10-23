import { describe, expect, it, vi } from 'vitest';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { renderDiagramImage } from '../src/image-export.js';
import { renderPdf } from '../src/pdf.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { loadVegaLiteAssets } from '../src/renderers/vega-lite-assets.js';
import { renderVegaLiteInPage } from '../src/renderers/vega-lite-page.js';
import { VEGA_LITE_RENDER_TIMEOUT_MS } from '../src/renderers/vega-lite-page.js';
import { MAX_VEGA_LITE_SOURCE_BYTES } from '../src/renderers/vega-lite.js';
import { vegaLiteRenderer } from '../src/renderers/vega-lite.js';
import { VEGA_LITE_SCHEMA_SHA256 } from '../src/renderers/vega-lite-schema.js';
import { createPreviewHtml } from '../src/server/html.js';

const CHART_SPEC = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  title: 'API latency by environment',
  description: 'P95 latency in milliseconds',
  width: 480,
  height: 240,
  data: {
    values: [
      { environment: 'Dev', latency: 85 },
      { environment: 'Stage', latency: 120 },
      { environment: 'Prod', latency: 95 },
    ],
  },
  mark: 'bar',
  encoding: {
    x: { field: 'environment', type: 'nominal', title: 'Environment' },
    y: { field: 'latency', type: 'quantitative', title: 'P95, ms' },
    color: { field: 'environment', type: 'nominal', legend: null },
  },
};

function fenced(spec: unknown, language = 'vega-lite'): string {
  return `# Chart\n\n\`\`\`${language}\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
}

function compactFenced(spec: unknown, language = 'vega-lite'): string {
  return `# Chart\n\n\`\`\`${language}\n${JSON.stringify(spec)}\n\`\`\``;
}

describe('Vega-Lite renderer integration', () => {
  it('keys cached output by package, schema, policy, defaults, locale, and timezone', () => {
    expect(vegaLiteRenderer.cacheKey).toContain('vega-lite@6.5.0');
    expect(vegaLiteRenderer.cacheKey).toContain('vega@6.4.0');
    expect(vegaLiteRenderer.cacheKey).toContain('ajv-8.20.0');
    expect(vegaLiteRenderer.cacheKey).toContain(VEGA_LITE_SCHEMA_SHA256);
    expect(vegaLiteRenderer.cacheKey).toContain('vega-lite-static-policy-v1');
    expect(vegaLiteRenderer.cacheKey).toContain('defaults=480x300');
    expect(vegaLiteRenderer.cacheKey).toContain('locale=en-US');
    expect(vegaLiteRenderer.cacheKey).toContain('timezone=UTC');
  });

  it('renders the documented chart as a complete static SVG and preserves color in dark mode', async () => {
    const compiled = await compileMarkdown(fenced(CHART_SPEC), { sourceFile: '/tmp/chart.md' });
    const preview = createPreviewHtml(compiled, 'test-version');

    expect(compiled.errors).toEqual([]);
    expect(compiled.warnings).toEqual([]);
    expect(compiled.html).toContain('class="bp-diagram bp-diagram--vega-lite"');
    expect(compiled.html).toContain('API latency by environment');
    expect(compiled.html).toContain('Environment');
    expect(compiled.html).toContain('P95, ms');
    expect(compiled.html).toContain('Dev');
    expect(compiled.html).toContain('Stage');
    expect(compiled.html).toContain('Prod');
    expect(compiled.html).toMatch(/<svg[^>]*width="\d+(?:\.\d+)?"[^>]*height="\d+(?:\.\d+)?"/);
    expect(preview).toContain('.bp-diagram--vega-lite{background:#fff}');
    expect(preview).toMatch(
      /\.bp-diagram:not\([^)]*vega-lite\):not\([^)]*bp-diagram--echarts\)[^>]*>svg/,
    );
  });

  it('supports both fence aliases through the compiler and checker while ordinary JSON stays code', async () => {
    const compiled = await compileMarkdown(fenced(CHART_SPEC, 'vegalite'), {
      sourceFile: '/tmp/alias.md',
    });
    const checked = await checkMarkdown(fenced(CHART_SPEC), { sourceFile: '/tmp/check.md' });
    const plainJson = await compileMarkdown('```json\n{"mark":"point"}\n```', {
      sourceFile: '/tmp/json.md',
    });

    expect(compiled.html).toContain('bp-diagram--vega-lite');
    expect(checked.errors).toEqual([]);
    expect(plainJson.html).not.toContain('bp-diagram--vega-lite');
    expect(plainJson.html).toContain('language-json');
  });

  it('renders UTC time, aggregates, stacks, layers, facets, repeats, lookups, folds, text, and boxplots', async () => {
    const spec = {
      data: {
        values: [
          { day: '2025-01-01T00:00:00Z', region: 'North', category: 'A', sales: 10, cost: 3 },
          { day: '2025-02-01T00:00:00Z', region: 'North', category: 'B', sales: 20, cost: 7 },
          { day: '2025-01-01T00:00:00Z', region: 'South', category: 'A', sales: 15, cost: 6 },
          { day: '2025-02-01T00:00:00Z', region: 'South', category: 'B', sales: 25, cost: 9 },
        ],
      },
      datasets: {
        labels: [
          { key: 'A', label: 'Category A' },
          { key: 'B', label: 'Category B' },
        ],
      },
      vconcat: [
        {
          title: 'UTC line',
          transform: [{ timeUnit: 'yearmonth', field: 'day', as: 'month' }],
          mark: 'line',
          encoding: {
            x: { field: 'month', type: 'temporal' },
            y: { field: 'sales', type: 'quantitative' },
            color: { field: 'region', type: 'nominal' },
          },
        },
        {
          title: 'Aggregate and stack',
          transform: [
            {
              aggregate: [{ op: 'sum', field: 'sales', as: 'total' }],
              groupby: ['category', 'region'],
            },
          ],
          mark: 'bar',
          encoding: {
            x: { field: 'category', type: 'nominal' },
            y: { field: 'total', type: 'quantitative', aggregate: 'sum' },
            color: { field: 'region', type: 'nominal' },
          },
        },
        {
          title: 'Layered marks',
          layer: [
            { mark: 'bar' },
            { mark: { type: 'text', dy: -8 }, encoding: { text: { field: 'region' } } },
          ],
          encoding: {
            x: { field: 'category', type: 'nominal' },
            y: { field: 'sales', type: 'quantitative' },
          },
        },
        {
          title: 'Faceted marks',
          facet: { column: { field: 'region', type: 'nominal' } },
          spec: {
            mark: 'point',
            encoding: {
              x: { field: 'category', type: 'nominal' },
              y: { field: 'sales', type: 'quantitative' },
            },
          },
        },
        {
          title: 'Repeated fields',
          repeat: { column: ['sales', 'cost'] },
          spec: {
            mark: 'point',
            encoding: {
              x: { field: { repeat: 'column' }, type: 'quantitative' },
              y: { field: 'sales', type: 'quantitative' },
            },
          },
        },
        {
          title: 'Inline lookup',
          transform: [
            {
              lookup: 'category',
              from: { data: { name: 'labels' }, key: 'key', fields: ['label'] },
              as: ['categoryName'],
            },
          ],
          mark: 'text',
          encoding: {
            x: { field: 'category', type: 'nominal' },
            y: { field: 'sales', type: 'quantitative' },
            text: { field: 'categoryName', type: 'nominal' },
          },
        },
        {
          title: 'Calculated and joined text',
          transform: [
            {
              joinaggregate: [{ op: 'sum', field: 'sales', as: 'regionTotal' }],
              groupby: ['region'],
            },
            { calculate: 'datum.regionTotal * 2', as: 'doubledTotal' },
          ],
          mark: 'text',
          encoding: {
            x: { field: 'region', type: 'nominal' },
            y: { field: 'doubledTotal', type: 'quantitative' },
            text: { field: 'doubledTotal', type: 'quantitative' },
          },
        },
        {
          title: 'Folded values',
          transform: [{ fold: ['sales', 'cost'], as: ['metric', 'value'] }],
          mark: 'point',
          encoding: {
            x: { field: 'metric', type: 'nominal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'region', type: 'nominal' },
          },
        },
        {
          title: 'Boxplot',
          mark: 'boxplot',
          encoding: {
            x: { field: 'category', type: 'nominal' },
            y: { field: 'sales', type: 'quantitative' },
          },
        },
      ],
    };
    const compiled = await compileMarkdown(fenced(spec), { sourceFile: '/tmp/compositions.md' });

    expect(compiled.errors).toEqual([]);
    expect(compiled.html).toContain('2025');
    expect(compiled.html).toContain('Category A');
    expect(compiled.html).toContain('Category B');
    expect(compiled.html).toContain('40');
    expect(compiled.html).toContain('70');
    expect(compiled.html).toContain('Boxplot');
  }, 45_000);

  it('maps strict JSON and format errors to body and Markdown source coordinates', async () => {
    const invalidJson = await compileMarkdown('```vega-lite\n{"mark":"point",}\n```', {
      sourceFile: '/tmp/invalid.md',
    });
    const externalData = await compileMarkdown(
      '```vega-lite\n{\n  "data": { "url": "https://example.test/data.json" },\n  "mark": "point"\n}\n```',
      { sourceFile: '/tmp/external.md' },
    );

    expect(invalidJson.diagnostics?.[0]).toMatchObject({
      renderer: 'vega-lite',
      line: 2,
      column: 17,
    });
    expect((invalidJson.errors ?? []).join('\n')).toContain('invalid Vega-Lite JSON');
    expect(externalData.diagnostics?.[0]).toMatchObject({ line: 3, column: 13 });
    expect((externalData.errors ?? []).join('\n')).toContain('external data is not supported');
  });

  it('uses the shared warning and cache path, including one tooltip warning', async () => {
    const cache = new DiagramRenderCache();
    const renderSpy = vi.spyOn(vegaLiteRenderer, 'render');
    const tooltipSpec = {
      ...CHART_SPEC,
      encoding: {
        ...CHART_SPEC.encoding,
        tooltip: [{ field: 'latency', type: 'quantitative' }],
      },
    };
    try {
      const first = await compileMarkdown(fenced(tooltipSpec), {
        sourceFile: '/tmp/first-tooltip.md',
        diagramCache: cache,
      });
      const second = await compileMarkdown(`Intro\n\n${fenced(tooltipSpec)}`, {
        sourceFile: '/tmp/second-tooltip.md',
        diagramCache: cache,
      });

      expect(cache.size).toBe(1);
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(first.warnings).toHaveLength(1);
      expect(second.warnings).toHaveLength(1);
      expect(second.diagnostics?.[0]).toMatchObject({
        sourceFile: '/tmp/second-tooltip.md',
        line: 5,
      });
      expect(first.html).toContain('static export does not provide interactive tooltips');
    } finally {
      renderSpy.mockRestore();
    }
  });

  it('rejects single-image exports unless exactly one supported diagram is present', async () => {
    await expect(
      compileMarkdown('# No chart', {
        sourceFile: '/tmp/empty.md',
        requireSingleDiagram: true,
      }),
    ).rejects.toThrow('found 0');
    await expect(
      compileMarkdown(`${fenced(CHART_SPEC)}\n\n${fenced(CHART_SPEC)}`, {
        sourceFile: '/tmp/two.md',
        requireSingleDiagram: true,
      }),
    ).rejects.toThrow('found 2');
  });

  it('rejects a Vega-Lite source block above the byte limit before launching Chromium', async () => {
    const source = `\`\`\`vega-lite\n${' '.repeat(MAX_VEGA_LITE_SOURCE_BYTES + 1)}\n\`\`\``;
    const compiled = await compileMarkdown(source, { sourceFile: '/tmp/oversized.md' });

    expect(compiled.html).not.toContain('<svg');
    expect((compiled.errors ?? []).join('\n')).toContain(
      `limit ${MAX_VEGA_LITE_SOURCE_BYTES} bytes`,
    );
  });

  it('rejects computed datasets above 50,000 rows before SVG serialization', async () => {
    const spec = {
      data: { values: Array.from({ length: 5_001 }, () => ({ value: 1 })) },
      transform: [{ fold: Array.from({ length: 10 }, () => 'value') }],
      mark: 'point',
      encoding: { x: { field: 'value', type: 'quantitative' } },
    };
    const compiled = await compileMarkdown(fenced(spec), { sourceFile: '/tmp/row-limit.md' });

    expect(compiled.html).not.toContain('<svg');
    expect((compiled.errors ?? []).join('\n')).toContain(
      'computed dataset "data_0" has too many rows: 50010 (limit 50000)',
    );
  }, 30_000);

  it('rejects a scenegraph above 50,000 items before SVG serialization', async () => {
    const spec = {
      data: { values: Array.from({ length: 10_000 }, () => ({ value: 1 })) },
      layer: Array.from({ length: 6 }, () => ({ mark: 'point' })),
      encoding: { y: { field: 'value', type: 'quantitative' } },
    };
    const compiled = await compileMarkdown(compactFenced(spec), {
      sourceFile: '/tmp/scenegraph-limit.md',
    });

    expect(compiled.html).not.toContain('<svg');
    expect((compiled.errors ?? []).join('\n')).toContain(
      'Vega scenegraph has too many items: more than 50000',
    );
  }, 30_000);

  it('denies Vega loader requests inside the isolated browser page', async () => {
    const assets = await loadVegaLiteAssets();
    await expect(
      renderVegaLiteInPage(
        {
          data: { url: 'https://example.test/blocked.json' },
          mark: 'point',
        },
        assets,
      ),
    ).rejects.toThrow('blocked resource load');
  });

  it('closes an active browser render when its AbortSignal fires', async () => {
    const assets = await loadVegaLiteAssets();
    const controller = new AbortController();
    const rendering = renderVegaLiteInPage(
      {
        data: {
          values: [
            { x: 'A', y: 1 },
            { x: 'B', y: 2 },
          ],
        },
        mark: 'point',
        encoding: {
          x: { field: 'x', type: 'nominal' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
      assets,
      controller.signal,
    );
    const abortTimer = setTimeout(() => controller.abort(new Error('test render cancelled')), 100);
    try {
      await expect(rendering).rejects.toThrow('test render cancelled');
    } finally {
      clearTimeout(abortTimer);
    }
  });

  it('closes the local page server when the Node-side render timeout fires', async () => {
    const assets = await loadVegaLiteAssets();
    let signalLaunchStarted: (() => void) | undefined;
    const launchStarted = new Promise<void>((resolve) => {
      signalLaunchStarted = resolve;
    });
    const launch = vi.spyOn(puppeteer, 'launch').mockImplementation(
      () =>
        new Promise<Browser>(() => {
          signalLaunchStarted?.();
        }),
    );
    vi.useFakeTimers();
    const rendering = renderVegaLiteInPage({ mark: 'point' }, assets);
    try {
      await launchStarted;
      const rejected = expect(rendering).rejects.toThrow(
        `Vega-Lite rendering timed out after ${VEGA_LITE_RENDER_TIMEOUT_MS} ms`,
      );
      await vi.advanceTimersByTimeAsync(VEGA_LITE_RENDER_TIMEOUT_MS);
      await rejected;
      expect(launch).toHaveBeenCalledOnce();
    } finally {
      launch.mockRestore();
      vi.useRealTimers();
    }
  }, 10_000);

  it('exports the chart to SVG, PNG, JPEG, and PDF', async () => {
    const compiled = await compileMarkdown(fenced(CHART_SPEC), { sourceFile: '/tmp/export.md' });
    const svg = await renderDiagramImage(compiled.html, 'svg');
    const png = await renderDiagramImage(compiled.html, 'png');
    const jpeg = await renderDiagramImage(compiled.html, 'jpeg');
    const pdf = await renderPdf(compiled);

    expect(typeof svg).toBe('string');
    expect(svg).toContain('API latency by environment');
    expect(Buffer.from(png as Uint8Array).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(Buffer.from(jpeg as Uint8Array).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe('%PDF-');
  }, 90_000);
});
