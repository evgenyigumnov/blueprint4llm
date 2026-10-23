import { createServer } from 'node:http';

import puppeteer from 'puppeteer';
import type { Browser, HTTPRequest, Page } from 'puppeteer';

import { withChromeSandboxFallback } from '../chrome-sandbox.js';
import type { VegaLiteAssets } from './vega-lite-assets.js';
import { limitMessage } from './vega-lite-error.js';

export const VEGA_LITE_RENDER_TIMEOUT_MS = 30_000;
export const VEGA_LITE_MAX_SVG_BYTES = 4 * 1024 * 1024;
export const VEGA_LITE_MAX_RENDER_SIDE = 4_096;
export const VEGA_LITE_MAX_RENDER_PIXELS = 16_000_000;
export const VEGA_LITE_MAX_DATASET_ROWS = 50_000;
export const VEGA_LITE_MAX_SCENEGRAPH_ITEMS = 50_000;

const PAGE_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  "connect-src 'none'",
  "img-src 'none'",
  "font-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

export interface VegaLitePageResult {
  svg: string;
  warnings: string[];
  errors: string[];
}

/** Compiles and renders one normalized spec inside a fresh, network-isolated Chromium page. */
export async function renderVegaLiteInPage(
  spec: Record<string, unknown>,
  assets: VegaLiteAssets,
  signal?: AbortSignal,
): Promise<VegaLitePageResult> {
  throwIfAborted(signal);
  let browser: Browser | undefined;
  let page: Page | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let interruption: Error | undefined;
  let closePromise: Promise<void> | undefined;
  let rejectInterrupted: (error: Error) => void = () => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectInterrupted = reject;
  });

  const closeResources = (): Promise<void> => {
    closePromise ??= (async () => {
      const activePage = page;
      page = undefined;
      await activePage?.close().catch(() => undefined);

      const activeBrowser = browser;
      browser = undefined;
      await activeBrowser?.close().catch(() => undefined);

      const activeServer = server;
      server = undefined;
      if (activeServer?.listening) {
        await new Promise<void>((resolve) => activeServer.close(() => resolve()));
      }
    })();
    return closePromise;
  };

  const stop = (error: Error): void => {
    if (interruption !== undefined) return;
    interruption = error;
    rejectInterrupted(error);
    void closeResources();
  };
  const signalListener = () => stop(abortError(signal));
  signal?.addEventListener('abort', signalListener, { once: true });
  if (signal?.aborted) signalListener();

  const timeout = setTimeout(
    () => stop(new Error(`Vega-Lite rendering timed out after ${VEGA_LITE_RENDER_TIMEOUT_MS} ms`)),
    VEGA_LITE_RENDER_TIMEOUT_MS,
  );

  const throwIfInterrupted = async (): Promise<void> => {
    if (interruption !== undefined) {
      await closeResources();
      throw interruption;
    }
    if (signal?.aborted) {
      await closeResources();
      throw abortError(signal);
    }
  };

  const interruptible = <T>(operation: Promise<T>, closeLate?: (value: T) => void): Promise<T> => {
    void operation.then(
      (value) => {
        if (interruption !== undefined) closeLate?.(value);
      },
      () => undefined,
    );
    return Promise.race([operation, interrupted]);
  };

  const rendering = (async (): Promise<VegaLitePageResult> => {
    await throwIfInterrupted();
    server = await interruptible(startPageServer(), (lateServer) => closeServer(lateServer));
    await throwIfInterrupted();
    const pageUrl = getPageUrl(server);
    browser = await interruptible(
      withChromeSandboxFallback((disableSandbox) =>
        puppeteer.launch({
          headless: true,
          args: [...(disableSandbox ? ['--no-sandbox'] : []), '--lang=en-US'],
        }),
      ),
      (lateBrowser) => void lateBrowser.close().catch(() => undefined),
    );
    await throwIfInterrupted();

    page = await interruptible(
      browser.newPage(),
      (latePage) => void latePage.close().catch(() => undefined),
    );
    await throwIfInterrupted();
    page.setDefaultTimeout(VEGA_LITE_RENDER_TIMEOUT_MS);
    await page.emulateTimezone('UTC');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const blockedRequests: string[] = [];
    let pageError: string | undefined;
    await page.setRequestInterception(true);
    page.on('request', (request) => handlePageRequest(request, pageUrl, blockedRequests));
    page.on('pageerror', (error) => {
      pageError = error instanceof Error ? error.message : String(error);
    });
    await page.goto(pageUrl, { waitUntil: 'load' });
    await throwIfInterrupted();
    await page.addScriptTag({ content: assets.vegaScript });
    await page.addScriptTag({ content: assets.vegaLiteScript });
    await throwIfInterrupted();

    const result = await page.evaluate(
      async (
        normalizedSpec: Record<string, unknown>,
        maxDatasetRows: number,
        maxScenegraphItems: number,
        maxRenderSide: number,
        maxRenderPixels: number,
      ) => {
        type Message = { severity: 'warning' | 'error'; message: string };
        type BrowserView = {
          runAsync(): Promise<unknown>;
          width(): number;
          height(): number;
          data(name: string): unknown[];
          scenegraph(): { root: unknown };
          toSVG(): Promise<string>;
          finalize(): void;
        };
        type VegaApi = {
          parse(specification: unknown): unknown;
          View: new (runtime: unknown, options: Record<string, unknown>) => BrowserView;
        };
        type VegaLiteApi = {
          compile(specification: unknown, options: { logger: unknown }): { spec: unknown };
        };
        const globals = globalThis as typeof globalThis & {
          vega?: VegaApi;
          vegaLite?: VegaLiteApi;
        };
        const messages: Message[] = [];
        const blockedLoads: string[] = [];
        let skippedMessages = 0;
        const record = (severity: Message['severity'], args: unknown[]): void => {
          if (messages.length >= 99) {
            skippedMessages += 1;
            return;
          }
          let message = args
            .map((value) => {
              if (typeof value === 'string') return value;
              try {
                return JSON.stringify(value);
              } catch {
                return String(value);
              }
            })
            .join(' ');
          if (message.length > 2_048) message = `${message.slice(0, 2_045)}...`;
          messages.push({ severity, message });
        };
        let logLevel = 2;
        const logger: {
          level(value?: number): number | typeof logger;
          warn(...args: unknown[]): typeof logger;
          error(...args: unknown[]): typeof logger;
          info(...args: unknown[]): typeof logger;
          debug(...args: unknown[]): typeof logger;
        } = {
          level(value?: number): number | typeof logger {
            if (value === undefined) return logLevel;
            logLevel = value;
            return logger;
          },
          warn(...args: unknown[]) {
            record('warning', args);
            return logger;
          },
          error(...args: unknown[]) {
            record('error', args);
            return logger;
          },
          info(...args: unknown[]) {
            record('warning', args);
            return logger;
          },
          debug(..._args: unknown[]) {
            return logger;
          },
        };
        const rememberBlockedLoad = (uri: string): Error => {
          if (blockedLoads.length < 100) blockedLoads.push(uri.slice(0, 2_048));
          return new Error(`external resource loading is not supported: ${uri.slice(0, 512)}`);
        };
        const denyLoader = {
          load(uri: string): Promise<string> {
            return Promise.reject(rememberBlockedLoad(uri));
          },
          sanitize(uri: string): Promise<{ href: string }> {
            return Promise.reject(rememberBlockedLoad(uri));
          },
          http(uri: string): Promise<string> {
            return Promise.reject(rememberBlockedLoad(uri));
          },
          file(uri: string): Promise<string> {
            return Promise.reject(rememberBlockedLoad(uri));
          },
        };

        let view: BrowserView | undefined;
        try {
          if (globals.vega === undefined || globals.vegaLite === undefined) {
            throw new Error('local Vega browser bundles did not initialize');
          }
          const compiled = globals.vegaLite.compile(normalizedSpec, { logger }).spec;
          const runtime = globals.vega.parse(compiled);
          view = new globals.vega.View(runtime, {
            renderer: 'svg',
            loader: denyLoader,
            logger,
          });
          await view.runAsync();
          const runtimeErrors = messages.filter((message) => message.severity === 'error');
          if (runtimeErrors.length > 0)
            throw new Error(runtimeErrors[0]?.message ?? 'Vega runtime error');
          if (blockedLoads.length > 0) {
            throw new Error(`Vega attempted a blocked resource load: ${blockedLoads[0]}`);
          }

          const compiledData = (compiled as { data?: unknown }).data;
          if (Array.isArray(compiledData)) {
            for (const dataset of compiledData) {
              if (!isRecord(dataset) || typeof dataset.name !== 'string') continue;
              const rows = view.data(dataset.name);
              if (rows.length > maxDatasetRows) {
                throw new Error(
                  `computed dataset "${dataset.name}" has too many rows: ${rows.length} (limit ${maxDatasetRows})`,
                );
              }
            }
          }
          const scenegraph = view.scenegraph();
          const sceneItems = countScenegraphItems(scenegraph.root, maxScenegraphItems);
          if (sceneItems > maxScenegraphItems) {
            throw new Error(`Vega scenegraph has too many items: more than ${maxScenegraphItems}`);
          }
          const bounds = isRecord(scenegraph.root) ? scenegraph.root.bounds : undefined;
          if (!isRecord(bounds)) {
            throw new Error('rendered Vega-Lite scenegraph does not contain measurable bounds');
          }
          const x1 = bounds.x1;
          const y1 = bounds.y1;
          const x2 = bounds.x2;
          const y2 = bounds.y2;
          if (
            typeof x1 !== 'number' ||
            typeof y1 !== 'number' ||
            typeof x2 !== 'number' ||
            typeof y2 !== 'number' ||
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2) ||
            x2 <= x1 ||
            y2 <= y1
          ) {
            throw new Error('rendered Vega-Lite dimensions must be positive finite values');
          }
          const width = Math.ceil(x2 - x1 + 12);
          const height = Math.ceil(y2 - y1 + 12);
          if (width > maxRenderSide || height > maxRenderSide || width * height > maxRenderPixels) {
            throw new Error(
              `rendered Vega-Lite dimensions exceed the limit: ${width} × ${height} px (limit ${maxRenderSide} px per side and ${maxRenderPixels} px total)`,
            );
          }
          const svg = await view.toSVG();
          if (new TextEncoder().encode(svg).byteLength > 4 * 1024 * 1024) {
            throw new Error('rendered Vega-Lite SVG exceeds the 4194304 byte limit');
          }
          if (skippedMessages > 0) {
            messages.push({
              severity: 'warning',
              message: `${skippedMessages} additional Vega messages omitted`,
            });
          }
          return { svg, messages, blockedLoads, failure: undefined };
        } catch (error) {
          if (skippedMessages > 0) {
            messages.push({
              severity: 'warning',
              message: `${skippedMessages} additional Vega messages omitted`,
            });
          }
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            svg: '',
            messages,
            blockedLoads,
            failure:
              errorMessage.length > 2_048 ? `${errorMessage.slice(0, 2_045)}...` : errorMessage,
          };
        } finally {
          view?.finalize();
        }

        function countScenegraphItems(root: unknown, limit: number): number {
          const visited = new WeakSet<object>();
          const walk = (value: unknown): number => {
            if (Array.isArray(value)) {
              let count = 0;
              for (const item of value) {
                count += walk(item);
                if (count > limit) return count;
              }
              return count;
            }
            if (typeof value !== 'object' || value === null || visited.has(value)) return 0;
            visited.add(value);
            let count = 1;
            if ('items' in value && Array.isArray(value.items)) count += walk(value.items);
            return count;
          };
          return walk(root);
        }

        function isRecord(value: unknown): value is Record<string, unknown> {
          return typeof value === 'object' && value !== null && !Array.isArray(value);
        }
      },
      spec,
      VEGA_LITE_MAX_DATASET_ROWS,
      VEGA_LITE_MAX_SCENEGRAPH_ITEMS,
      VEGA_LITE_MAX_RENDER_SIDE,
      VEGA_LITE_MAX_RENDER_PIXELS,
    );
    await throwIfInterrupted();
    if (blockedRequests.length > 0) {
      throw new Error(`Vega-Lite attempted a blocked network request to "${blockedRequests[0]}"`);
    }
    if (pageError !== undefined) throw new Error(`Vega-Lite browser page failed: ${pageError}`);
    if (result.failure !== undefined) throw new Error(result.failure);
    if (result.blockedLoads.length > 0) {
      throw new Error(`Vega-Lite attempted a blocked resource load to "${result.blockedLoads[0]}"`);
    }
    if (result.svg.length === 0) throw new Error('Vega-Lite produced an empty SVG');
    return {
      svg: result.svg,
      warnings: result.messages
        .filter((message) => message.severity === 'warning')
        .map((message) => message.message),
      errors: result.messages
        .filter((message) => message.severity === 'error')
        .map((message) => message.message),
    };
  })();

  try {
    return await Promise.race([rendering, interrupted]);
  } catch (error) {
    throw normalizeVegaLiteError(error, signal);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', signalListener);
    await closeResources();
  }
}

function startPageServer(): Promise<ReturnType<typeof createServer>> {
  const server = createServer((request, response) => {
    if (request.url !== '/') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': PAGE_CONTENT_SECURITY_POLICY,
      'cache-control': 'no-store',
    });
    response.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

function getPageUrl(server: ReturnType<typeof createServer>): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('could not determine the local Vega-Lite page address');
  }
  return `http://127.0.0.1:${address.port}/`;
}

function handlePageRequest(request: HTTPRequest, pageUrl: string, blockedRequests: string[]): void {
  if (request.url() === pageUrl && request.isNavigationRequest()) {
    void request.continue().catch(() => undefined);
    return;
  }
  if (blockedRequests.length < 100) blockedRequests.push(request.url().slice(0, 2_048));
  void request.abort('blockedbyclient').catch(() => undefined);
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError(signal);
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error('diagram rendering was aborted');
}

function normalizeVegaLiteError(error: unknown, signal: AbortSignal | undefined): Error {
  if (signal?.aborted) return abortError(signal);
  if (error instanceof Error) return new Error(limitMessage(error.message), { cause: error });
  return new Error(limitMessage(String(error)));
}
