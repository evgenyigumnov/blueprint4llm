import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { parsePlantUmlConsoleErrors, parsePlantUmlSvgErrors } from './plantuml-diagnostics.js';
import {
  renderPlantUmlInPage,
  PLANTUML_MAX_SVG_SIZE,
  PLANTUML_RENDER_TIMEOUT_MS,
} from './plantuml-page.js';
import type { DiagramRenderer } from './types.js';

export { PLANTUML_RENDER_TIMEOUT_MS };
export { PLANTUML_MAX_SVG_SIZE };

export const MAX_PLANTUML_SOURCE_BYTES = 256 * 1024;
export const MAX_CONCURRENT_PLANTUML_RENDERINGS = 2;

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_PLANTUML_RENDERINGS);

/** Renders PlantUML fences with the local JavaScript/Wasm engine in Chromium. */
export const plantumlRenderer: DiagramRenderer = {
  name: 'plantuml',
  languages: ['plantuml'],
  cacheKey: `@plantuml/core@1.2026.9;max-svg-size=${PLANTUML_MAX_SVG_SIZE};includes=deny;network=deny;theme=light`,

  async render(source, context) {
    const sourceBytes = Buffer.byteLength(source, 'utf8');
    if (sourceBytes > MAX_PLANTUML_SOURCE_BYTES) {
      throw new Error(
        `diagram is too large: ${sourceBytes} bytes (limit ${MAX_PLANTUML_SOURCE_BYTES} bytes)`,
      );
    }

    return limiter.run(async () => {
      const result = await renderPlantUmlInPage(source, context.signal);
      return {
        svg: result.svg,
        warnings: [],
        errors: [
          ...parsePlantUmlSvgErrors(result.svg),
          ...parsePlantUmlConsoleErrors(result.consoleMessages),
        ],
      };
    });
  },
};
