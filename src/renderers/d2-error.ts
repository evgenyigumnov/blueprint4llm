export interface D2Location {
  line?: number;
  column?: number;
}

export class D2Error extends Error {
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(message: string, location: D2Location = {}, options?: ErrorOptions) {
    super(message, options);
    this.name = 'D2Error';
    this.line = location.line;
    this.column = location.column;
  }
}
