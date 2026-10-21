import * as assert from 'node:assert/strict';

import {
  isSupportedMarkdownDocument,
  PreviewController,
  PreviewDiagnosticError,
} from '../../src/preview-controller.js';
import type {
  PreviewDocument,
  PreviewDiagnostic,
  PreviewPanel,
  PreviewScheduler,
} from '../../src/preview-controller.js';

const createEmptyCache = () => ({ clear: () => {} });

export async function runPreviewControllerTests(): Promise<void> {
  await testDebounceAndPanelReuse();
  await testCancelsAndIgnoresStaleBuilds();
  await testTracksCompilationShownInPreview();
  await testDocumentIsolationAndCloseCleanup();
  await testPanelCloseAbortsBuild();
  await testNonfatalDiagnosticsAreLogged();
  await testCompilationDiagnostics();
}

async function testTracksCompilationShownInPreview(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panel = new FakePanel();
  const displayedResult = compiled('# Shown in preview');
  const controller = new PreviewController({
    createPanel: () => panel,
    createCache: createEmptyCache,
    output: () => {},
    scheduler,
    compiler: async (markdown) => {
      if (markdown.includes('broken')) {
        throw new Error('invalid diagram');
      }
      return displayedResult;
    },
  });
  const document = new FakeDocument('file:///docs/export.md', '/docs/export.md', '# Preview');

  controller.open(document);
  assert.equal(controller.getDisplayedCompilation(document.uri), undefined);
  scheduler.flush();
  await settle();
  assert.equal(controller.getDisplayedCompilation(document.uri), displayedResult);

  document.edit('# broken');
  controller.documentChanged(document);
  assert.equal(
    controller.getDisplayedCompilation(document.uri),
    displayedResult,
    'the displayed result remains exportable until the error page replaces it',
  );
  scheduler.flush();
  await settle();
  assert.equal(controller.getDisplayedCompilation(document.uri), undefined);

  controller.dispose();
  assert.equal(controller.getDisplayedCompilation(document.uri), undefined);
}

async function testDebounceAndPanelReuse(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panels: FakePanel[] = [];
  const compiledTexts: string[] = [];
  const cacheInstances: unknown[] = [];
  const controller = new PreviewController({
    createPanel: () => {
      const panel = new FakePanel();
      panels.push(panel);
      return panel;
    },
    createCache: createEmptyCache,
    output: () => {},
    debounceMs: 240,
    scheduler,
    compiler: async (markdown, options) => {
      compiledTexts.push(markdown);
      cacheInstances.push(options.diagramCache);
      return compiled(markdown);
    },
  });
  const document = new FakeDocument('file:///docs/one.md', '/docs/one.md', '# First');

  const firstPanel = controller.open(document);
  assert.equal(controller.open(document), firstPanel);
  assert.equal(controller.panelCount, 1);
  assert.equal(panels[0]?.revealCount, 1);
  assert.equal(isSupportedMarkdownDocument(document), true);

  scheduler.flush();
  await settle();
  document.edit('# Second');
  controller.documentChanged(document);
  document.edit('# Latest');
  controller.documentChanged(document);
  assert.equal(scheduler.pendingCount, 1);
  scheduler.flush();
  await settle();

  assert.deepEqual(compiledTexts, ['# First', '# Latest']);
  assert.equal(cacheInstances[0], cacheInstances[1]);
  assert.deepEqual(panels[0]?.renderedTitles, ['# First', '# Latest']);

  assert.equal(
    isSupportedMarkdownDocument(
      new FakeDocument('file:///docs/notes.markdown', '/docs/notes.markdown', 'text'),
    ),
    false,
  );
  controller.dispose();
}

async function testCancelsAndIgnoresStaleBuilds(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panels: FakePanel[] = [];
  const builds: Array<{
    markdown: string;
    signal: AbortSignal | undefined;
    resolve: (value: ReturnType<typeof compiled>) => void;
  }> = [];
  const controller = new PreviewController({
    createPanel: () => {
      const panel = new FakePanel();
      panels.push(panel);
      return panel;
    },
    createCache: createEmptyCache,
    output: () => {},
    scheduler,
    compiler: (markdown, options) =>
      new Promise((resolve) => {
        builds.push({ markdown, signal: options.signal, resolve });
      }),
  });
  const document = new FakeDocument('file:///docs/stale.md', '/docs/stale.md', '# Old');

  controller.open(document);
  scheduler.flush();
  await settle();
  document.edit('# New');
  controller.documentChanged(document);
  assert.equal(builds[0]?.signal?.aborted, true);
  scheduler.flush();
  await settle();
  builds[1]?.resolve(compiled('# New'));
  await settle();
  builds[0]?.resolve(compiled('# Old'));
  await settle();

  assert.deepEqual(panels[0]?.renderedTitles, ['# New']);
  controller.dispose();
}

