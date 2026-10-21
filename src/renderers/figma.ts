import { createHash } from 'node:crypto';

import { MAX_FIGMA_JSON_BYTES, parseAndSelectFigmaFrame } from './figma-json.js';
import { addSvgSansSerifFallback } from './figma-fonts.js';
import { renderFigmaFrame } from './figma-svg.js';
import { fetchFigmaSvg } from './figma-api.js';
import { parseFigmaUrl } from './figma-url.js';
import type { DiagramRenderer } from './types.js';

export type FigmaSourceKind = 'json' | 'url';

export const FIGMA_URL_CACHE_TTL_MS = 5 * 60 * 1000;

export const figmaRenderer: DiagramRenderer = {
  name: 'figma',
  languages: ['figma'],
  cacheKey: 'figma-json-svg-v3',
  cacheKeyForContext(source, context) {
    if (!/^https:\/\//i.test(source.trimStart())) {
      return 'local';
    }

    const token = context.figmaAccessToken?.trim() ?? '';
    const fingerprint =
      token.length === 0 ? 'no-token' : createHash('sha256').update(token).digest('hex');
    return `remote-token=${fingerprint}`;
  },
  cacheTtlMsForSource(source) {
    return /^https:\/\//i.test(source.trimStart()) ? FIGMA_URL_CACHE_TTL_MS : undefined;
  },
  maxSourceBytes: MAX_FIGMA_JSON_BYTES,

  async render(source, context) {
    const kind = classifyFigmaSource(source);
    if (kind === 'url') {
      const parsedUrl = parseFigmaUrl(source);
      const token = context.figmaAccessToken;
      if (token === undefined || token.trim().length === 0) {
        throw new Error('FIGMA_ACCESS_TOKEN is required to render a Figma URL');
      }
      const svg = await fetchFigmaSvg(parsedUrl, token, {
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      });
      return { svg: addSvgSansSerifFallback(svg), warnings: [] };
    }

    const frame = parseAndSelectFigmaFrame(source, context.metadata);
    return { svg: addSvgSansSerifFallback(renderFigmaFrame(frame)), warnings: [] };
  },
};

export function classifyFigmaSource(source: string): FigmaSourceKind {
  const trimmed = source.trimStart();
  if (trimmed.startsWith('{')) {
    return 'json';
  }
  if (/^https:\/\//i.test(trimmed)) {
    return 'url';
  }
  throw new Error('Figma source must be a JSON object or an HTTPS Figma URL');
}
