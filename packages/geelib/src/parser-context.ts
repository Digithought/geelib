import type { TokenStream } from './types.js';
import type { Item, Text, List } from "./ast/ast.js";
import { isList } from "./ast/ast-helpers.js";

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
  private resultStack: Item[] = [];
  private positions: number[] = [];
  private transactionLevel = 0;

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

  get result(): Item {
    const result = this.resultStack[this.resultStack.length - 1];
    if (!result) throw new Error('No result on stack');
    return result;
  }

  beginTransaction(): void {
    this.transactionLevel++;
    this.pushPosition();
    this.pushResults();
  }

  commitTransaction(): void {
    if (this.transactionLevel <= 0) {
      throw new Error('No active transaction to commit');
    }
    this.transactionLevel--;
    this.commitPosition();
    this.commitResult();
  }

  rollbackTransaction(): void {
    if (this.transactionLevel <= 0) {
      throw new Error('No active transaction to rollback');
    }
    this.transactionLevel--;
    this.rollbackPosition();
    this.rollbackResult();
  }

  cacheSeek(definition: string): boolean | null {
    const bucket = this.definitionCache.get(this.reader.position);
    if (!bucket) return null;

    const entry = bucket.get(definition);
    if (!entry) return null;

    if ((entry.status & CacheStatus.True) === CacheStatus.True) {
      this.reader.position += entry.length!;
      if (entry.result && this.resultStack.length > 0) {
        this.append(entry.result);
      } else if (entry.result) {
        this.pushResult(entry.result);
      }
      return true;
    }
    return false;
  }

  cacheStart(definition: string): void {
    const bucket = this.getCacheBucket(this.reader.position);
    const entry = bucket.get(definition);

    if (entry) {
      entry.status |= CacheStatus.Evaluating;
    } else {
      bucket.set(definition, { status: CacheStatus.Evaluating });
    }
  }

  cacheSucceed(definition: string, startPosition: number, endPosition: number, result: Item): void {
    const bucket = this.getCacheBucket(startPosition);
    const entry = bucket.get(definition);

    if (entry) {
      entry.status |= CacheStatus.True;
      entry.result = result;
      entry.length = endPosition - startPosition;
    } else {
      throw new Error("Internal error: unstarted cache definition succeeded");
    }
  }

  cacheFail(definition: string, startPosition: number): void {
    const bucket = this.getCacheBucket(startPosition);
    const entry = bucket.get(definition);

    if (entry) {
      entry.status &= ~CacheStatus.Evaluating;
    } else {
      throw new Error("Internal error: unstarted cache definition failed");
    }
  }

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

  pushResult(result: Item | null): void {
    if (result) {
      result.start = this.reader.position;
      result.end = this.reader.position;
      this.resultStack.push(result);
    }
  }

  pushResults(): void {
    this.pushResult({
      type: 'text',
      value: '',
      start: this.reader.position,
      end: this.reader.position
    } as Text);
  }

  commitResult(): void {
    const result = this.resultStack.pop();
    if (this.resultStack.length > 0 && result) {
      const prev = this.resultStack.pop();
      if (prev) {
        this.resultStack.push(this.appendItems(prev, result));
      }
    }
  }

  rollbackResult(): void {
    this.resultStack.pop();
  }

  append(result: Item): void {
    const current = this.result;
    if (current) {
      this.appendItems(current, result);
    }
  }

  pushPosition(): void {
    this.positions.push(this.reader.position);
  }

  commitPosition(): void {
    this.positions.pop();
  }

  rollbackPosition(): void {
    const pos = this.positions.pop();
    if (pos !== undefined) {
      this.reader.position = pos;
    }
  }

  private getCacheBucket(position: number): CacheBucket {
    let bucket = this.definitionCache.get(position);
    if (!bucket) {
      bucket = new Map();
      this.definitionCache.set(position, bucket);
    }
    return bucket;
  }

  private appendItems(target: Item, source: Item): Item {
    if (isList(target) && isList(source)) {
      target.items.push(...source.items);
    } else if (this.isText(target) && this.isText(source)) {
      target.value += source.value;
    } else if (isList(target)) {
      target.items.push(source);
    } else {
      // Convert target to list if needed
      const list: List = {
        type: 'list',
        items: [target, source],
        start: Math.min(target.start!, source.start!),
        end: Math.max(target.end!, source.end!)
      };
      return list;
    }
    target.start = Math.min(target.start!, source.start!);
    target.end = Math.max(target.end!, source.end!);
    return target;
  }

  private isText(item: Item): item is Text {
    return item.type === 'text';
  }
}
