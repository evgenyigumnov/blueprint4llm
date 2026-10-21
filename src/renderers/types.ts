export interface DiagramWarning {
  message: string;
  line?: number;
  column?: number;
}

export interface DiagramError {
  message: string;
  line?: number;
  column?: number;
}

export interface DiagramResult {
  svg: string;
  warnings: DiagramWarning[];
  /** Non-fatal renderer diagnostics that should be reported without stopping the build. */
  errors?: DiagramError[];
}

export interface DiagramRenderContext {
  diagramId: string;
  sourceFile: string;
  line: number;
  /** Raw fenced-code metadata, for renderers that use block options. */
  metadata?: string;
  /** Resolved Figma credential; populated only for the Figma renderer. */
  figmaAccessToken?: string;
  signal?: AbortSignal;
}

export interface DiagramRenderer {
  readonly name: string;
  readonly languages: readonly string[];
  /** Renderer configuration and package versions included in the in-memory cache key. */
  readonly cacheKey: string;
  /** Optional source limit for formats that can safely accept larger input than diagrams. */
  readonly maxSourceBytes?: number;
  /** Optional context-specific cache identity for credentials or per-block options. */
  cacheKeyForContext?(source: string, context: DiagramRenderContext): string;
  /** Optional cache lifetime for a specific source. Omit it to keep the result until eviction. */
  cacheTtlMsForSource?(source: string): number | undefined;
  render(source: string, context: DiagramRenderContext): Promise<DiagramResult>;
}
