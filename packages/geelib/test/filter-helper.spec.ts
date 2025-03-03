import { expect } from 'aegir/chai';
import { FilterHelper } from '../src/filter-helper.js';
import { CharSet } from '../src/types.js';
import { createDefinitionGroup } from '../src/definition.js';
import type { DefinitionGroups, DefinitionGroup, Definition } from '../src/definition.js';
import type { Node, NodeType, Item, Text, List } from '../src/ast/ast.js';

// Since we're only testing a few cases for brevity, let's define a more specific type
interface TestDefinitions {
  digit?: DefinitionGroup;
  alphaNum?: DefinitionGroup;
  notDigit?: DefinitionGroup;
  number?: DefinitionGroup;
  expr?: DefinitionGroup;
  term?: DefinitionGroup;
  optionalDigit?: DefinitionGroup;
  keyword?: DefinitionGroup;
}

describe('FilterHelper', () => {
  describe('determine()', () => {
    it('should determine filters for simple definitions', () => {
      // Create a simple definition group with character ranges
      const definitions: TestDefinitions & DefinitionGroups = {
        digit: {
          definitions: [
            {
              name: 'digit',
              precedence: 0,
              instance: {
                type: 'range' as NodeType,
                attributes: {
                  From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '0' } as Text } } as Node,
                  To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '9' } as Text } } as Node
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      // Check that the filter was created correctly
      const digitGroup = definitions.digit;
      expect(digitGroup).to.exist;
      expect(digitGroup!.filter).to.exist;
      expect(digitGroup!.filter!.isExclusive).to.be.true;
      expect(digitGroup!.filter!.charSet.matches('0')).to.be.true;
      expect(digitGroup!.filter!.charSet.matches('5')).to.be.true;
      expect(digitGroup!.filter!.charSet.matches('9')).to.be.true;
      expect(digitGroup!.filter!.charSet.matches('a')).to.be.false;
    });

    it('should handle character sets', () => {
      const definitions: TestDefinitions & DefinitionGroups = {
        alphaNum: {
          definitions: [
            {
              name: 'alphaNum',
              precedence: 0,
              instance: {
                type: 'charSet' as NodeType,
                attributes: {
                  Entries: {
                    type: 'list' as NodeType,
                    items: [
                      {
                        type: 'range' as NodeType,
                        attributes: {
                          From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: 'a' } as Text } } as Node,
                          To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: 'z' } as Text } } as Node
                        }
                      } as Node,
                      {
                        type: 'range' as NodeType,
                        attributes: {
                          From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '0' } as Text } } as Node,
                          To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '9' } as Text } } as Node
                        }
                      } as Node
                    ]
                  } as List
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      const alphaNumGroup = definitions.alphaNum;
      expect(alphaNumGroup).to.exist;
      expect(alphaNumGroup!.filter).to.exist;
      expect(alphaNumGroup!.filter!.isExclusive).to.be.true;
      expect(alphaNumGroup!.filter!.charSet.matches('a')).to.be.true;
      expect(alphaNumGroup!.filter!.charSet.matches('m')).to.be.true;
      expect(alphaNumGroup!.filter!.charSet.matches('z')).to.be.true;
      expect(alphaNumGroup!.filter!.charSet.matches('5')).to.be.true;
      expect(alphaNumGroup!.filter!.charSet.matches('!')).to.be.false;
    });

    it('should handle inverted character sets', () => {
      const definitions: TestDefinitions & DefinitionGroups = {
        notDigit: {
          definitions: [
            {
              name: 'notDigit',
              precedence: 0,
              instance: {
                type: 'charSet' as NodeType,
                attributes: {
                  Not: { type: 'text' as NodeType, value: 'true' } as Text,
                  Entries: {
                    type: 'list' as NodeType,
                    items: [
                      {
                        type: 'range' as NodeType,
                        attributes: {
                          From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '0' } as Text } } as Node,
                          To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '9' } as Text } } as Node
                        }
                      } as Node
                    ]
                  } as List
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      expect(definitions.notDigit?.filter).to.exist;
      expect(definitions.notDigit?.filter!.isExclusive).to.be.true;
      expect(definitions.notDigit?.filter!.charSet.matches('0')).to.be.false;
      expect(definitions.notDigit?.filter!.charSet.matches('5')).to.be.false;
      expect(definitions.notDigit?.filter!.charSet.matches('9')).to.be.false;
      expect(definitions.notDigit?.filter!.charSet.matches('a')).to.be.true;
      expect(definitions.notDigit?.filter!.charSet.matches('!')).to.be.true;
    });

    it('should handle references between definitions', () => {
      const definitions: TestDefinitions & DefinitionGroups = {
        digit: {
          definitions: [
            {
              name: 'digit',
              precedence: 0,
              instance: {
                type: 'range' as NodeType,
                attributes: {
                  From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '0' } as Text } } as Node,
                  To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '9' } as Text } } as Node
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        number: {
          definitions: [
            {
              name: 'number',
              precedence: 0,
              instance: {
                type: 'sequence' as NodeType,
                attributes: {
                  Sequence: {
                    type: 'list' as NodeType,
                    items: [
                      {
                        type: 'reference' as NodeType,
                        attributes: {
                          Name: { type: 'text' as NodeType, value: 'digit' } as Text
                        }
                      } as Node
                    ]
                  } as List
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      expect(definitions.digit?.filter).to.exist;
      expect(definitions.number?.filter).to.exist;
      expect(definitions.number?.filter!.charSet.matches('0')).to.be.true;
      expect(definitions.number?.filter!.charSet.matches('9')).to.be.true;
      expect(definitions.number?.filter!.charSet.matches('a')).to.be.false;
    });

    it('should handle recursive references', () => {
      const definitions: TestDefinitions & DefinitionGroups = {
        expr: {
          definitions: [
            {
              name: 'expr',
              precedence: 0,
              instance: {
                type: 'or' as NodeType,
                attributes: {
                  Expressions: {
                    type: 'list' as NodeType,
                    items: [
                      {
                        type: 'reference' as NodeType,
                        attributes: {
                          Name: { type: 'text' as NodeType, value: 'term' } as Text
                        }
                      } as Node,
                      {
                        type: 'sequence' as NodeType,
                        attributes: {
                          Sequence: {
                            type: 'list' as NodeType,
                            items: [
                              {
                                type: 'reference' as NodeType,
                                attributes: {
                                  Name: { type: 'text' as NodeType, value: 'expr' } as Text
                                }
                              } as Node,
                              {
                                type: 'char' as NodeType,
                                attributes: {
                                  Char: { type: 'text' as NodeType, value: '+' } as Text
                                }
                              } as Node,
                              {
                                type: 'reference' as NodeType,
                                attributes: {
                                  Name: { type: 'text' as NodeType, value: 'term' } as Text
                                }
                              } as Node
                            ]
                          } as List
                        }
                      } as Node
                    ]
                  } as List
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        term: {
          definitions: [
            {
              name: 'term',
              precedence: 0,
              instance: {
                type: 'range' as NodeType,
                attributes: {
                  From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '0' } as Text } } as Node,
                  To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '9' } as Text } } as Node
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      expect(definitions.term?.filter).to.exist;
      expect(definitions.expr?.filter).to.exist;
      expect(definitions.expr?.filter!.charSet.matches('0')).to.be.true;
      expect(definitions.expr?.filter!.charSet.matches('9')).to.be.true;
      expect(definitions.expr?.filter!.charSet.matches('+')).to.be.true;
      expect(definitions.expr?.filter!.charSet.matches('a')).to.be.false;
    });

    it('should handle optional expressions', () => {
      const definitions: TestDefinitions & DefinitionGroups = {
        optionalDigit: {
          definitions: [
            {
              name: 'optionalDigit',
              precedence: 0,
              instance: {
                type: 'optional' as NodeType,
                attributes: {
                  Expression: {
                    type: 'range' as NodeType,
                    attributes: {
                      From: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '0' } as Text } } as Node,
                      To: { type: 'char' as NodeType, attributes: { Char: { type: 'text' as NodeType, value: '9' } as Text } } as Node
                    }
                  } as Node
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      expect(definitions.optionalDigit?.filter).to.exist;
      expect(definitions.optionalDigit?.filter!.isExclusive).to.be.false;
      expect(definitions.optionalDigit?.filter!.charSet.matches('0')).to.be.true;
      expect(definitions.optionalDigit?.filter!.charSet.matches('9')).to.be.true;
    });

    it('should handle string literals', () => {
      const definitions: TestDefinitions & DefinitionGroups = {
        keyword: {
          definitions: [
            {
              name: 'keyword',
              precedence: 0,
              instance: {
                type: 'string' as NodeType,
                attributes: {
                  Value: { type: 'text' as NodeType, value: 'if' } as Text
                }
              } as Node,
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      const helper = new FilterHelper(definitions);
      helper.determine();

      expect(definitions.keyword?.filter).to.exist;
      expect(definitions.keyword?.filter!.isExclusive).to.be.true;
      expect(definitions.keyword?.filter!.charSet.matches('i')).to.be.true;
      expect(definitions.keyword?.filter!.charSet.matches('f')).to.be.false; // Only checks first char
    });
  });
});
