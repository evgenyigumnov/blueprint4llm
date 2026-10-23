import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { createGraphvizRenderer, graphvizRenderer } from '../src/renderers/graphviz.js';
import {
  GRAPHVIZ_ENGINE_VERSION,
  GRAPHVIZ_ENGINES,
  type GraphvizEngine,
} from '../src/renderers/graphviz-worker-protocol.js';
import { MAX_GRAPHVIZ_SOURCE_BYTES } from '../src/renderers/graphviz-limits.js';
import type { GraphvizRenderOutput } from '../src/renderers/graphviz-worker-protocol.js';

function context(metadata = '') {
  return {
    diagramId: 'bp-diagram-001',
    sourceFile: 'graph.md',
    line: 1,
    metadata,
  };
}

describe('Graphviz renderer', () => {
  it.each(GRAPHVIZ_ENGINES)('renders a graph with the verified %s engine', async (engine) => {
    const result = await graphvizRenderer.render(
      'graph Example { a -- b; b -- c; c -- a }',
      context(`engine=${engine}`),
    );

    expect(result.svg).toMatch(/^<svg\b/);
    expect(result.svg).toContain('viewBox=');
    expect(result.svg).not.toContain('<?xml');
    expect(result.warnings).toEqual([]);
  });

  it('renders a directed cluster with ports, record and HTML-like labels, and Unicode text', async () => {
    const result = await graphvizRenderer.render(
      `digraph Orders {
  rankdir=LR;
  subgraph cluster_api {
    label="Кластер заказов";
    client [shape=record, label="<request> Клиент | <response> Ответ"];
    api [label=<<TABLE><TR><TD>API</TD></TR></TABLE>>];
  }
  client:request -> api [label="Создать длинный заказ"];
}`,
      context(),
    );

    expect(result.svg).toContain('Кластер заказов');
    expect(result.svg).toContain('Создать длинный заказ');
    expect(result.svg).toContain('API');
    expect(result.warnings).toEqual([]);
  });

  it('preserves Graphviz warnings from a successful render', async () => {
    const result = await graphvizRenderer.render(
      'digraph { file [image="/etc/passwd"]; file -> result }',
      context(),
    );

    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain(
      'No such file or directory while opening /etc/passwd',
    );
  });

  it('accepts a valid empty graph and keeps layout attributes ahead of metadata', async () => {
    const emptyGraph = await graphvizRenderer.render('graph { }', context());
    expect(emptyGraph.svg).toMatch(/^<svg\b/);

    const layoutAttribute = await graphvizRenderer.render(
      'digraph G { layout=neato; a -> b }',
      context('engine=dot'),
    );
    const metadataEngine = await graphvizRenderer.render(
      'digraph G { layout=neato; a -> b }',
      context('engine=neato'),
    );
    const defaultLayout = await graphvizRenderer.render(
      'digraph G { a -> b }',
      context('engine=dot'),
    );

    expect(layoutAttribute.svg).toBe(metadataEngine.svg);
    expect(layoutAttribute.svg).not.toBe(defaultLayout.svg);
  });

  it('does not retain stylesheet references in inline output', async () => {
    const result = await graphvizRenderer.render(
      'digraph { graph [stylesheet="https://example.com/graph.css"]; a -> b }',
      context(),
    );

    expect(result.svg).not.toContain('xml-stylesheet');
    expect(result.svg).not.toContain('https://example.com/graph.css');
  });

  it('does not fetch external images, even when the URL points to a local test server', async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.end('image');
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      throw new Error('test server did not bind to a TCP port');
    }

    try {
      const result = await graphvizRenderer.render(
        `digraph { a [image="http://127.0.0.1:${address.port}/image.svg"]; a -> b }`,
        context(),
      );
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(requests).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    }
  });

  it('rejects active HTML-like image labels and leaves them out of the SVG', async () => {
    await expect(
      graphvizRenderer.render(
        'digraph { a [label=<<IMG SRC="https://example.com/image.svg"/> >] }',
        context(),
      ),
    ).rejects.toThrow('Graphviz render failed');
  });

  it('reports syntax errors with a body-relative source line', async () => {
    await expect(graphvizRenderer.render('digraph {\n  a ->\n}', context())).rejects.toMatchObject({
      name: 'GraphvizRenderError',
      line: 3,
    });
  });

  it('rejects empty blocks, oversized direct calls, repeated graphs, and unsupported metadata', async () => {
    await expect(graphvizRenderer.render('  \n', context())).rejects.toThrow('must not be empty');
    await expect(
      graphvizRenderer.render('x'.repeat(MAX_GRAPHVIZ_SOURCE_BYTES + 1), context()),
    ).rejects.toThrow('source is too large');
    await expect(
      graphvizRenderer.render('digraph A { a -> b } digraph B { c -> d }', context()),
    ).rejects.toThrow('exactly one graph');
    await expect(
      graphvizRenderer.render('digraph { a -> b }', context('engine=unknown')),
    ).rejects.toThrow('unsupported Graphviz engine');
  });

  it('fails safely when URLs become non-fragment SVG references', async () => {
    await expect(
      graphvizRenderer.render('digraph { node [URL="https://example.com"]; a -> b }', context()),
    ).rejects.toThrow('non-fragment href');
  });

  it('uses a disposable worker so the event loop can continue during layout', async () => {
    const nodes = Array.from({ length: 80 }, (_, index) => `n${index}`);
    const edges = nodes.flatMap((left, index) =>
      nodes.slice(index + 1).map((right) => `${left} -- ${right};`),
    );
    const source = `graph Dense { ${edges.join('\n')} }`;
    let timerFired = false;
    const timer = new Promise<void>((resolve) => {
      setTimeout(() => {
        timerFired = true;
        resolve();
      }, 0);
    });

    const rendered = graphvizRenderer.render(source, context('engine=neato'));
    await Promise.all([rendered, timer]);
    expect(timerFired).toBe(true);
    expect(source.length).toBeLessThan(MAX_GRAPHVIZ_SOURCE_BYTES);
  }, 30_000);

  it('aborts an active worker and allows the next render to succeed', async () => {
    const controller = new AbortController();
    const cancelled = graphvizRenderer.render('digraph { client -> api }', {
      ...context(),
      signal: controller.signal,
    });
    controller.abort(new Error('preview source changed'));

    await expect(cancelled).rejects.toThrow('preview source changed');
    const next = await graphvizRenderer.render('digraph { client -> api }', context());
    expect(next.svg).toContain('<svg');
  });

  it('limits active Wasm workers to two and includes engine versions in its cache key', async () => {
    let active = 0;
    let peak = 0;
    const runner = {
      async render(
        _source: string,
        _engine: GraphvizEngine,
      ): Promise<GraphvizRenderOutput & { graphvizVersion: string; engines: string[] }> {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return {
          status: 'success',
          output: '<svg width="1px" height="1px" viewBox="0 0 1 1"/>',
          errors: [],
          graphvizVersion: GRAPHVIZ_ENGINE_VERSION,
          engines: [...GRAPHVIZ_ENGINES],
        };
      },
    };
    const renderer = createGraphvizRenderer(runner);

    await Promise.all([
      renderer.render('graph { a -- b }', context()),
      renderer.render('graph { c -- d }', context()),
      renderer.render('graph { e -- f }', context()),
    ]);

    expect(peak).toBe(2);
    expect(renderer.cacheKey).toContain('@viz-js/viz@3.31.0');
    expect(renderer.cacheKey).toContain(`graphviz@${GRAPHVIZ_ENGINE_VERSION}`);
  });
});
