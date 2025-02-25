export type NodeType =
  | 'block'
  | 'definition'
  | 'sequence'
  | 'repeat'
  | 'separated'
  | 'andNot'
  | 'as'
  | 'declaration'
  | 'or'
  | 'group'
  | 'optional'
  | 'reference'
  | 'range'
  | 'char'
  | 'string'
  | 'charSet'
  | 'text'
  | 'list'
  | 'capture'
  | 'count'
  | 'fromTo'
  | 'quote';

export interface RepeatCount {
  type: 'count';
  value: number;
}

export interface RepeatRange {
  type: 'fromTo';
  from: number;
  to: number | 'n';
}

export interface Node {
  type: NodeType;
  attributes: Map<string, Item>;
  start?: number;
  end?: number;
  grammarName?: string;
  parent?: Node;
}

export interface Text extends Node {
  type: 'text';
  value: string;
}

export interface List extends Node {
  type: 'list';
  items: Item[];
}

export type Item = Node | Text | List;

export interface TokenStream {
  read(): string;
  next(): boolean;
  position: number;
  eof: boolean;
  size: number;
  readThenNext(): string;
  getSegment(start: number, length: number): string;
}

export interface CharRange {
  low: number;
  high: number;
}

export class CharSet {
  private ranges: CharRange[] = [];

  constructor(range?: CharRange) {
    if (range) {
      this.ranges.push(range);
    }
  }

  union(value: CharRange | CharSet): void {
    if ('ranges' in value) {
      value.ranges.forEach(r => this.unionRange(r));
    } else {
      this.unionRange(value);
    }
  }

  private unionRange(value: CharRange): void {
    // Find overlapping or adjacent ranges
    const overlapping: CharRange[] = [];
    let newLow = value.low;
    let newHigh = value.high;

    for (const range of this.ranges) {
      if (range.high + 1 >= value.low && range.low - 1 <= value.high) {
        overlapping.push(range);
        newLow = Math.min(newLow, range.low);
        newHigh = Math.max(newHigh, range.high);
      }
    }

    // Remove overlapping ranges and add merged range
    overlapping.forEach(range => {
      const index = this.ranges.indexOf(range);
      if (index !== -1) {
        this.ranges.splice(index, 1);
      }
    });

    this.ranges.push({ low: newLow, high: newHigh });
    this.ranges.sort((a, b) => a.low - b.low);
  }

  matches(char: string): boolean {
    const code = char.charCodeAt(0);
    return this.ranges.some(r => code >= r.low && code <= r.high);
  }

  invert(): void {
    if (this.ranges.length === 0) {
      this.ranges.push({ low: 0, high: 0xFFFF });
      return;
    }

    const sorted = [...this.ranges].sort((a, b) => a.low - b.low);
    const inverted: CharRange[] = [];
    let pos = 0;

    sorted.forEach(range => {
      if (range.low > pos) {
        inverted.push({ low: pos, high: range.low - 1 });
      }
      pos = range.high === 0xFFFF ? 0xFFFF : range.high + 1;
    });

    if (pos < 0xFFFF) {
      inverted.push({ low: pos, high: 0xFFFF });
    }

    this.ranges = inverted;
  }
}

export function isNode(value: any): value is Node {
  return value && typeof value === 'object' && 'type' in value && !('items' in value) && !('value' in value);
}

export function isList(value: any): value is List {
  return value && typeof value === 'object' && 'items' in value;
}
