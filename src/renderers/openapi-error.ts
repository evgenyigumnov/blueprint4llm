export interface OpenApiErrorOptions {
  pointer?: string;
  line?: number;
  column?: number;
  cause?: unknown;
}

/** Parser error with source-local coordinates and an optional JSON Pointer. */
export class OpenApiError extends Error {
  readonly pointer: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(message: string, options: OpenApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'OpenApiError';
    this.pointer = options.pointer;
    this.line = options.line;
    this.column = options.column;
  }
}
