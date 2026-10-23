import { OpenApiError } from './openapi-error.js';
import { layoutOpenApiDocument } from './openapi-layout.js';
import { buildOpenApiModel } from './openapi-model.js';
import { MAX_OPENAPI_SOURCE_BYTES, parseOpenApiSource } from './openapi-source.js';
import { renderOpenApiSvg } from './openapi-svg.js';
import type { DiagramRenderer } from './types.js';

/** Renders an embedded OpenAPI 3.1.1 document into a fully expanded API reference. */
export const openapiRenderer: DiagramRenderer = {
  name: 'openapi',
  languages: ['openapi'],
  cacheKey: 'openapi-3.1.1-static-svg-v2;yaml@2.9.1;refs=json-pointer;layout=reference-v2',
  maxSourceBytes: MAX_OPENAPI_SOURCE_BYTES,

  async render(source, context) {
    throwIfAborted(context.signal);
    try {
      const parsed = parseOpenApiSource(source);
      throwIfAborted(context.signal);
      const document = buildOpenApiModel(parsed, context.signal);
      throwIfAborted(context.signal);
      const layout = layoutOpenApiDocument(document);
      throwIfAborted(context.signal);
      const svg = renderOpenApiSvg(layout, document.title, document.positions);
      throwIfAborted(context.signal);
      return {
        svg,
        warnings: document.warnings.map((warning) => ({
          message: warning.message,
          ...(warning.line === undefined ? {} : { line: warning.line }),
          ...(warning.column === undefined ? {} : { column: warning.column }),
        })),
      };
    } catch (error) {
      if (error instanceof OpenApiError) {
        throw new OpenApiError(
          error.pointer === undefined ? error.message : `${error.message} (${error.pointer})`,
          {
            ...(error.pointer === undefined ? {} : { pointer: error.pointer }),
            ...(error.line === undefined ? {} : { line: error.line }),
            ...(error.column === undefined ? {} : { column: error.column }),
            cause: error,
          },
        );
      }
      throw error;
    }
  },
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('OpenAPI rendering was aborted');
  }
}
