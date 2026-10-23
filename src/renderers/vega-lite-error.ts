export const MAX_VEGA_LITE_DIAGNOSTIC_CHARS = 2_048;

export class VegaLiteError extends Error {
  readonly line?: number;
  readonly column?: number;
  readonly pointer?: string;

  constructor(
    message: string,
    location: { line?: number; column?: number; pointer?: string } = {},
  ) {
    super(limitMessage(message));
    this.name = 'VegaLiteError';
    if (location.line !== undefined) this.line = location.line;
    if (location.column !== undefined) this.column = location.column;
    if (location.pointer !== undefined) this.pointer = location.pointer;
  }
}

export function limitMessage(message: string): string {
  if (message.length <= MAX_VEGA_LITE_DIAGNOSTIC_CHARS) return message;
  return `${message.slice(0, MAX_VEGA_LITE_DIAGNOSTIC_CHARS - 3)}...`;
}

export function toJsonPointer(path: readonly (string | number)[]): string {
  return path
    .map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .join('');
}
