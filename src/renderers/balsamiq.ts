import { MAX_BALSAMIQ_JSON_BYTES, parseBalsamiqJson } from './balsamiq-json.js';
import { renderBalsamiqSvg } from './balsamiq-svg.js';
import type { DiagramRenderer } from './types.js';

/** Renders one Balsamiq Mockups 3 JSON wireframe locally as a safe inline SVG. */
export const balsamiqRenderer: DiagramRenderer = {
  name: 'balsamiq',
  languages: ['balsamiq'],
  cacheKey: 'balsamiq-mockups3-json-svg-v1;controls=static',
  maxSourceBytes: MAX_BALSAMIQ_JSON_BYTES,

  async render(source) {
    const mockup = parseBalsamiqJson(source);
    return { svg: renderBalsamiqSvg(mockup), warnings: [] };
  },
};
