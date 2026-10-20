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
  signal?: AbortSignal;
}

export interface DiagramRenderer {
  readonly name: string;
  readonly languages: readonly string[];
  /** Renderer configuration and package versions included in the in-memory cache key. */
  readonly cacheKey: string;
  render(source: string, context: DiagramRenderContext): Promise<DiagramResult>;
}
