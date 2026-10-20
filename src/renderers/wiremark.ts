import { render } from '@wiremark/core';

import type { DiagramRenderer } from './types.js';

/** Adapts the Blackburn-Labs Wiremark renderer to the compiler's plugin API. */
export const wiremarkRenderer: DiagramRenderer = {
  name: 'wiremark',
  languages: ['wireframe', 'wiremark'],
  cacheKey: 'wiremark-core@0.1.0;theme=light',

  async render(source) {
    const result = render(source);
    return {
      svg: result.svg,
      warnings: result.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'warning')
        .map((diagnostic) => ({
          message: diagnostic.message,
          ...(diagnostic.loc === undefined ? {} : { line: diagnostic.loc.line }),
          ...(diagnostic.loc?.col === undefined ? {} : { column: diagnostic.loc.col }),
        })),
      errors: result.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => ({
          message: diagnostic.message,
          ...(diagnostic.loc === undefined ? {} : { line: diagnostic.loc.line }),
          ...(diagnostic.loc?.col === undefined ? {} : { column: diagnostic.loc.col }),
        })),
    };
  },
};
