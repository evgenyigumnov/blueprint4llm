import { EventEmitter } from 'node:events';
import type { Worker, WorkerOptions } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { echartsRenderer } from '../src/renderers/echarts.js';
import {
  ECHARTS_RENDER_TIMEOUT_MS,
  type EChartsWorkerFactory,
  getEChartsWorkerExecArgv,
  renderEChartsInWorker,
} from '../src/renderers/echarts-runner.js';
import { createPreviewHtml } from '../src/server/html.js';

function fenced(source: string, metadata = ''): string {
  return '```echarts' + (metadata ? ' ' + metadata : '') + '\n' + source + '\n```';
}

const SIMPLE_BAR = JSON.stringify({
  title: { text: 'Заявки по средам' },
  xAxis: { type: 'category', data: ['Север', 'Юг'] },
  yAxis: { type: 'value', name: 'Заявки' },
  series: [{ type: 'bar', name: 'Заявки', data: [3, 5] }],
});

describe('ECharts renderer integration', () => {
  it('renders all documented chart types, mixed series, and dataset in the compiler', async () => {
    const markdown = await readFile(
      new URL('../examples/blueprint-echarts.md', import.meta.url),
      'utf8',
    );
    const compiled = await compileMarkdown(markdown, { sourceFile: '/tmp/echarts-example.md' });
    const checked = await checkMarkdown(markdown, { sourceFile: '/tmp/echarts-check.md' });
    const preview = createPreviewHtml(compiled, 'test-version');

    expect(compiled.errors).toEqual([]);
    expect(compiled.warnings).toEqual([]);
    expect(checked.errors).toEqual([]);
    expect(compiled.html.match(/bp-diagram--echarts/g)).toHaveLength(7);
    expect(compiled.html.match(/<svg\b/g)).toHaveLength(7);
    expect(compiled.html).toContain('Запросы по кварталам');
    expect(compiled.html).toContain('Ожидаемый рост запросов');
    expect(preview).toContain('.bp-diagram--echarts{background:#fff}');
    expect(preview).toMatch(/\.bp-diagram:not\([^)]*\):not\([^)]*bp-diagram--echarts\)[^>]*>svg/);
  }, 45_000);

  it('keeps dimensions, returns a static SVG, and leaves ordinary JSON as code', async () => {
    const compiled = await compileMarkdown(fenced(SIMPLE_BAR, 'width=960 height=600'), {
      sourceFile: '/tmp/echarts-size.md',
    });
    const plainJson = await compileMarkdown('```json\n{"series":[]}\n```', {
      sourceFile: '/tmp/plain-json.md',
    });

    expect(compiled.errors).toEqual([]);
    expect(compiled.html).toContain('bp-diagram--echarts');
    expect(compiled.html).toMatch(/<svg[^>]*width="960"[^>]*height="600"/);
    expect(compiled.html).toContain('Заявки по средам');
    expect(compiled.html).not.toContain('@keyframes');
    expect(plainJson.html).not.toContain('bp-diagram--echarts');
    expect(plainJson.html).toContain('language-json');
  });

  it('maps JSON and profile failures to the Markdown block source location', async () => {
    const invalidJson = await compileMarkdown(fenced('{"series":[],}'), {
      sourceFile: '/tmp/echarts-invalid-json.md',
    });
    const unsupported = await compileMarkdown(
      '```echarts\n{\n  "series": [{"type":"pie","data":[{"name":"A","value":1}]}],\n  "tooltip": {}\n}\n```',
      { sourceFile: '/tmp/echarts-tooltip.md' },
    );

    expect(invalidJson.diagnostics?.[0]).toMatchObject({
      renderer: 'echarts',
      line: 2,
      column: 14,
    });
    expect((invalidJson.errors ?? []).join('\n')).toContain('invalid ECharts JSON');
    expect(unsupported.diagnostics?.[0]).toMatchObject({
      renderer: 'echarts',
      line: 4,
      column: 3,
    });
    expect((unsupported.errors ?? []).join('\n')).toContain('/tooltip: is not supported');
  });

  it('shares cached output and reports static normalization warnings once', async () => {
    const cache = new DiagramRenderCache();
    const renderSpy = vi.spyOn(echartsRenderer, 'render');
    const animated = JSON.stringify({
      animation: true,
      xAxis: { type: 'category', data: ['A'] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [1] }],
    });
    try {
      const first = await compileMarkdown(fenced(animated), {
        sourceFile: '/tmp/echarts-cache-first.md',
        diagramCache: cache,
      });
      const second = await compileMarkdown('Intro\n\n' + fenced(animated), {
        sourceFile: '/tmp/echarts-cache-second.md',
        diagramCache: cache,
      });
      expect(cache.size).toBe(1);
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(first.warnings).toHaveLength(1);
      expect(second.warnings).toHaveLength(1);
      expect(second.diagnostics?.[0]).toMatchObject({
        sourceFile: '/tmp/echarts-cache-second.md',
        line: 3,
      });
      expect(first.warnings[0]).toContain('animation was requested');
    } finally {
      renderSpy.mockRestore();
    }
  });

  it('keys cache identity by ECharts version, profile, resource limits, and worker timeout', () => {
    expect(echartsRenderer.name).toBe('echarts');
    expect(echartsRenderer.languages).toEqual(['echarts']);
    expect(echartsRenderer.cacheKey).toContain('echarts@6.1.0');
    expect(echartsRenderer.cacheKey).toContain('echarts-static-profile-v1');
    expect(echartsRenderer.cacheKey).toContain('timeout=10000');
    expect(echartsRenderer.cacheKey).toContain('worker-old-heap=128');
    expect(echartsRenderer.cacheKey).toContain('mode=svg-ssr');
    expect(echartsRenderer.cacheKey).toContain('font=Noto Sans, "DejaVu Sans", sans-serif');
  });

  it('cancels an ECharts worker immediately when its signal aborts', async () => {
    const controller = new AbortController();
    const operation = renderEChartsInWorker(
      { series: [{ type: 'pie', data: [{ value: 1 }] }] },
      800,
      450,
      controller.signal,
    );
    controller.abort(new Error('superseded chart build'));
    await expect(operation).rejects.toThrow('superseded chart build');
  });

  it('does not create a worker when cancellation happened before launch', async () => {
    const controller = new AbortController();
    const workerFactory = vi.fn((_source: string, _options: WorkerOptions) => fakeWorker());
    controller.abort(new Error('chart was already stale'));

    await expect(
      renderEChartsInWorker({}, 800, 450, controller.signal, workerFactory),
    ).rejects.toThrow('chart was already stale');
    expect(workerFactory).not.toHaveBeenCalled();
  });

  it('terminates and reports a crashed worker', async () => {
    const worker = fakeWorker();
    const workerFactory: EChartsWorkerFactory = () => worker;
    const operation = renderEChartsInWorker({}, 800, 450, undefined, workerFactory);
    const rejection = expect(operation).rejects.toThrow('simulated worker crash');
    worker.emit('error', new Error('simulated worker crash'));

    await rejection;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates a worker that exceeds the SSR time limit', async () => {
    vi.useFakeTimers();
    const worker = fakeWorker();
    const workerFactory: EChartsWorkerFactory = () => worker;
    try {
      const operation = renderEChartsInWorker({}, 800, 450, undefined, workerFactory);
      const rejection = expect(operation).rejects.toThrow('10 second time limit');
      await vi.advanceTimersByTimeAsync(ECHARTS_RENDER_TIMEOUT_MS);
      await rejection;
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes flags that Node rejects for workers', () => {
    expect(
      getEChartsWorkerExecArgv([
        '--expose-gc',
        '--input-type=module',
        '--no-warnings',
        '--conditions=development',
      ]),
    ).toEqual(['--no-warnings', '--conditions=development']);
  });

  it('removes an aborted ECharts render from the FIFO queue', async () => {
    const context = { diagramId: 'queued', sourceFile: '/tmp/queued.md', line: 1 };
    const first = echartsRenderer.render(SIMPLE_BAR, { ...context, diagramId: 'first' });
    const second = echartsRenderer.render(SIMPLE_BAR, { ...context, diagramId: 'second' });
    const controller = new AbortController();
    const queued = echartsRenderer.render(SIMPLE_BAR, {
      ...context,
      signal: controller.signal,
    });
    controller.abort(new Error('queued chart superseded'));

    await expect(queued).rejects.toThrow('queued chart superseded');
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  }, 20_000);
});

function fakeWorker(): Worker {
  const worker = new EventEmitter();
  Object.assign(worker, { terminate: vi.fn(async () => 1) });
  return worker as unknown as Worker;
}
