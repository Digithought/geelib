import type { TokenStream } from './types';

export class StringStream implements TokenStream {
  private _position = 0;

  constructor(private text: string) {}

  read(): string {
    if (this._position >= this.text.length) {
      throw new Error('Attempt to read past end of document');
    }
    const char = this.text.charAt(this._position);
    if (!char) {
      throw new Error('Invalid character position');
    }
    return char;
  }

  next(): boolean {
    this.position++;
    return this.eof;
  }

  readThenNext(): string {
    const result = this.read();
    this.position++;
    return result;
  }

  get position(): number {
    return this._position;
  }

  set position(value: number) {
    this._position = Math.max(0, Math.min(this.text.length, value));
  }

  get eof(): boolean {
    return this._position >= this.text.length;
  }

  get size(): number {
    return this.text.length;
  }

  getSegment(start: number, length: number): string {
    return this.text.substring(start, start + length);
  }
}
