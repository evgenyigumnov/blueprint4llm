/** Structured compile/build error with optional source position. */
export interface DiagnosticLocation {
  sourceFile?: string;
  line?: number;
  column?: number;
}

export class DiagnosticError extends Error {
  readonly sourceFile: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(message: string, options: DiagnosticLocation & { cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DiagnosticError';
    this.sourceFile = options.sourceFile;
    this.line = options.line;
    this.column = options.column;
  }

  /** Renders a diagnostic in the form `file:line:column: message`. */
  format(): string {
    const parts: string[] = [];
    if (this.sourceFile !== undefined) {
      if (this.line !== undefined) {
        parts.push(`${this.sourceFile}:${this.line}:${this.column ?? 1}`);
      } else {
        parts.push(this.sourceFile);
      }
    }
    parts.push(this.message);
    return parts.join(': ');
  }
}

/** Normalizes an unknown thrown value into a `DiagnosticError`. */
export function toDiagnosticError(
  error: unknown,
  fallbackMessage: string,
  location: DiagnosticLocation = {},
): DiagnosticError {
  if (error instanceof DiagnosticError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  const position = extractPosition(error);
  return new DiagnosticError(message || fallbackMessage, {
    ...location,
    ...position,
    cause: error,
  });
}

function extractPosition(error: unknown): DiagnosticLocation {
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  const candidate = error as {
    position?: { start?: { line?: number; column?: number } };
    line?: number;
    column?: number;
  };
  const line = candidate.position?.start?.line ?? candidate.line;
  const column = candidate.position?.start?.column ?? candidate.column;
  if (typeof line === 'number') {
    return { line, column: typeof column === 'number' ? column : 1 };
  }
  return {};
}
