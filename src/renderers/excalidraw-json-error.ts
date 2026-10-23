/** A strict Excalidraw JSON error with a one-based location in the fenced source. */
export class ExcalidrawJsonError extends Error {
  constructor(
    message: string,
    source: string,
    offset: number,
    readonly jsonPointer?: string,
  ) {
    const position = offsetToPosition(source, offset);
    super(jsonPointer === undefined ? message : `${message} at ${pointerToPath(jsonPointer)}`);
    this.name = 'ExcalidrawJsonError';
    this.line = position.line;
    this.column = position.column;
  }

  readonly line: number;
  readonly column: number;
}

export function offsetToPosition(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(offset, 0), source.length);
  for (let index = 0; index < end; index += 1) {
    const char = source[index];
    if (char === '\r') {
      if (source[index + 1] === '\n' && index + 1 < end) {
        index += 1;
      }
      line += 1;
      column = 1;
    } else if (char === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function pointerToPath(pointer: string): string {
  if (pointer === '') {
    return '<root>';
  }
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : segment))
    .reduce((path, segment) => {
      if (segment.startsWith('[')) {
        return `${path}${segment}`;
      }
      return path === '' ? segment : `${path}.${segment}`;
    }, '');
}
