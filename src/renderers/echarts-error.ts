export const MAX_ECHARTS_DIAGNOSTIC_CHARS = 2_048;

export class EChartsError extends Error {
  readonly line?: number;
  readonly column?: number;
  readonly pointer?: string;

  constructor(
    message: string,
    location: { line?: number; column?: number; pointer?: string } = {},
  ) {
    super(limitEChartsMessage(message));
    this.name = 'EChartsError';
    if (location.line !== undefined) this.line = location.line;
    if (location.column !== undefined) this.column = location.column;
    if (location.pointer !== undefined) this.pointer = location.pointer;
  }
}

export function limitEChartsMessage(message: string): string {
  if (message.length <= MAX_ECHARTS_DIAGNOSTIC_CHARS) return message;
  return `${message.slice(0, MAX_ECHARTS_DIAGNOSTIC_CHARS - 3)}...`;
}

export function toEChartsJsonPointer(path: readonly (string | number)[]): string {
  return path
    .map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .join('');
}
