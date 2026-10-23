/** Severity of a compiler diagnostic. */
export type DiagnosticSeverity = 'error' | 'warning';

/** Part of the compilation pipeline that produced a diagnostic. */
export type DiagnosticScope = 'diagram' | 'document' | 'output';

/** Stable diagnostic identifiers used by the compiler and its consumers. */
export type DiagnosticCode =
  | 'diagram.render'
  | 'diagram.limit'
  | 'diagram.svg'
  | 'document.read'
  | 'document.compile'
  | 'output.render'
  | 'output.write'
  | 'renderer.warning';

/** Structured compiler diagnostic with optional Markdown source coordinates. */
export interface BlueprintDiagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  scope: DiagnosticScope;
  sourceFile: string;
  line?: number;
  column?: number;
  diagramId?: string;
  renderer?: string;
  /** Complete message text without a repeated file or location prefix. */
  message: string;
}

/** Counts diagnostics by severity. */
export interface DiagnosticSummary {
  errors: number;
  warnings: number;
}

/** Returns error and warning counts without relying on their formatted text. */
export function summarizeDiagnostics(
  diagnostics: readonly BlueprintDiagnostic[],
): DiagnosticSummary {
  return diagnostics.reduce<DiagnosticSummary>(
    (summary, diagnostic) => {
      if (diagnostic.severity === 'error') {
        summary.errors += 1;
      } else {
        summary.warnings += 1;
      }
      return summary;
    },
    { errors: 0, warnings: 0 },
  );
}

/** Formats a diagnostic for the legacy string fields and plain-text output. */
export function formatDiagnostic(diagnostic: BlueprintDiagnostic): string {
  const location =
    diagnostic.line === undefined
      ? diagnostic.sourceFile
      : `${diagnostic.sourceFile}:${diagnostic.line}:${diagnostic.column ?? 1}`;
  const renderFailurePrefix =
    diagnostic.renderer === undefined ? undefined : `${diagnostic.renderer} render failed:`;
  const isRenderFailure =
    diagnostic.code === 'diagram.render' &&
    renderFailurePrefix !== undefined &&
    diagnostic.message.startsWith(renderFailurePrefix);
  const label = isRenderFailure
    ? ''
    : diagnostic.scope === 'diagram'
      ? `${diagnostic.renderer === undefined ? '' : `${diagnostic.renderer} `}${diagnostic.severity}: `
      : `${diagnostic.severity}: `;
  return `${location}: ${label}${diagnostic.message}`;
}
