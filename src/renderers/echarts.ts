import { createHash } from 'node:crypto';

import { parseAndValidateSvg } from '../svg/parse-and-validate.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { EChartsError } from './echarts-error.js';
import {
  applyEChartsOptionPolicy,
  ECHARTS_FONT_FAMILY,
  ECHARTS_POLICY_REVISION,
  MAX_ECHARTS_SVG_BYTES,
} from './echarts-options.js';
import {
  ECHARTS_RENDER_TIMEOUT_MS,
  ECHARTS_WORKER_MAX_OLD_GENERATION_MB,
  renderEChartsInWorker,
} from './echarts-runner.js';
import {
  parseEChartsSource,
  ECHARTS_VERSION,
  MAX_ECHARTS_JSON_DEPTH,
  MAX_ECHARTS_JSON_NODES,
  MAX_ECHARTS_LINE_BYTES,
  MAX_ECHARTS_SOURCE_BYTES,
} from './echarts-source.js';
import {
  MAX_ECHARTS_DATA_DIMENSIONS,
  MAX_ECHARTS_DATA_POINTS,
  MAX_ECHARTS_SERIES,
} from './echarts-options-data.js';
import type { DiagramRenderer } from './types.js';

export const MAX_CONCURRENT_ECHARTS_RENDERINGS = 2;
const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_ECHARTS_RENDERINGS);
const RENDERER_RULES = [
  'echarts@' + ECHARTS_VERSION,
  ECHARTS_POLICY_REVISION,
  'mode=svg-ssr',
  'defaults=800x450',
  'font=' + ECHARTS_FONT_FAMILY,
  'source=' + MAX_ECHARTS_SOURCE_BYTES,
  'depth=' + MAX_ECHARTS_JSON_DEPTH,
  'nodes=' + MAX_ECHARTS_JSON_NODES,
  'line=' + MAX_ECHARTS_LINE_BYTES,
  'series=' + MAX_ECHARTS_SERIES,
  'points=' + MAX_ECHARTS_DATA_POINTS,
  'dimensions=' + MAX_ECHARTS_DATA_DIMENSIONS,
  'concurrency=' + MAX_CONCURRENT_ECHARTS_RENDERINGS,
  'timeout=' + ECHARTS_RENDER_TIMEOUT_MS,
  'worker-old-heap=' + ECHARTS_WORKER_MAX_OLD_GENERATION_MB,
  'svg=' + MAX_ECHARTS_SVG_BYTES,
].join(';');

/** Renders the documented ECharts option profile as a static, local SVG. */
export const echartsRenderer: DiagramRenderer = {
  name: 'echarts',
  languages: ['echarts'],
  maxSourceBytes: MAX_ECHARTS_SOURCE_BYTES,
  cacheKey: createHash('sha256').update(RENDERER_RULES).digest('hex') + ';' + RENDERER_RULES,

  async render(source, context) {
    return limiter.run(async () => {
      const parsed = parseEChartsSource(source, context.metadata ?? '');
      throwIfAborted(context.signal);
      const policy = applyEChartsOptionPolicy(
        parsed.option,
        parsed.width,
        parsed.height,
        parsed.positions,
      );
      const rendered = await renderEChartsInWorker(
        policy.option,
        parsed.width,
        parsed.height,
        context.signal,
      );
      validateRenderedSvg(rendered.svg, parsed.width, parsed.height);
      return {
        svg: rendered.svg,
        warnings: [...policy.warnings, ...rendered.warnings].map((message) => ({ message })),
      };
    }, context.signal);
  },
};

function validateRenderedSvg(svg: string, width: number, height: number): void {
  const byteLength = Buffer.byteLength(svg, 'utf8');
  if (byteLength > MAX_ECHARTS_SVG_BYTES) {
    throw new EChartsError('ECharts SVG exceeds the ' + MAX_ECHARTS_SVG_BYTES + ' byte limit');
  }
  const root = parseAndValidateSvg(svg);
  if (
    parseDimension(root.properties.width) !== width ||
    parseDimension(root.properties.height) !== height
  ) {
    throw new EChartsError('ECharts SVG dimensions do not match the requested canvas');
  }
  if (typeof root.properties.viewBox !== 'string') {
    throw new EChartsError('ECharts SVG must include a viewBox');
  }
}

function parseDimension(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?(?:px)?$/.test(value.trim())) return undefined;
  const dimension = Number.parseFloat(value);
  return Number.isFinite(dimension) ? dimension : undefined;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new EChartsError('ECharts rendering was aborted');
  }
}
