import { expect } from 'aegir/chai';
import { FilterHelper } from '../src/filter-helper.js';
import type { DefinitionGroups, DefinitionGroup, Definition } from '../src/definition.js';
import type { Node, Text, List } from '../src/ast/ast.js';
import { item } from '../src/ast/ast.js';

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
              instance: item({
                range: item({
                  From: item({ char: item({ Char: item('0') }) }),
                  To: item({ char: item({ Char: item('9') }) })
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        alphaNum: {
          definitions: [
            {
              name: 'alphaNum',
              precedence: 0,
              instance: item({
                charSet: item({
                  Entries: item([
                    item({
                      range: item({
                        From: item({ char: item({ Char: item('a') }) }),
                        To: item({ char: item({ Char: item('z') }) })
                      })
                    }),
                    item({
                      range: item({
                        From: item({ char: item({ Char: item('0') }) }),
                        To: item({ char: item({ Char: item('9') }) })
                      })
                    })
                  ])
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        notDigit: {
          definitions: [
            {
              name: 'notDigit',
              precedence: 0,
              instance: item({
                charSet: item({
                  Not: item('true'),
                  Entries: item([
                    item({
                      range: item({
                        From: item({ char: item({ Char: item('0') }) }),
                        To: item({ char: item({ Char: item('9') }) })
                      })
                    })
                  ])
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        number: {
          definitions: [
            {
              name: 'digit',
              precedence: 0,
              instance: item({
                range: item({
                  From: item({ char: item({ Char: item('0') }) }),
                  To: item({ char: item({ Char: item('9') }) })
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        expr: {
          definitions: [
            {
              name: 'number',
              precedence: 0,
              instance: item({
                sequence: item([
                  item({
                    reference: item({
                      Name: item('digit')
                    })
                  })
                ])
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        term: {
          definitions: [
            {
              name: 'expr',
              precedence: 0,
              instance: item({
                or: item({
                  Expressions: item([
                    item({
                      reference: item({
                        Name: item('term')
                      })
                    }),
                    item({
                      sequence: item([
                        item({
                          reference: item({
                            Name: item('expr')
                          })
                        }),
                        item({
                          char: item({
                            Char: item('+')
                          })
                        }),
                        item({
                          reference: item({
                            Name: item('term')
                          })
                        })
                      ])
                    })
                  ])
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        optionalDigit: {
          definitions: [
            {
              name: 'term',
              precedence: 0,
              instance: item({
                range: item({
                  From: item({ char: item({ Char: item('0') }) }),
                  To: item({ char: item({ Char: item('9') }) })
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        },
        keyword: {
          definitions: [
            {
              name: 'optionalDigit',
              precedence: 0,
              instance: item({
                optional: item({
                  Expression: item({
                    range: item({
                      From: item({ char: item({ Char: item('0') }) }),
                      To: item({ char: item({ Char: item('9') }) })
                    })
                  })
                })
              }),
              isLeftRecursive: () => false
            } as Definition
          ],
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false
        }
      };

      // Create a filter helper
      const filterHelper = new FilterHelper(definitions);

      // Determine filters
      filterHelper.determine();

      // Check that filters were created for each definition group
      expect(definitions.digit?.filter).to.exist;
      expect(definitions.alphaNum?.filter).to.exist;
      expect(definitions.notDigit?.filter).to.exist;
      expect(definitions.number?.filter).to.exist;
      expect(definitions.expr?.filter).to.exist;
      expect(definitions.term?.filter).to.exist;
      expect(definitions.optionalDigit?.filter).to.exist;
      expect(definitions.keyword?.filter).to.exist;

      // Check specific filter properties for digit
      expect(definitions.digit?.filter?.isExclusive).to.be.true;
      expect(definitions.digit?.filter?.charSet.matches('0')).to.be.true;
      expect(definitions.digit?.filter?.charSet.matches('5')).to.be.true;
      expect(definitions.digit?.filter?.charSet.matches('9')).to.be.true;
      expect(definitions.digit?.filter?.charSet.matches('a')).to.be.false;

      // Check specific filter properties for alphaNum
      expect(definitions.alphaNum?.filter?.isExclusive).to.be.true;
      expect(definitions.alphaNum?.filter?.charSet.matches('a')).to.be.true;
      expect(definitions.alphaNum?.filter?.charSet.matches('z')).to.be.true;
      expect(definitions.alphaNum?.filter?.charSet.matches('0')).to.be.true;
      expect(definitions.alphaNum?.filter?.charSet.matches('9')).to.be.true;
      expect(definitions.alphaNum?.filter?.charSet.matches('!')).to.be.false;

      // Check specific filter properties for notDigit
      expect(definitions.notDigit?.filter?.isExclusive).to.be.true;
      expect(definitions.notDigit?.filter?.charSet.matches('0')).to.be.false;
      expect(definitions.notDigit?.filter?.charSet.matches('5')).to.be.false;
      expect(definitions.notDigit?.filter?.charSet.matches('9')).to.be.false;
      expect(definitions.notDigit?.filter?.charSet.matches('a')).to.be.true;
      expect(definitions.notDigit?.filter?.charSet.matches('!')).to.be.true;

      // Check specific filter properties for keyword
      expect(definitions.keyword?.filter?.isExclusive).to.be.true;
      expect(definitions.keyword?.filter?.charSet.matches('i')).to.be.true;
      expect(definitions.keyword?.filter?.charSet.matches('f')).to.be.false; // Only checks first char
    });
  });
});
