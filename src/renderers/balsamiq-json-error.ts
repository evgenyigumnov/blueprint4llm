/** A Balsamiq JSON error with a one-based position in the fenced source. */
export class BalsamiqJsonError extends Error {
  constructor(message: string, source: string, offset: number) {
    const location = offsetToPosition(source, offset);
    super(message);
    this.name = 'BalsamiqJsonError';
    this.line = location.line;
    this.column = location.column;
  }

  readonly line: number;
  readonly column: number;
}

function offsetToPosition(source: string, offset: number): { line: number; column: number } {
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
