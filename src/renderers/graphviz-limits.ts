/** Maximum UTF-8 size of one DOT block. */
export const MAX_GRAPHVIZ_SOURCE_BYTES = 256 * 1024;

/** Maximum UTF-8 size of the inline SVG returned by Graphviz. */
export const MAX_GRAPHVIZ_SVG_BYTES = 4 * 1024 * 1024;

/** Maximum rendered SVG side in CSS pixels. */
export const MAX_GRAPHVIZ_DIMENSION_PX = 8192;

/** Includes worker startup, Wasm initialization, and layout. */
export const GRAPHVIZ_RENDER_TIMEOUT_MS = 30_000;

/** Maximum number of concurrent Graphviz Wasm workers in one process. */
export const MAX_CONCURRENT_GRAPHVIZ_RENDERINGS = 2;
