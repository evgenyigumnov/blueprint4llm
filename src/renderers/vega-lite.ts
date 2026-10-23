import { createHash } from 'node:crypto';

import { parseAndValidateSvg } from '../svg/parse-and-validate.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { loadVegaLiteAssets } from './vega-lite-assets.js';
import { MAX_VEGA_LITE_ROWS } from './vega-lite-data.js';
import { VegaLiteError } from './vega-lite-error.js';
import { renderVegaLiteInPage } from './vega-lite-page.js';
import {
  applyVegaLitePolicy,
  MAX_VEGA_LITE_TRANSFORMS,
  MAX_VEGA_LITE_VIEWS,
  VEGA_LITE_POLICY_REVISION,
} from './vega-lite-policy.js';
import {
  AJV_POLICY_VERSION,
  validateVegaLiteSchema,
  VEGA_LITE_SCHEMA_SHA256,
} from './vega-lite-schema.js';
import { parseVegaLiteSource } from './vega-lite-source.js';
import type { DiagramRenderer } from './types.js';

export const MAX_VEGA_LITE_SOURCE_BYTES = 256 * 1024;
export const MAX_CONCURRENT_VEGA_LITE_RENDERINGS = 2;
const MAX_VEGA_LITE_SVG_BYTES = 4 * 1024 * 1024;
const RENDERER_RULES = [
  'vega-lite@6.5.0',
  'vega@6.4.0',
  AJV_POLICY_VERSION,
  `schema-sha256=${VEGA_LITE_SCHEMA_SHA256}`,
  VEGA_LITE_POLICY_REVISION,
  'defaults=480x300',
  'locale=en-US',
  'timezone=UTC',
  `rows=${MAX_VEGA_LITE_ROWS}`,
  `views=${MAX_VEGA_LITE_VIEWS}`,
  `transforms=${MAX_VEGA_LITE_TRANSFORMS}`,
  `svg=${MAX_VEGA_LITE_SVG_BYTES}`,
].join(';');
const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_VEGA_LITE_RENDERINGS);

/** Renders strict Vega-Lite 6 JSON fences into static SVG. */
export const vegaLiteRenderer: DiagramRenderer = {
  name: 'vega-lite',
  languages: ['vega-lite', 'vegalite'],
  maxSourceBytes: MAX_VEGA_LITE_SOURCE_BYTES,
  cacheKey: createHash('sha256').update(RENDERER_RULES).digest('hex') + `;${RENDERER_RULES}`,

  async render(source, context) {
    return limiter.run(async () => {
      const sourceBytes = Buffer.byteLength(source, 'utf8');
      if (sourceBytes > MAX_VEGA_LITE_SOURCE_BYTES) {
        throw new VegaLiteError(
          `Vega-Lite block is too large: ${sourceBytes} bytes (limit ${MAX_VEGA_LITE_SOURCE_BYTES} bytes)`,
        );
      }
      throwIfAborted(context.signal);

      const parsed = parseVegaLiteSource(source);
      const policy = applyVegaLitePolicy(parsed.value, source, parsed.positions);
      const validation = await validateVegaLiteSchema(parsed.value, parsed.positions);
      throwIfAborted(context.signal);

      const assets = await loadVegaLiteAssets();
      if (
        validation.schemaHash !== assets.schemaHash ||
        assets.schemaHash !== VEGA_LITE_SCHEMA_SHA256 ||
        validation.vegaLiteVersion !== assets.vegaLiteVersion ||
        validation.vegaVersion !== assets.vegaVersion
      ) {
        throw new Error('Vega-Lite schema and browser assets have inconsistent package versions');
      }
      const rendered = await renderVegaLiteInPage(parsed.value, assets, context.signal);
      validateSvgDimensions(rendered.svg);
      return {
        svg: rendered.svg,
        warnings: [
          ...policy.warnings.map((message) => ({ message })),
          ...rendered.warnings.map((message) => ({ message })),
        ],
        errors: rendered.errors.map((message) => ({ message })),
      };
    }, context.signal);
  },
};

function validateSvgDimensions(svg: string): void {
  if (Buffer.byteLength(svg, 'utf8') > MAX_VEGA_LITE_SVG_BYTES) {
    throw new Error(`Vega-Lite SVG exceeds the ${MAX_VEGA_LITE_SVG_BYTES} byte limit`);
  }
  const root = parseAndValidateSvg(svg);
  const width = numericDimension(root.properties.width);
  const height = numericDimension(root.properties.height);
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    throw new Error('Vega-Lite SVG must have positive finite width and height');
  }
  if (width > 4_096 || height > 4_096 || width * height > 16_000_000) {
    throw new Error(`Vega-Lite SVG dimensions exceed the limit: ${width} × ${height} px`);
  }
  const viewBox = root.properties.viewBox;
  if (typeof viewBox !== 'string') return;
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error('Vega-Lite SVG has an invalid viewBox');
  }
  const [x, y, viewWidth, viewHeight] = parts;
  if (
    x === undefined ||
    y === undefined ||
    viewWidth === undefined ||
    viewHeight === undefined ||
    viewWidth <= 0 ||
    viewHeight <= 0 ||
    Math.abs(x) > 4_096 ||
    Math.abs(y) > 4_096 ||
    viewWidth > 4_096 ||
    viewHeight > 4_096
  ) {
    throw new Error('Vega-Lite SVG viewBox exceeds the supported bounds');
  }
}

function numericDimension(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?(?:px)?$/.test(value.trim())) return undefined;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : undefined;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('diagram rendering was aborted');
  }
}