async function testDocumentIsolationAndCloseCleanup(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panels: FakePanel[] = [];
  const caches: Array<{ clearCount: number; clear(): void }> = [];
  const controller = new PreviewController({
    createPanel: () => {
      const panel = new FakePanel();
      panels.push(panel);
      return panel;
    },
    createCache: () => {
      const cache = {
        clearCount: 0,
        clear() {
          this.clearCount += 1;
        },
      };
      caches.push(cache);
      return cache;
    },
    output: () => {},
    scheduler,
    compiler: async (markdown) => compiled(markdown),
  });

  controller.open(new FakeDocument('file:///docs/one.md', '/docs/one.md', '# One'));
  controller.open(new FakeDocument('file:///docs/two.md', '/docs/two.md', '# Two'));
  assert.equal(controller.panelCount, 2);
  assert.notEqual(caches[0], caches[1]);
  scheduler.flush();
  await settle();
  panels[0]?.close();
  assert.equal(controller.panelCount, 1);
  assert.equal(panels[0]?.cleanupCount, 1);
  assert.equal(caches[0]?.clearCount, 1);

  controller.dispose();
  assert.equal(controller.panelCount, 0);
  assert.equal(panels[1]?.cleanupCount, 1);
  assert.equal(caches[1]?.clearCount, 1);
}

async function testCompilationDiagnostics(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panel = new FakePanel();
  const messages: string[] = [];
  const controller = new PreviewController({
    createPanel: () => panel,
    createCache: createEmptyCache,
    output: (message) => messages.push(message),
    scheduler,
    compiler: async () => {
      throw new PreviewDiagnosticError('invalid diagram', {
        sourceFile: '/docs/broken.md',
        line: 7,
        column: 3,
      });
    },
  });

  controller.open(new FakeDocument('file:///docs/broken.md', '/docs/broken.md', '```mermaid'));
  scheduler.flush();
  await settle();

  assert.equal(panel.diagnostics[0]?.format(), '/docs/broken.md:7:3: invalid diagram');
  assert.deepEqual(messages, ['/docs/broken.md:7:3: invalid diagram']);
  controller.dispose();
}

async function testNonfatalDiagnosticsAreLogged(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panel = new FakePanel();
  const messages: string[] = [];
  const controller = new PreviewController({
    createPanel: () => panel,
    createCache: createEmptyCache,
    output: (message) => messages.push(message),
    scheduler,
    compiler: async () => ({
      ...compiled('# Rendered despite diagram warning'),
      warnings: ['diagram fallback used'],
      errors: ['unsupported diagram option'],
    }),
  });

  controller.open(
    new FakeDocument(
      'file:///docs/warning.md',
      '/docs/warning.md',
      '# Rendered despite diagram warning',
    ),
  );
  scheduler.flush();
  await settle();

  assert.deepEqual(panel.renderedTitles, ['# Rendered despite diagram warning']);
  assert.deepEqual(messages, [
    '/docs/warning.md: warning: diagram fallback used',
    '/docs/warning.md: error: unsupported diagram option',
  ]);
  controller.dispose();
}

async function testPanelCloseAbortsBuild(): Promise<void> {
  const scheduler = new FakeScheduler();
  const panel = new FakePanel();
  let signal: AbortSignal | undefined;
  let resolveBuild: ((value: ReturnType<typeof compiled>) => void) | undefined;
  const controller = new PreviewController({
    createPanel: () => panel,
    createCache: createEmptyCache,
    output: () => {},
    scheduler,
    compiler: (_markdown, options) => {
      signal = options.signal;
      return new Promise((resolve) => (resolveBuild = resolve));
    },
  });

  controller.open(new FakeDocument('file:///docs/closing.md', '/docs/closing.md', '# Closing'));
  scheduler.flush();
  await settle();
  panel.close();
  assert.equal(signal?.aborted, true);
  assert.equal(controller.panelCount, 0);
  resolveBuild?.(compiled('# Closing'));
  await settle();
  assert.deepEqual(panel.renderedTitles, []);
  assert.equal(panel.cleanupCount, 1);
  controller.dispose();
}

class FakeDocument implements PreviewDocument {
  version = 1;

  constructor(
    readonly uri: string,
    readonly fileName: string,
    private text: string,
    readonly languageId = 'markdown',
  ) {}

  getText(): string {
    return this.text;
  }

  edit(text: string): void {
    this.text = text;
    this.version += 1;
  }
}

class FakePanel implements PreviewPanel {
  revealCount = 0;
  cleanupCount = 0;
  renderedTitles: string[] = [];
  diagnostics: PreviewDiagnostic[] = [];
  private disposeListener: (() => void) | undefined;

  reveal(): void {
    this.revealCount += 1;
  }

  async render(result: ReturnType<typeof compiled>, isCurrent: () => boolean): Promise<void> {
    if (isCurrent()) {
      this.renderedTitles.push(result.title);
    }
  }

  renderError(diagnostic: PreviewDiagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  onDidDispose(listener: () => void): { dispose(): void } {
    this.disposeListener = listener;
    return { dispose: () => (this.disposeListener = undefined) };
  }

  dispose(): void {
    this.close();
  }

  cleanup(): void {
    this.cleanupCount += 1;
  }

  close(): void {
    const listener = this.disposeListener;
    this.disposeListener = undefined;
    listener?.();
  }
}

class FakeScheduler implements PreviewScheduler {
  private nextId = 0;
  private readonly tasks = new Map<number, () => void>();

  schedule(callback: () => void): unknown {
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, callback);
    return id;
  }

  cancel(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  flush(): void {
    const tasks = [...this.tasks.values()];
    this.tasks.clear();
    for (const task of tasks) {
      task();
    }
  }

  get pendingCount(): number {
    return this.tasks.size;
  }
}

function compiled(markdown: string) {
  return {
    html: `<h1>${markdown}</h1>`,
    title: markdown,
    assets: [],
    warnings: [],
    errors: [],
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
