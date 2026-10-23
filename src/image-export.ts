import puppeteer from 'puppeteer';
import type { Browser, Page, ScreenshotOptions } from 'puppeteer';
import { fromHtml } from 'hast-util-from-html';
import type { Element, Root, RootContent } from 'hast';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

import { withChromeSandboxFallback } from './chrome-sandbox.js';
import { getNotoSansFontCss } from './noto-fonts.js';

export type DiagramImageFormat = 'svg' | 'png' | 'jpeg';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_RASTER_DIMENSION = 8192;
const MAX_RASTER_PIXELS = 32_000_000;
const RENDER_TIMEOUT_MS = 60_000;

interface SvgDimensions {
  width: number;
  height: number;
}

/** Extracts the one rendered diagram and serializes it as SVG or a raster image. */
export async function renderDiagramImage(
  compiledHtml: string,
  format: DiagramImageFormat,
): Promise<string | Uint8Array> {
  const { svg, usesNotoSans } = extractSingleDiagramSvg(compiledHtml);
  const dimensions = getSvgDimensions(svg);
  setSvgDimensions(svg, dimensions);
  const serializedSvg = serializeSvg(svg);

  if (format === 'svg') {
    return serializedSvg;
  }

  return renderRasterImage(serializedSvg, dimensions, format, usesNotoSans);
}

function extractSingleDiagramSvg(html: string): { svg: Element; usesNotoSans: boolean } {
  const tree = fromHtml(html);
  const diagrams: Element[] = [];
  collectDiagramFigures(tree, diagrams);
  if (diagrams.length !== 1) {
    throw new Error(
      `single-diagram export requires exactly one rendered diagram; found ${diagrams.length}`,
    );
  }

  const figure = diagrams[0]!;
  const svg = figure.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'svg',
  );
  if (svg === undefined) {
    throw new Error('the rendered diagram does not contain an SVG element');
  }
  return { svg, usesNotoSans: hasClass(figure, 'bp-diagram--d2') };
}

function collectDiagramFigures(node: Root | Element, diagrams: Element[]): void {
  for (const child of node.children) {
    if (child.type !== 'element') {
      continue;
    }
    if (child.tagName === 'figure' && hasClass(child, 'bp-diagram')) {
      diagrams.push(child);
    }
    collectDiagramFigures(child, diagrams);
  }
}

function hasClass(element: Element, className: string): boolean {
  const classes = element.properties.className;
  return Array.isArray(classes) && classes.includes(className);
}

function getSvgDimensions(svg: Element): SvgDimensions {
  const viewBox = getViewBox(svg);
  let width = parseSvgLength(svg.properties.width);
  let height = parseSvgLength(svg.properties.height);

  if (width === undefined && height === undefined) {
    if (viewBox === undefined) {
      throw new Error('the rendered SVG must define a viewBox or explicit width and height');
    }
    width = viewBox.width;
    height = viewBox.height;
  } else if (width === undefined) {
    if (viewBox === undefined || height === undefined) {
      throw new Error('the rendered SVG must define a viewBox or explicit width and height');
    }
    width = (height * viewBox.width) / viewBox.height;
  } else if (height === undefined) {
    if (viewBox === undefined) {
      throw new Error('the rendered SVG must define a viewBox or explicit width and height');
    }
    height = (width * viewBox.height) / viewBox.width;
  }

  if (
    width === undefined ||
    height === undefined ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('the rendered SVG has invalid dimensions');
  }
  return { width, height };
}

function getViewBox(svg: Element): SvgDimensions | undefined {
  const value = svg.properties.viewBox;
  if (typeof value !== 'string') {
    return undefined;
  }
  const values = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (values.length !== 4 || values.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  const width = values[2];
  const height = values[3];
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    return undefined;
  }
  return { width, height };
}

function parseSvgLength(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(px|pt|pc|mm|cm|in|em|rem)?\s*$/i.exec(value);
  if (match === null) {
    return undefined;
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'px').toLowerCase();
  const factors: Record<string, number> = {
    px: 1,
    pt: 96 / 72,
    pc: 16,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    in: 96,
    em: 16,
    rem: 16,
  };
  const factor = factors[unit];
  if (factor === undefined) {
    return undefined;
  }
  const pixels = amount * factor;
  return Number.isFinite(pixels) && pixels > 0 ? pixels : undefined;
}

function setSvgDimensions(svg: Element, dimensions: SvgDimensions): void {
  svg.properties.xmlns = SVG_NAMESPACE;
  svg.properties.width = formatDimension(dimensions.width);
  svg.properties.height = formatDimension(dimensions.height);
}

function formatDimension(value: number): string {
  return String(Number(value.toFixed(3)));
}

function serializeSvg(svg: Element): string {
  const tree: Root = { type: 'root', children: [svg as RootContent] };
  return String(unified().use(rehypeStringify).stringify(tree));
}

async function renderRasterImage(
  svg: string,
  dimensions: SvgDimensions,
  format: Exclude<DiagramImageFormat, 'svg'>,
  usesNotoSans: boolean,
): Promise<Uint8Array> {
  const scale = Math.min(
    1,
    MAX_RASTER_DIMENSION / dimensions.width,
    MAX_RASTER_DIMENSION / dimensions.height,
    Math.sqrt(MAX_RASTER_PIXELS / (dimensions.width * dimensions.height)),
  );
  const width = Math.max(1, Math.floor(dimensions.width * scale));
  const height = Math.max(1, Math.floor(dimensions.height * scale));
  const scaledSvg = fromHtml(svg, { fragment: true });
  const rootSvg = scaledSvg.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'svg',
  );
  if (rootSvg === undefined) {
    throw new Error('could not prepare the rendered SVG for raster export');
  }
  setSvgDimensions(rootSvg, { width, height });
  const fontCss = usesNotoSans ? await getNotoSansFontCss() : '';
  const html = createRasterHtml(serializeSvg(rootSvg), width, height, fontCss);

  let browser: Browser | undefined;
  let page: Page | undefined;
  try {
    browser = await withChromeSandboxFallback((disableSandbox) =>
      puppeteer.launch({ headless: true, args: disableSandbox ? ['--no-sandbox'] : [] }),
    );
    page = await browser.newPage();
    await page.setViewport({ width, height });
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
    const options: ScreenshotOptions = {
      type: format,
      ...(format === 'jpeg' ? { quality: 95 } : {}),
    };
    const image = await page.screenshot(options);
    return new Uint8Array(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/could not find chrome|browser .*was not found/i.test(message)) {
      throw new Error(
        `${message}. Install the compatible browser with: npx puppeteer browsers install chrome`,
        { cause: error },
      );
    }
    throw error instanceof Error ? error : new Error(message);
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

function createRasterHtml(svg: string, width: number, height: number, fontCss: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; background: #fff; }
body { color: #1f2328; font-family: 'Noto Sans', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
svg { display: block; width: ${width}px; height: ${height}px; }
</style></head><body>${svg}</body></html>`;
}
