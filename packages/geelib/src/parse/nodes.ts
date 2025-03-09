import type { Item } from "../ast/ast";
import { uncaptured } from "../capture";
import type { Comparer } from "../comparer";
import type { Definition, DefinitionGroup, Unit } from "../nodes";
import type { ParserContext } from "../parser-context"

export type ParserNode = {
	parse(context: ParserContext): Item | undefined;
}

export class ParserUnit implements Unit<ParserNode> {
	constructor(
		public readonly name: string | undefined,
		public readonly root: DefinitionGroup<ParserUnit>,
		public readonly comparer: Comparer,
		public readonly whitespace: DefinitionGroup<ParserUnit> | undefined,
		public readonly groups: Record<string, DefinitionGroup<ParserUnit>>
	) {
	}

	parse(context: ParserContext): Item | undefined {
		return uncaptured(this.root.parse(context));
	}
}

export class ParserDefinitionGroup implements DefinitionGroup<ParserNode> {
	constructor(
		public readonly name: string,
		public readonly definitions: Definition<ParserNode>[]
	) {
	}

	parse(context: ParserContext): Item | undefined {
		return uncaptured(this.definitions.find(d => d.name === context.current)?.parse(context));
	}
}
