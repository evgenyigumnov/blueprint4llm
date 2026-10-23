import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EXIT_FAILURE, main } from '../src/cli.js';
import { compileMarkdown } from '../src/compiler.js';
import { startPreviewServer } from '../src/server.js';
import type { PreviewServerHandle } from '../src/server.js';

const directories: string[] = [];
const servers: PreviewServerHandle[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('preview server', () => {
  it('logs non-fatal diagram errors and still serves the compiled preview', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint.md');
    await writeFile(input, '# Source');
    const errors: string[] = [];
    const server = await startPreviewServer({
      input,
      port: 0,
      err: (message) => errors.push(message),
      compile: async () => ({
        html: '<!doctype html><html><body><h1>Rendered</h1></body></html>',
        title: 'Rendered',
        assets: [],
        warnings: [],
        errors: ['blueprint.md:5:4: wiremark error: unexpected token'],
      }),
    });
    servers.push(server);

    const preview = await (await fetch(server.url)).text();

    expect(preview).toContain('<h1>Rendered</h1>');
    expect(errors.join('')).toContain(
      'blueprint4llm: error: blueprint.md:5:4: wiremark error: unexpected token',
    );
  });

  it('serves preview HTML and allowlisted assets, injects SSE/PDF controls, and caches PDF renders', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint.md');
    const imageBytes = Buffer.from('<svg><title>preview asset</title></svg>');
    await writeFile(input, '# First version\n\n![Logo](./logo.svg)');
    await writeFile(path.join(root, 'logo.svg'), imageBytes);
    let pdfRenders = 0;
    const server = await startPreviewServer({
      input,
      port: 0,
      renderPdf: async () => {
        pdfRenders += 1;
        await delay(30);
        return Buffer.from('%PDF-preview');
      },
    });
    servers.push(server);

    const page = await fetch(server.url);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('<h1>First version</h1>');
    expect(html).toContain('href="/document.pdf" download="index.pdf">Download PDF</a>');
    expect(html).toContain("new EventSource('/_blueprint4llm/events?version=");
    const missedEvents = await connectEvents(server.url, 'outdated-version');
    await waitForReload(missedEvents.reader);
    await missedEvents.close();
    const assetName = html.match(/src="assets\/([a-f\d]{64}\.svg)"/)?.[1];
    expect(assetName).toBeDefined();

    const asset = await fetch(new URL(`/assets/${assetName}`, server.url));
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toBe('image/svg+xml');
    expect(Buffer.from(await asset.arrayBuffer())).toEqual(imageBytes);
    expect((await fetch(new URL('/assets/not-allowed.svg', server.url))).status).toBe(404);
    expect((await fetch(new URL('/assets/%2e%2e%2fblueprint.md', server.url))).status).toBe(404);
    expect((await fetch(server.url, { method: 'POST' })).status).toBe(405);

    const [firstPdf, concurrentPdf] = await Promise.all([
      fetch(new URL('/document.pdf', server.url)),
      fetch(new URL('/document.pdf', server.url)),
    ]);
    for (const response of [firstPdf, concurrentPdf]) {
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(response.headers.get('content-disposition')).toBe('attachment; filename="index.pdf"');
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('%PDF-preview');
    }
    expect(pdfRenders).toBe(1);
    await fetch(new URL('/document.pdf', server.url));
    expect(pdfRenders).toBe(1);

    const events = await connectEvents(server.url);
    const nextReload = waitForReload(events.reader);
    await writeFile(input, '# Second version\n\nUpdated content.');
    await nextReload;
    await events.close();
    expect(await (await fetch(server.url)).text()).toContain('<h1>Second version</h1>');
    expect((await fetch(new URL('/document.pdf', server.url))).status).toBe(200);
    expect(pdfRenders).toBe(2);
  }, 15_000);

  it('rebuilds a draw.io preview after its Markdown source changes', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'drawio.md');
    await writeFile(input, drawioMarkdown('Queued'));
    const server = await startPreviewServer({ input, port: 0 });
    servers.push(server);

    const firstPreview = await (await fetch(server.url)).text();
    expect(firstPreview).toContain('bp-diagram--drawio');
    expect(firstPreview).toContain('Queued');

    const events = await connectEvents(server.url);
    const reload = waitForReload(events.reader);
    await writeFile(input, drawioMarkdown('Released'));
    await reload;
    await events.close();

    const updatedPreview = await (await fetch(server.url)).text();
    expect(updatedPreview).toContain('bp-diagram--drawio');
    expect(updatedPreview).toContain('Released');
    expect(updatedPreview).not.toContain('Queued');
  }, 15_000);

  it('serves and rebuilds an inline Pencil preview', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'pencil.md');
    await writeFile(input, pencilMarkdown('Before update'));
    const server = await startPreviewServer({ input, port: 0 });
    servers.push(server);

    const firstPreview = await (await fetch(server.url)).text();
    expect(firstPreview).toContain('bp-diagram--pencil');
    expect(firstPreview).toContain('Before update');
    expect(firstPreview).not.toContain('Document check:');

    const events = await connectEvents(server.url);
    const reload = waitForReload(events.reader);
    await writeFile(input, pencilMarkdown('After update'));
    await reload;
    await events.close();

    const updatedPreview = await (await fetch(server.url)).text();
    expect(updatedPreview).toContain('bp-diagram--pencil');
    expect(updatedPreview).toContain('After update');
    expect(updatedPreview).not.toContain('Before update');
  }, 15_000);

  it('serves a partial diagnostic document and gives PDF the same current version', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'diagnostics.md');
    await writeFile(
      input,
      '# Orders\n\nText before.\n\n```wiremark\nWireframe mobile\n  UnknownControl\n```\n\nText after.',
    );
    const renderedPdfInputs: string[] = [];
    const server = await startPreviewServer({
      input,
      port: 0,
      includeDiagnosticsSummary: true,
      renderPdf: async (compiled) => {
        renderedPdfInputs.push(compiled.html);
        return Buffer.from('%PDF-diagnostics');
      },
    });
    servers.push(server);

    const failedHtml = await (await fetch(server.url)).text();
    expect(failedHtml).toContain('Document check: 1 errors · 0 warnings');
    expect(failedHtml).toContain('unknown component');
    expect(failedHtml).toContain('Text before.');
    expect(failedHtml).toContain('Text after.');
    expect((await fetch(new URL('/document.pdf', server.url))).status).toBe(200);
    expect(renderedPdfInputs[0]).toContain('Document check: 1 errors · 0 warnings');
    expect(renderedPdfInputs[0]).toContain('unknown component');

    const events = await connectEvents(server.url);
    const reload = waitForReload(events.reader);
    await writeFile(
      input,
      '# Orders\n\n```wiremark\nWireframe #order-form\n  Stack column\n    Typography h4 "Ready"\n```\n\nRecovered text.',
    );
    await reload;
    await events.close();

    const fixedHtml = await (await fetch(server.url)).text();
    expect(fixedHtml).toContain('Document check: 0 errors · 0 warnings');
    expect(fixedHtml).toContain('Recovered text.');
    expect(fixedHtml).not.toContain('unknown component');
    expect((await fetch(new URL('/document.pdf', server.url))).status).toBe(200);
    expect(renderedPdfInputs.at(-1)).toContain('Document check: 0 errors · 0 warnings');
    expect(renderedPdfInputs.at(-1)).not.toContain('unknown component');
  }, 15_000);

  it('shows escaped diagnostics, rejects stale PDF, and recovers when a missing image appears', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint <script>.md');
    await writeFile(input, '# Good version');
    const server = await startPreviewServer({ input, port: 0 });
    servers.push(server);

    const events = await connectEvents(server.url);
    const failedReload = waitForReload(events.reader);
    await writeFile(input, '# Broken <script>\n\n![Missing](./missing.png)');
    await failedReload;
    const brokenHtml = await (await fetch(server.url)).text();
    expect(brokenHtml).toContain('Blueprint preview build failed');
    expect(brokenHtml).toContain('blueprint &lt;script&gt;.md:3:1');
    expect(brokenHtml.match(/<script>/g)).toHaveLength(1);
    expect(brokenHtml).toContain("new EventSource('/_blueprint4llm/events?version=");
    expect((await fetch(new URL('/document.pdf', server.url))).status).toBe(422);

    const recoveredReload = waitForReload(events.reader);
    await writeFile(path.join(root, 'missing.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await recoveredReload;
    await events.close();
    const recoveredHtml = await (await fetch(server.url)).text();
    expect(recoveredHtml).toContain('Broken');
    expect(recoveredHtml.match(/<script>/g)).toHaveLength(2);
    expect(recoveredHtml).toContain('Broken &#x3C;script>');
    const assetName = recoveredHtml.match(/src="assets\/([a-f\d]{64}\.png)"/)?.[1];
    expect(assetName).toBeDefined();
    expect((await fetch(new URL(`/assets/${assetName}`, server.url))).status).toBe(200);
  }, 15_000);

  it('binds only to loopback, reports occupied ports, and stops on an abort signal', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint.md');
    await writeFile(input, '# Signal test');
    const first = await startPreviewServer({ input, port: 0 });
    servers.push(first);
    expect(first.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);

    const errors: string[] = [];
    const occupied = await main([input, '--serve', `--port=${first.port}`], {
      out: () => undefined,
      err: (message) => errors.push(message),
    });
    expect(occupied).toBe(EXIT_FAILURE);
    expect(errors.join('')).toContain(`port ${first.port} is already in use`);

    const controller = new AbortController();
    const second = await startPreviewServer({ input, port: 0, signal: controller.signal });
    controller.abort();
    await second.close();
    await expect(fetch(second.url)).rejects.toThrow();
  }, 10_000);

  it('aborts in-flight PDF work during server shutdown', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint.md');
    await writeFile(input, '# Stop PDF');
    let observedAbort = false;
    let renderStarted = false;
    const server = await startPreviewServer({
      input,
      port: 0,
      renderPdf: (_compiled, options) =>
        new Promise((_, reject) => {
          renderStarted = true;
          const signal = options?.signal;
          signal?.addEventListener(
            'abort',
            () => {
              observedAbort = true;
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    });
    servers.push(server);
    const pdfRequest = fetch(new URL('/document.pdf', server.url)).catch(() => undefined);
    await waitUntil(() => renderStarted);
    await server.close();
    await pdfRequest;
    expect(observedAbort).toBe(true);
    servers.splice(servers.indexOf(server), 1);
  }, 10_000);

  it('keeps the server alive after a missing source file and recovers when it is created', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'created-later.md');
    const server = await startPreviewServer({ input, port: 0 });
    servers.push(server);
    expect(await (await fetch(server.url)).text()).toContain('ENOENT');

    const events = await connectEvents(server.url);
    const reload = waitForReload(events.reader);
    await writeFile(input, '# Source appeared');
    await reload;
    await events.close();
    expect(await (await fetch(server.url)).text()).toContain('<h1>Source appeared</h1>');
  }, 10_000);

  it('does not return a cached PDF when the document changes during rendering', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint.md');
    await writeFile(input, '# Before change');
    let renderStarted = false;
    const server = await startPreviewServer({
      input,
      port: 0,
      renderPdf: (_compiled, options) =>
        new Promise((_, reject) => {
          renderStarted = true;
          const signal = options?.signal;
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    });
    servers.push(server);
    const pdfRequest = fetch(new URL('/document.pdf', server.url));
    await waitUntil(() => renderStarted);
    await writeFile(input, '# After change');
    const response = await pdfRequest;
    expect(response.status).toBe(503);
    await waitUntil(async () => (await (await fetch(server.url)).text()).includes('After change'));
  }, 10_000);

  it('does not let an older slow build replace a newer source version', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blueprint.md');
    await writeFile(input, '# Initial version');
    let startSlowBuild: (() => void) | undefined;
    let finishSlowBuild: (() => void) | undefined;
    const slowStarted = new Promise<void>((resolve) => {
      startSlowBuild = resolve;
    });
    const slowFinished = new Promise<void>((resolve) => {
      finishSlowBuild = resolve;
    });
    const server = await startPreviewServer({
      input,
      port: 0,
      compile: async (markdown, options) => {
        if (markdown.includes('Slow version')) {
          startSlowBuild?.();
          await delay(700);
          finishSlowBuild?.();
        }
        return compileMarkdown(markdown, options);
      },
    });
    servers.push(server);
    const events = await connectEvents(server.url);

    const reload = waitForReload(events.reader);
    await writeFile(input, '# Slow version');
    await slowStarted;
    await writeFile(input, '# Newest version');
    await reload;
    await slowFinished;
    await events.close();

    const html = await (await fetch(server.url)).text();
    expect(html).toContain('<h1>Newest version</h1>');
    expect(html).not.toContain('<h1>Slow version</h1>');
  }, 10_000);
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-server-'));
  directories.push(directory);
  return directory;
}

