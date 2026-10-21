import { MAX_DRAWIO_JSON_BYTES, parseDrawioJson } from './drawio-json.js';
import { renderDrawioSvg } from './drawio-svg.js';
import type { DiagramRenderer } from './types.js';

/** Renders structural draw.io JSON locally as a safe inline SVG. */
export const drawioRenderer: DiagramRenderer = {
  name: 'drawio',
  languages: ['drawio', 'draw.io'],
  cacheKey: 'drawio-structural-json-svg-v1;layout=ranked-tb-lr',
  maxSourceBytes: MAX_DRAWIO_JSON_BYTES,

  async render(source, context) {
    const graph = parseDrawioJson(source, context.metadata);
    return { svg: renderDrawioSvg(graph), warnings: [] };
  },
};
