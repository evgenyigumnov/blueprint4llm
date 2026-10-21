import { parsePencilJson } from './pencil-json.js';
import { layoutPencilDocument } from './pencil-layout.js';
import { MAX_PENCIL_JSON_BYTES } from './pencil-schema.js';
import { renderPencilSvg } from './pencil-svg.js';
import type { DiagramRenderer } from './types.js';

/** Renders supported Pencil JSONC documents locally as safe inline SVG. */
export const pencilRenderer: DiagramRenderer = {
  name: 'pencil',
  languages: ['pencil', 'pen'],
  cacheKey: 'pencil-jsonc-svg-v1;schema=2.21;layout=absolute-flex;shapes=static',
  maxSourceBytes: MAX_PENCIL_JSON_BYTES,

  async render(source) {
    const document = parsePencilJson(source);
    const layout = layoutPencilDocument(document);
    return { svg: renderPencilSvg(layout), warnings: [] };
  },
};
