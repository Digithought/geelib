export class ParserError extends Error {
  constructor(
    message: string,
    public readonly position: number,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'ParserError';
  }

  static fromPosition(message: string, position: number, source?: string): ParserError {
    if (!source) {
      return new ParserError(message, position);
    }

    // Calculate line and column from position and source
    const lines = source.substring(0, position).split('\n');
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;

    return new ParserError(message, position, line, column);
  }

  toString(): string {
    const location = this.line
      ? `at line ${this.line}, column ${this.column}`
      : `at position ${this.position}`;

    return `${this.name}: ${this.message} (${location})`;
  }
}

export class GrammarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrammarError';
  }
}
