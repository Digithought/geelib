import { CharSet } from './types';
import type { Node } from './types';

export enum Associativity {
  None = 0,
  Left = 1,
  Right = 2
}

export enum Recursiveness {
  None = 0,
  Left = 1,
  Right = 2,
  Full = 4,
  Non = 8,
  IsExclusive = 16
}

export enum RecurseMask {
  None = 0,
  Left = 1,
  Right = 2
}

export interface Filter {
  charSet: CharSet;
  isExclusive: boolean;
}

export interface Definition {
  name: string;
  precedence: number;
  instance: Node;
  associativity?: Associativity;
  filter?: Filter;
  recursiveness?: number;
  isLeftRecursive(): boolean;
}

export interface DefinitionGroup {
  definitions: Set<Definition>;
  referenceMinPrecedents: Map<Node, number>;
  filter?: Filter;
  recursiveness?: number;
  isLeftRecursive(): boolean;
}

export class DefinitionGroups extends Map<string, DefinitionGroup> {
  static createDefinitionGroup(name: string): DefinitionGroup {
    return {
      definitions: new Set(),
      referenceMinPrecedents: new Map(),
      recursiveness: Recursiveness.None,
      isLeftRecursive() {
        return (this.recursiveness! & (Recursiveness.Left | Recursiveness.Full)) !== Recursiveness.None;
      }
    };
  }

  static createDefinition(name: string, precedence: number, instance: Node): Definition {
    return {
      name,
      precedence,
      instance,
      recursiveness: Recursiveness.None,
      isLeftRecursive() {
        return (this.recursiveness! & (Recursiveness.Left | Recursiveness.Full)) !== Recursiveness.None;
      }
    };
  }
}
