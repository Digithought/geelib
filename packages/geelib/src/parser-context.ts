import type { TokenStream } from './types.js';
import type { Item, Text, List } from "./ast/ast.js";
import { isList, isText, item } from "./ast/ast.js";
import { undefinedIf } from "./utility/undefined-if.js";
import { ParserError } from './errors.js';

export enum CacheStatus {
  False = 0,
  True = 1,
  Evaluating = 2
}

interface CacheEntry {
  status: CacheStatus;
  result?: Item;
  length?: number;
}

type CacheBucket = Map<string, CacheEntry>;

export class ParserContext {
  private definitionCache = new Map<number, CacheBucket>();
  private positions: number[] = [];

  public whitespaceRule?: string;
  public caseSensitive: boolean = true;

  constructor(
    public reader: TokenStream,
    private matchOnly: boolean = false,
    options?: { whitespaceRule?: string; caseSensitive?: boolean }
  ) {
    if (options) {
      this.whitespaceRule = options.whitespaceRule;
      this.caseSensitive = options.caseSensitive ?? true;
    }
  }

  /**
   * Compares two strings based on the case sensitivity setting
   */
  compareStrings(a: string | undefined, b: string | undefined): boolean {
    if (!a || !b) return false;

    if (this.caseSensitive) {
      return a === b;
    } else {
      return a.toLowerCase() === b.toLowerCase();
    }
  }

  /**
   * Executes a parsing operation within a transaction
   * Similar to ParseTransact in ParserBase.cs
   */
  parseTransact<T extends Item | undefined>(operation: () => T): T {
    const startPosition = this.pushPosition();

    try {
      const result = operation();
      if (result === undefined) {
        // If parsing failed, restore position
        this.reader.position = startPosition;
      }
      return result;
    } catch (error) {
      // On error, restore position and rethrow
      this.reader.position = startPosition;
      throw error;
    } finally {
      this.popPosition();
    }
  }

  /**
   * Executes a parsing operation with caching
   * Similar to ParseCache in ParserBase.cs
   */
  parseCache<T extends Item | undefined>(definition: string, parseMethod: () => T): T {
    // Check cache first
    const cacheResult = this.cacheSeek(definition);
    if (cacheResult !== false) {
      return cacheResult as T;
    }

    // Not in cache, start evaluating
    const startPosition = this.reader.position;
    this.cacheStart(definition);

    try {
      const result = parseMethod();

      if (result !== undefined) {
        // Cache successful result
        this.cacheSucceed(definition, startPosition, this.reader.position, result);
      } else {
        // Cache failure
        this.cacheFail(definition, startPosition);
      }

      return result;
    } catch (error) {
      this.cacheFail(definition, startPosition);
      throw error;
    }
  }

  /**
   * Checks if a definition is in the cache
   */
  cacheSeek(definition: string): Item | null | false {
    const bucket = this.definitionCache.get(this.reader.position);
    if (!bucket) return false;

    const entry = bucket.get(definition);
    if (!entry) return false;

    if ((entry.status & CacheStatus.True) === CacheStatus.True) {
      this.reader.position += entry.length!;
      return entry.result || null;
    }

    return false;
  }

  /**
   * Marks a definition as being evaluated
   */
  cacheStart(definition: string): void {
    const bucket = this.getCacheBucket(this.reader.position);
    const entry = bucket.get(definition);

    if (entry) {
      entry.status |= CacheStatus.Evaluating;
    } else {
      bucket.set(definition, { status: CacheStatus.Evaluating });
    }
  }

  /**
   * Marks a definition as successfully parsed
   */
  cacheSucceed(definition: string, startPosition: number, endPosition: number, result: Item): void {
    const bucket = this.getCacheBucket(startPosition);
    const entry = bucket.get(definition);

    if (entry) {
      entry.status |= CacheStatus.True;
      entry.result = result;
      entry.length = endPosition - startPosition;
    } else {
      throw new ParserError("Internal error: unstarted cache definition succeeded", startPosition);
    }
  }

  /**
   * Marks a definition as failed
   */
  cacheFail(definition: string, startPosition: number): void {
    const bucket = this.getCacheBucket(startPosition);
    const entry = bucket.get(definition);

    if (entry) {
      entry.status &= ~CacheStatus.Evaluating;
    } else {
      throw new ParserError("Internal error: unstarted cache definition failed", startPosition);
    }
  }

  /**
   * Resets the cache for the current position
   */
  cacheReset(): void {
    const bucket = this.definitionCache.get(this.reader.position);
    if (!bucket) return;

    // Convert entries() iterator to array for compatibility
    Array.from(bucket.entries()).forEach(([key, entry]) => {
      if (entry.status === CacheStatus.False) {
        bucket.delete(key);
      }
    });
  }

  /**
   * Saves the current position and returns it
   */
  pushPosition(): number {
    const position = this.reader.position;
    this.positions.push(position);
    return position;
  }

  /**
   * Removes the last saved position
   */
  popPosition(): void {
    this.positions.pop();
  }

  /**
   * Gets or creates a cache bucket for the given position
   */
  private getCacheBucket(position: number): CacheBucket {
    let bucket = this.definitionCache.get(position);
    if (!bucket) {
      bucket = new Map();
      this.definitionCache.set(position, bucket);
    }
    return bucket;
  }

  /**
   * Combines two items into one
   */
  combineItems(left: Item, right: Item): Item {
    const start = undefinedIf(Math.min(left.start ?? Infinity, right.start ?? Infinity), Infinity);
    const end = undefinedIf(Math.max(left.end ?? 0, right.end ?? 0), 0);

    if (isList(left)) {
      if (isList(right)) {
        return item([...(left.value as Array<Item>), ...(right.value as Array<Item>)], start, end);
      } else {
        return item([...(left.value as Array<Item>), right], start, end);
      }
    } else if (isText(left)) {
      if (isText(right)) {
        return item((left.value as string) + (right.value as string), start, end);
      } else {
        return item([left, right], start, end);
      }
    } else {
      // Convert to list
      return item([left, right], start, end);
    }
  }
}
