import { CharSet } from './types.js';
import type { Node } from "./ast/ast.js";

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
  definitions: Definition[];
  referenceMinPrecedents: Map<Node, number>;
  filter?: Filter;
  recursiveness?: number;
  isLeftRecursive(): boolean;
}

export type DefinitionGroups = Record<string, DefinitionGroup>;

export function createDefinitionGroup(name: string): DefinitionGroup {
	return {
		definitions: [],
		referenceMinPrecedents: new Map(),
		recursiveness: Recursiveness.None,
		isLeftRecursive() {
			return (this.recursiveness! & (Recursiveness.Left | Recursiveness.Full)) !== Recursiveness.None;
		}
	};
}

export function createDefinition(name: string, precedence: number, instance: Node): Definition {
	return {
		name,
		precedence,
		instance,
		recursiveness: Recursiveness.None,
		associativity: Associativity.None,
		isLeftRecursive() {
			return (this.recursiveness! & (Recursiveness.Left | Recursiveness.Full)) !== Recursiveness.None;
		}
	};
}