function drawioMarkdown(label: string): string {
  const json = JSON.stringify({
    version: '26.0',
    pages: [
      {
        id: 'page-1',
        name: 'Release flow',
        cells: [
          { id: 'layer', type: 'layer' },
          { id: 'build', type: 'node', parent: 'layer', label },
          { id: 'publish', type: 'node', parent: 'layer', label: 'Publish' },
          {
            id: 'edge',
            type: 'edge',
            parent: 'layer',
            source: 'build',
            target: 'publish',
            label: 'deploy',
          },
        ],
      },
    ],
  });
  return `# Preview\n\n\`\`\`drawio\n${json}\n\`\`\`\n`;
}

function pencilMarkdown(label: string): string {
  const document = JSON.stringify({
    version: '2.21',
    children: [
      {
        id: 'frame',
        type: 'frame',
        width: 240,
        height: 48,
        layout: 'none',
        children: [
          {
            id: 'label',
            type: 'text',
            x: 4,
            y: 6,
            width: 232,
            height: 36,
            content: label,
            textGrowth: 'fixed-width',
            fill: '#202124',
          },
        ],
      },
    ],
  });
  return ['# Pencil preview', '', '```pencil', document, '```'].join('\n');
}

async function connectEvents(
  url: string,
  version?: string,
): Promise<{
  reader: ReadableStreamDefaultReader<Uint8Array>;
  close: () => Promise<void>;
}> {
  const eventUrl = new URL('/_blueprint4llm/events', url);
  if (version !== undefined) {
    eventUrl.searchParams.set('version', version);
  }
  const response = await fetch(eventUrl);
  if (response.body === null) {
    throw new Error('SSE response has no body');
  }
  const reader = response.body.getReader();
  return { reader, close: async () => reader.cancel() };
}

async function waitForReload(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  const decoder = new TextDecoder();
  let content = '';
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('timed out waiting for the preview reload event')),
      8_000,
    );
  });
  const readEvents = async (): Promise<void> => {
    while (!content.includes('event: reload')) {
      const chunk = await reader.read();
      if (chunk.done) {
        throw new Error('SSE stream closed before reload');
      }
      content += decoder.decode(chunk.value, { stream: true });
    }
  };
  try {
    await Promise.race([readEvents(), timeout]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function waitUntil(condition: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!(await condition())) {
    if (Date.now() >= deadline) {
      throw new Error('timed out waiting for condition');
    }
    await delay(10);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
