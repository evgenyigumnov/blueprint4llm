import puppeteer from 'puppeteer';
import type { Browser, Page, PDFOptions } from 'puppeteer';

import { withChromeSandboxFallback } from './chrome-sandbox.js';
import type { CompiledBlueprint } from './compiler.js';
import { createPrintHtml } from './print-html.js';

export const PDF_RENDER_TIMEOUT_MS = 60_000;

export interface RenderPdfOptions {
  signal?: AbortSignal;
}

interface BrowserDocument {
  fonts: { ready: Promise<unknown> };
  images: ArrayLike<{
    decode(): Promise<void>;
    currentSrc: string;
    src: string;
    naturalWidth: number;
    naturalHeight: number;
  }>;
  querySelectorAll(selector: string): ArrayLike<{
    classList: { contains(className: string): boolean };
    querySelector(
      selector: string,
    ): { getBoundingClientRect(): { width: number; height: number } } | null;
  }>;
}

/** Prints a compiled blueprint through the local Puppeteer-managed Chromium. */
export async function renderPdf(
  compiled: CompiledBlueprint,
  options: RenderPdfOptions = {},
): Promise<Uint8Array> {
  throwIfAborted(options.signal);
  let browser: Browser | undefined;
  let page: Page | undefined;
  let timeout: NodeJS.Timeout | undefined;
  let timeoutExpired = false;
  let abortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abortListener = () => reject(abortError(options.signal));
    options.signal?.addEventListener('abort', abortListener, { once: true });
    if (options.signal?.aborted) {
      abortListener();
    }
  });
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timeoutExpired = true;
      void browser?.close().catch(() => undefined);
      reject(timeoutError());
    }, PDF_RENDER_TIMEOUT_MS);
  });

  const rendering = (async () => {
    throwIfAborted(options.signal);
    const printHtml = await createPrintHtml(compiled);
    throwIfTimedOut(timeoutExpired);
    throwIfAborted(options.signal);
    const launchedBrowser = await withChromeSandboxFallback((disableSandbox) =>
      puppeteer.launch({
        headless: true,
        args: disableSandbox ? ['--no-sandbox'] : [],
      }),
    );
    browser = launchedBrowser;
    if (timeoutExpired || options.signal?.aborted) {
      await launchedBrowser.close().catch(() => undefined);
      browser = undefined;
      throwIfTimedOut(timeoutExpired);
      throwIfAborted(options.signal);
    }
    throwIfAborted(options.signal);
    page = await launchedBrowser.newPage();
    page.setDefaultTimeout(PDF_RENDER_TIMEOUT_MS);
    await page.setJavaScriptEnabled(false);

    const blockedRequests: string[] = [];
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const protocol = new URL(request.url()).protocol;
      if (
        protocol === 'http:' ||
        protocol === 'https:' ||
        protocol === 'ws:' ||
        protocol === 'wss:'
      ) {
        blockedRequests.push(request.url());
        void request.abort('blockedbyclient').catch(() => undefined);
      } else {
        void request.continue().catch(() => undefined);
      }
    });

    await page.setContent(printHtml, { waitUntil: 'load' });
    await page.emulateMediaType('print');
    await waitForPrintResources(page);
    if (blockedRequests.length > 0) {
      throw new Error(`PDF attempted a blocked network request to "${blockedRequests[0]}"`);
    }

    const dimensions = await page.evaluate(() => {
      const browserDocument = (globalThis as unknown as { document: BrowserDocument }).document;
      return Array.from(browserDocument.querySelectorAll('.bp-diagram')).flatMap((figure) => {
        const svg = figure.querySelector('svg');
        if (svg === null) return [];
        const bounds = svg.getBoundingClientRect();
        return [
          {
            width: bounds.width,
            height: bounds.height,
            isD2: figure.classList.contains('bp-diagram--d2'),
          },
        ];
      });
    });
    const invisibleDiagram = dimensions.find(({ width, height }) => width <= 0 || height <= 0);
    if (invisibleDiagram !== undefined) {
      throw new Error('a rendered diagram has zero width or height in the print layout');
    }

    const landscape = dimensions.some(({ width, height, isD2 }) => isD2 && width / height > 1.5);
    const pdf = await page.pdf({ ...PDF_OPTIONS, landscape });
    if (blockedRequests.length > 0) {
      throw new Error(`PDF attempted a blocked network request to "${blockedRequests[0]}"`);
    }
    if (!Buffer.from(pdf).subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error('Chromium returned data that is not a valid PDF document');
    }
    return new Uint8Array(pdf);
  })();

  try {
    return await Promise.race([rendering, timedOut, aborted]);
  } catch (error) {
    throw normalizePdfError(error, options.signal);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    if (abortListener !== undefined) {
      options.signal?.removeEventListener('abort', abortListener);
    }
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

const PDF_OPTIONS: PDFOptions = {
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: false,
  waitForFonts: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="font: 9px Arial, sans-serif; width: 100%; text-align: center; color: #666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: '15mm', bottom: '18mm', left: '15mm', right: '15mm' },
};

async function waitForPrintResources(page: Page): Promise<void> {
  const failedResources = await page.evaluate(async () => {
    const browserDocument = (globalThis as unknown as { document: BrowserDocument }).document;
    await browserDocument.fonts.ready;
    const failed: string[] = [];
    await Promise.all(
      Array.from(browserDocument.images).map(async (image) => {
        try {
          await image.decode();
        } catch {
          failed.push(image.currentSrc || image.src);
        }
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          failed.push(image.currentSrc || image.src);
        }
      }),
    );
    return failed;
  });
  if (failedResources.length > 0) {
    throw new Error(`could not load an embedded PDF image: "${failedResources[0]}"`);
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortError(signal);
  }
}

function throwIfTimedOut(timeoutExpired: boolean): void {
  if (timeoutExpired) {
    throw timeoutError();
  }
}

function timeoutError(): Error {
  return new Error(`PDF rendering timed out after ${PDF_RENDER_TIMEOUT_MS} ms`);
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error ? signal.reason : new Error('PDF rendering was aborted');
}

function normalizePdfError(error: unknown, signal: AbortSignal | undefined): Error {
  if (signal?.aborted) {
    return abortError(signal);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/could not find chrome|browser .*was not found/i.test(message)) {
    return new Error(
      `${message}. Install the Puppeteer-managed browser with: npx puppeteer browsers install chrome`,
      { cause: error },
    );
  }
  if (/no usable sandbox|without --no-sandbox/i.test(message)) {
    return new Error(
      `${message}. Chromium could not start even after an automatic retry with --no-sandbox`,
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(message);
}
