import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { describe, expect, it, vi } from 'vitest';

import {
  MAX_PLANTUML_SOURCE_BYTES,
  PLANTUML_RENDER_TIMEOUT_MS,
  plantumlRenderer,
} from '../src/renderers/plantuml.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';

const context = {
  diagramId: 'bp-diagram-plantuml-test',
  sourceFile: 'diagram.md',
  line: 1,
};

describe('PlantUML renderer', () => {
  it('renders sequence, class, component, and activity diagrams as SVG', async () => {
    const sources = [
      '@startuml\nAlice -> Bob: Привет\n@enduml',
      '@startuml\nclass User {\n  +String name\n}\n@enduml',
      '@startuml\n[Client] --> [API]\n@enduml',
      '@startuml\nstart\n:Process request;\nstop\n@enduml',
    ];

    for (const [index, source] of sources.entries()) {
      const result = await plantumlRenderer.render(source, {
        ...context,
        diagramId: `bp-diagram-plantuml-${index}`,
      });
      expect(result.svg).toMatch(/^<svg\b/);
      expect(result.errors).toEqual([]);
    }
  }, 60_000);

  it('extracts syntax errors and the PlantUML-local line from an error SVG', async () => {
    const result = await plantumlRenderer.render('@startuml\nclass User {\n@enduml', context);

    expect(result.svg).toContain('Syntax Error?');
    expect(result.errors).toEqual([
      {
        message: 'Syntax Error? (Assumed diagram type: sequence)',
        line: 2,
      },
    ]);
  }, 60_000);

  it('does not treat matching diagram text as an error marker', async () => {
    const result = await plantumlRenderer.render(
      '@startuml\nAlice -> Bob: Syntax Error?\n@enduml',
      context,
    );

    expect(result.errors).toEqual([]);
  }, 60_000);

  it('denies local includes and returns a source diagnostic', async () => {
    const result = await plantumlRenderer.render(
      '@startuml\n!include styles/common.puml\nAlice -> Bob\n@enduml',
      context,
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.message).toContain('local PlantUML includes are disabled');
  }, 60_000);

  it('denies standard-library includes and reports why they are unavailable', async () => {
    const result = await plantumlRenderer.render(
      '@startuml\n!include <C4/C4_Context>\nAlice -> Bob\n@enduml',
      context,
    );

    expect(result.errors?.some((error) => /disabled/i.test(error.message))).toBe(true);
  }, 60_000);

  it('enforces the UTF-8 source size limit before launching Chromium', async () => {
    await expect(
      plantumlRenderer.render('x'.repeat(MAX_PLANTUML_SOURCE_BYTES + 1), context),
    ).rejects.toThrow(/diagram is too large/);
  });

  it('honors an already-aborted signal before launching Chromium', async () => {
    const controller = new AbortController();
    const reason = new Error('newer document version');
    controller.abort(reason);

    await expect(
      plantumlRenderer.render('@startuml\nAlice -> Bob\n@enduml', {
        ...context,
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
  });

  it('stops an in-flight render when its signal is aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('render superseded');
    const rendering = plantumlRenderer.render('@startuml\nAlice -> Bob\n@enduml', {
      ...context,
      signal: controller.signal,
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    controller.abort(reason);

    await expect(rendering).rejects.toBe(reason);
  }, 60_000);

  it('closes the page and browser when a render times out', async () => {
    vi.useFakeTimers();
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const page = {
      close: vi.fn().mockResolvedValue(undefined),
      setDefaultTimeout: vi.fn(),
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      goto: vi.fn(() => {
        signalStarted();
        return new Promise<void>(() => undefined);
      }),
    } as unknown as Page;
    const browser = {
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue(page),
    } as unknown as Browser;
    const launch = vi.spyOn(puppeteer, 'launch').mockResolvedValue(browser);

    try {
      const rendering = plantumlRenderer.render('@startuml\nAlice -> Bob\n@enduml', context);
      const expectedTimeout = expect(rendering).rejects.toThrow(/PlantUML rendering timed out/);
      await started;
      await vi.advanceTimersByTimeAsync(PLANTUML_RENDER_TIMEOUT_MS);
      await expectedTimeout;
      expect(page.close).toHaveBeenCalledOnce();
      expect(browser.close).toHaveBeenCalledOnce();
    } finally {
      launch.mockRestore();
      vi.useRealTimers();
    }
  });

  it('renders independent diagrams concurrently in isolated pages', async () => {
    const results = await Promise.all([
      plantumlRenderer.render('@startuml\nAlice -> Bob: first\n@enduml', {
        ...context,
        diagramId: 'bp-diagram-plantuml-first',
      }),
      plantumlRenderer.render('@startuml\nClient -> API: second\n@enduml', {
        ...context,
        diagramId: 'bp-diagram-plantuml-second',
      }),
    ]);

    expect(results[0]?.svg).toContain('first');
    expect(results[1]?.svg).toContain('second');
  }, 60_000);

  it('reuses a rendered SVG through the shared diagram cache', async () => {
    const cache = new DiagramRenderCache();
    const render = vi.spyOn(plantumlRenderer, 'render');
    const source = '@startuml\nAlice -> Bob: cached\n@enduml';

    try {
      const first = await cache.render(plantumlRenderer, source, context);
      const second = await cache.render(plantumlRenderer, source, {
        ...context,
        diagramId: 'bp-diagram-plantuml-cached',
      });

      expect(second).toEqual(first);
      expect(render).toHaveBeenCalledOnce();
      expect(cache.size).toBe(1);
    } finally {
      render.mockRestore();
    }
  }, 60_000);
});
