export interface RepeatCount {
  type: 'count';
  value: number;
}

export interface RepeatRange {
  type: 'fromTo';
  from: number;
  to: number | 'n';
}

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

/**
 * Represents a set of character ranges.
 *
 * CharSet is used to efficiently represent and manipulate sets of characters
 * for pattern matching. It stores characters as ranges of character codes,
 * and provides methods to add ranges, check if a character is in the set,
 * and invert the set.
 *
 * Character ranges are automatically merged when they overlap or are adjacent,
 * which optimizes the representation and improves matching performance.
 */
export class CharSet {
  private ranges: CharRange[] = [];

  /**
   * Creates a new CharSet, optionally with an initial range.
   *
   * @param range Optional initial character range to add to the set
   */
  constructor(range?: CharRange) {
    if (range) {
      this.ranges.push(range);
    }
  }

  /**
   * Adds a character range or another CharSet to this set.
   *
   * @param value A CharRange or CharSet to add to this set
   */
  union(value: CharRange | CharSet): void {
    if ('ranges' in value) {
      value.ranges.forEach(r => this.unionRange(r));
    } else {
      this.unionRange(value);
    }
  }

  /**
   * Adds a character range to this set, merging with existing ranges if needed.
   *
   * @param value Character range to add
   */
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

  /**
   * Checks if a character is in this set.
   *
   * @param char Character to check
   * @returns True if the character is in the set, false otherwise
   */
  matches(char: string): boolean {
    const code = char.charCodeAt(0);
    return this.ranges.some(r => code >= r.low && code <= r.high);
  }

  /**
   * Inverts this character set.
   *
   * After inversion, the set will match all characters that it didn't match before,
   * and won't match any characters that it did match before.
   *
   * An empty set becomes a set that matches all characters (0x0000-0xFFFF).
   * A set that matches all characters becomes an empty set.
   */
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
