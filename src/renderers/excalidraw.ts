import { MAX_EXCALIDRAW_JSON_BYTES } from './excalidraw-schema.js';
import { parseExcalidrawJson } from './excalidraw-json.js';
import { renderExcalidrawSvg } from './excalidraw-svg.js';
import type { DiagramRenderer } from './types.js';

/** Renders an embedded Excalidraw v2 JSON document as local inline SVG. */
export const excalidrawRenderer: DiagramRenderer = {
  name: 'excalidraw',
  languages: ['excalidraw'],
  cacheKey: 'excalidraw-file-v2;json-parser-v1;geometry-v1;text-v1;styles-v1',
  maxSourceBytes: MAX_EXCALIDRAW_JSON_BYTES,

  async render(source, context) {
    throwIfAborted(context.signal);
    const scene = parseExcalidrawJson(source, context.signal);
    throwIfAborted(context.signal);
    const svg = renderExcalidrawSvg(scene, context.signal);
    return { svg, warnings: scene.warnings };
  },
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('diagram rendering was aborted');
  }
}
