import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { D2Error } from '../src/renderers/d2-error.js';
import { d2Renderer, MAX_D2_SOURCE_BYTES } from '../src/renderers/d2.js';
import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';

const context = {
  diagramId: 'bp-diagram-001',
  sourceFile: '/tmp/architecture.md',
  line: 1,
};

const completeSource = [
  'direction: right',
  'vars: { d2-config: { layout-engine: elk; theme-id: 0 } }',
  'client: Клиент { web: Веб приложение }',
  'service: API заказов {',
  '  orders: { shape: sql_table; id: int { constraint: primary_key }; customer_id: int }',
  '  Order: { shape: class; +id: string; +load(): Order }',
  '}',
  'flow: {',
  '  shape: sequence_diagram',
  '  customer: Клиент',
  '  api: API',
  '  customer -> api: создать заказ',
  '  api -> customer: подтвердить',
  '}',
  'client.web -> service: HTTPS',
  'service.orders -> service.Order: хранит',
  'service.orders -> service.orders: обновить',
].join('\n');

describe('D2 renderer', () => {
  it.each([
    ['SQL tables', 'd2-sql-table.d2', ['Customers', 'customer_id', 'FK']],
    ['UML classes', 'd2-uml-class.d2', ['recalculate', 'Repository']],
    ['sequence diagrams', 'd2-sequence.d2', ['validate order', 'confirmation']],
  ])('renders the %s acceptance fixture', async (_name, filename, labels) => {
    const source = await readFile(new URL(`./fixtures/${filename}`, import.meta.url), 'utf8');
    const result = await d2Renderer.render(source, context);
    expect(() => parseAndValidateSvg(result.svg)).not.toThrow();
    for (const label of labels) expect(result.svg).toContain(label);
  });

  it('renders containers, SQL tables, UML classes, sequence diagrams, and Cyrillic with ELK', async () => {
    const result = await d2Renderer.render(completeSource, context);
    const svg = parseAndValidateSvg(result.svg);

    expect(svg.properties.width).toBeDefined();
    expect(svg.properties.height).toBeDefined();
    expect(result.svg).toContain('viewBox="0 0');
    expect(result.svg).toContain('Noto Sans');
    expect(result.svg).toContain('Веб приложение');
    expect(result.svg).toContain('создать заказ');
    expect(result.svg).not.toContain('@font-face');
    expect(result.svg).not.toContain('data:application/font-woff');
    expect(result.warnings).toEqual([]);
  });

  it('renders arrow directions, nested containers, classes, and styles with the default Dagre layout', async () => {
    const source = [
      'direction: down',
      'classes: { highlighted: { style.fill: "#dbeafe"; style.stroke: "#1d4ed8" } }',
      'outer: { inner: { shape: cylinder; class: highlighted } }',
      'a -> outer.inner: forward',
      'a <- outer.inner: reverse',
      'a <-> outer.inner: both',
      'a -- outer.inner: undirected',
    ].join('\n');
    const result = await d2Renderer.render(source, context);

    expect(result.svg).toContain('forward');
    expect(result.svg).toContain('reverse');
    expect(result.svg).toContain('both');
    expect(result.svg).toContain('undirected');
    expect(result.svg).toContain('#dbeafe');
    expect(() => parseAndValidateSvg(result.svg)).not.toThrow();
  });

  it('rejects empty, oversized, and metadata-bearing blocks before compiling', async () => {
    await expect(d2Renderer.render('  \n', context)).rejects.toThrow('D2 block is empty');
    await expect(
      d2Renderer.render('a -> b', { ...context, metadata: 'layout=elk' }),
    ).rejects.toThrow(/metadata is not supported/);
    await expect(d2Renderer.render('a'.repeat(MAX_D2_SOURCE_BYTES + 1), context)).rejects.toThrow(
      /D2 source is too large/,
    );
    await expect(d2Renderer.render('direction: down', context)).rejects.toThrow(
      /no visible objects/,
    );
  });

  it('reports invalid D2 source locations and rejects imports from its one-file virtual filesystem', async () => {
    await expect(d2Renderer.render('a ->', context)).rejects.toMatchObject({
      name: 'D2Error',
      line: 1,
      column: 1,
    });
    await expect(d2Renderer.render('x: @../../secret', context)).rejects.toThrow(
      /import|file does not exist/i,
    );
  });

  it('does not cache errors and includes profile, fonts, and adapter revisions in its key', async () => {
    expect(d2Renderer.cacheKey).toContain('@d2lang/d2@0.1.34');
    expect(d2Renderer.cacheKey).toContain('NotoSans');
    expect(d2Renderer.cacheKey).toContain('svg-adapter-v1');
    await expect(d2Renderer.render('a ->', context)).rejects.toBeInstanceOf(D2Error);
  });

  it('terminates an aborted Wasm worker and can render again afterwards', async () => {
    const controller = new AbortController();
    const pending = d2Renderer.render('client -> service', {
      ...context,
      signal: controller.signal,
    });
    const timer = setTimeout(() => controller.abort(new Error('superseded source')), 1);

    await expect(pending).rejects.toThrow('superseded source');
    clearTimeout(timer);
    await expect(d2Renderer.render('client -> service', context)).resolves.toMatchObject({
      warnings: [],
    });
  });
});
