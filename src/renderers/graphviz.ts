import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { assertSingleGraphSource, parseGraphvizMetadata } from './graphviz-source.js';
import { readGraphvizResult } from './graphviz-diagnostics.js';
import { normalizeGraphvizSvg } from './graphviz-svg.js';
import { GraphvizRunner } from './graphviz-runner.js';
import {
  GRAPHVIZ_ENGINE_VERSION,
  GRAPHVIZ_ENGINES,
  GRAPHVIZ_PACKAGE_VERSION,
} from './graphviz-worker-protocol.js';
import {
  MAX_CONCURRENT_GRAPHVIZ_RENDERINGS,
  MAX_GRAPHVIZ_SOURCE_BYTES,
} from './graphviz-limits.js';
import type { DiagramRenderer } from './types.js';

/** Builds the shared renderer with an injectable runner for focused tests. */
export function createGraphvizRenderer(
  runner: Pick<GraphvizRunner, 'render'> = new GraphvizRunner(),
): DiagramRenderer {
  const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_GRAPHVIZ_RENDERINGS);
  return {
    name: 'graphviz',
    languages: ['graphviz', 'dot'],
    maxSourceBytes: MAX_GRAPHVIZ_SOURCE_BYTES,
    cacheKey: [
      `@viz-js/viz@${GRAPHVIZ_PACKAGE_VERSION}`,
      `graphviz@${GRAPHVIZ_ENGINE_VERSION}`,
      `engines=${GRAPHVIZ_ENGINES.join(',')}`,
      'format=svg_inline',
      'worker-v1;unicode-width-warning=filtered-v1',
    ].join(';'),

    async render(source, context) {
      const sourceBytes = Buffer.byteLength(source, 'utf8');
      if (sourceBytes > MAX_GRAPHVIZ_SOURCE_BYTES) {
        throw new Error(
          `Graphviz source is too large: ${sourceBytes} bytes (limit ${MAX_GRAPHVIZ_SOURCE_BYTES} bytes)`,
        );
      }
      if (source.trim().length === 0) {
        throw new Error('Graphviz source must not be empty');
      }

      const { engine } = parseGraphvizMetadata(context.metadata);
      assertSingleGraphSource(source);
      const rendered = await limiter.run(
        () => runner.render(source, engine, context.signal),
        context.signal,
      );
      if (rendered.graphvizVersion !== GRAPHVIZ_ENGINE_VERSION) {
        throw new Error(
          `Graphviz worker version mismatch: expected ${GRAPHVIZ_ENGINE_VERSION}, received ${rendered.graphvizVersion}`,
        );
      }
      const missingEngines = GRAPHVIZ_ENGINES.filter(
        (engine) => !rendered.engines.includes(engine),
      );
      if (missingEngines.length > 0) {
        throw new Error(
          `Graphviz worker is missing verified engine(s): ${missingEngines.join(', ')}`,
        );
      }
      const result = readGraphvizResult(rendered);
      return {
        svg: normalizeGraphvizSvg(result.svg),
        warnings: result.warnings,
      };
    },
  };
}

export const graphvizRenderer = createGraphvizRenderer();
