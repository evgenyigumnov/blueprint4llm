import { describe, expect, it, vi } from 'vitest';

import { DiagramRenderCache } from '../src/renderers/cache.js';
import type { DiagramRenderer, DiagramRenderContext } from '../src/renderers/types.js';

const context: DiagramRenderContext = {
  diagramId: 'bp-diagram-001',
  sourceFile: 'cache.md',
  line: 1,
};

describe('DiagramRenderCache', () => {
  it('reuses successful SVG by renderer config and source and returns independent warnings', async () => {
    let calls = 0;
    const renderer = fakeRenderer('mermaid-v1', async (source) => {
      calls += 1;
      return {
        svg: `<svg>${source}</svg>`,
        warnings: [{ message: 'warning', line: 2 }],
        errors: [{ message: 'error', line: 3, column: 4 }],
      };
    });
    const cache = new DiagramRenderCache();

    const first = await cache.render(renderer, 'flowchart LR', context);
    first.warnings[0]!.message = 'caller mutation';
    first.errors![0]!.message = 'caller mutation';
    const reused = await cache.render(renderer, 'flowchart LR', {
      ...context,
      diagramId: 'bp-diagram-002',
    });

    expect(reused).toEqual({
      svg: '<svg>flowchart LR</svg>',
      warnings: [{ message: 'warning', line: 2 }],
      errors: [{ message: 'error', line: 3, column: 4 }],
    });
    expect(calls).toBe(1);
    expect(cache.size).toBe(1);
  });

  it('includes renderer versions and source text in the key', async () => {
    let calls = 0;
    const firstRenderer = fakeRenderer('config-a', async (source) => {
      calls += 1;
      return { svg: `<svg>${source}</svg>`, warnings: [] };
    });
    const secondRenderer = fakeRenderer('config-b', async (source) => {
      calls += 1;
      return { svg: `<svg>${source}</svg>`, warnings: [] };
    });
    const cache = new DiagramRenderCache();

    await cache.render(firstRenderer, 'same source', context);
    await cache.render(firstRenderer, 'changed source', context);
    await cache.render(secondRenderer, 'same source', context);

    expect(calls).toBe(3);
    expect(cache.size).toBe(3);
  });

  it('includes fenced metadata in the key when a renderer uses block options', async () => {
    let calls = 0;
    const renderer = fakeRenderer('metadata-v1', async (_source, renderContext) => {
      calls += 1;
      return { svg: `<svg>${renderContext.metadata ?? ''}</svg>`, warnings: [] };
    });
    const cache = new DiagramRenderCache();

    await cache.render(renderer, 'same source', { ...context, metadata: 'node=12:34' });
    await cache.render(renderer, 'same source', { ...context, metadata: 'node=12:35' });
    await cache.render(renderer, 'same source', { ...context, metadata: 'node=12:34' });

    expect(calls).toBe(2);
    expect(cache.size).toBe(2);
  });

  it('expires remote results by renderer TTL and keeps local results until eviction', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const base = fakeRenderer('ttl-v1', async (source) => {
        calls += 1;
        return { svg: `<svg>${source}</svg>`, warnings: [] };
      });
      const renderer: DiagramRenderer = {
        ...base,
        cacheTtlMsForSource: (source) => (source.startsWith('remote:') ? 1_000 : undefined),
      };
      const cache = new DiagramRenderCache();

      await cache.render(renderer, 'remote:frame', context);
      await cache.render(renderer, 'remote:frame', context);
      await cache.render(renderer, 'local:json', context);
      vi.advanceTimersByTime(1_001);

      expect(cache.size).toBe(1);
      await cache.render(renderer, 'remote:frame', context);
      await cache.render(renderer, 'local:json', context);

      expect(calls).toBe(3);
      expect(cache.size).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cache failures or oversized SVGs and evicts the oldest entry at its limit', async () => {
    let calls = 0;
    const renderer = fakeRenderer('bounded', async (source) => {
      calls += 1;
      if (source === 'fails') {
        throw new Error('render failure');
      }
      return { svg: `<svg>${source}</svg>`, warnings: [] };
    });
    const cache = new DiagramRenderCache(1, 35);

    await expect(cache.render(renderer, 'fails', context)).rejects.toThrow('render failure');
    await expect(cache.render(renderer, 'fails', context)).rejects.toThrow('render failure');
    await cache.render(renderer, 'first', context);
    await cache.render(renderer, 'second', context);
    await cache.render(renderer, 'first', context);
    await cache.render(renderer, 'this SVG is too large to keep', context);
    await cache.render(renderer, 'this SVG is too large to keep', context);
    await cache.render(renderer, 'first', context);

    expect(calls).toBe(7);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('honors an already-aborted signal before returning a cached result', async () => {
    const renderer = fakeRenderer('abort', async () => ({ svg: '<svg/>', warnings: [] }));
    const cache = new DiagramRenderCache();
    await cache.render(renderer, 'source', context);
    const controller = new AbortController();
    controller.abort(new Error('superseded'));

    await expect(
      cache.render(renderer, 'source', { ...context, signal: controller.signal }),
    ).rejects.toThrow('superseded');
  });
});

function fakeRenderer(cacheKey: string, render: DiagramRenderer['render']): DiagramRenderer {
  return { name: 'test-renderer', languages: ['test'], cacheKey, render };
}
