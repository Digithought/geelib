import { Grammar, OptimizedGrammar, DefinitionGroups, StringStream, optimizeGrammar, parseInput, parseInputOptimized } from '../src';

// Example: Create a simple grammar for parsing CSV files
function createCsvGrammar() {
  const definitions = new DefinitionGroups();

  // Define the CSV grammar
  const csvGroup = DefinitionGroups.createDefinitionGroup('CSV');
  definitions.set('CSV', csvGroup);

  // Add definitions for CSV elements
  csvGroup.definitions.add(DefinitionGroups.createDefinition('CSV', 0, {
    type: 'definition',
    attributes: new Map([
      ['Sequence', {
        type: 'list',
        items: [
          {
            type: 'reference',
            attributes: new Map([
              ['Name', { type: 'text', value: 'Row', attributes: new Map() }]
            ])
          },
          {
            type: 'repeat',
            attributes: new Map([
              ['Expression', {
                type: 'group',
                attributes: new Map([
                  ['Sequence', {
                    type: 'list',
                    items: [
                      {
                        type: 'char',
                        attributes: new Map([
                          ['Char', { type: 'text', value: '\n', attributes: new Map() }]
                        ])
                      },
                      {
                        type: 'reference',
                        attributes: new Map([
                          ['Name', { type: 'text', value: 'Row', attributes: new Map() }]
                        ])
                      }
                    ],
                    attributes: new Map()
                  }]
                ])
              }]
            ])
          }
        ],
        attributes: new Map()
      }]
    ])
  }));

  // Define Row
  const rowGroup = DefinitionGroups.createDefinitionGroup('Row');
  definitions.set('Row', rowGroup);

  rowGroup.definitions.add(DefinitionGroups.createDefinition('Row', 0, {
    type: 'definition',
    attributes: new Map([
      ['Sequence', {
        type: 'list',
        items: [
          {
            type: 'reference',
            attributes: new Map([
              ['Name', { type: 'text', value: 'Field', attributes: new Map() }]
            ])
          },
          {
            type: 'repeat',
            attributes: new Map([
              ['Expression', {
                type: 'group',
                attributes: new Map([
                  ['Sequence', {
                    type: 'list',
                    items: [
                      {
                        type: 'char',
                        attributes: new Map([
                          ['Char', { type: 'text', value: ',', attributes: new Map() }]
                        ])
                      },
                      {
                        type: 'reference',
                        attributes: new Map([
                          ['Name', { type: 'text', value: 'Field', attributes: new Map() }]
                        ])
                      }
                    ],
                    attributes: new Map()
                  }]
                ])
              }]
            ])
          }
        ],
        attributes: new Map()
      }]
    ])
  }));

  // Define Field
  const fieldGroup = DefinitionGroups.createDefinitionGroup('Field');
  definitions.set('Field', fieldGroup);

  fieldGroup.definitions.add(DefinitionGroups.createDefinition('Field', 0, {
    type: 'definition',
    attributes: new Map([
      ['Sequence', {
        type: 'list',
        items: [
          {
            type: 'repeat',
            attributes: new Map([
              ['Expression', {
                type: 'andNot',
                attributes: new Map([
                  ['Expression', {
                    type: 'charSet',
                    attributes: new Map([
                      ['All', { type: 'text', value: '', attributes: new Map() }]
                    ])
                  }],
                  ['NotExpression', {
                    type: 'charSet',
                    attributes: new Map([
                      ['Entries', {
                        type: 'list',
                        items: [
                          {
                            type: 'char',
                            attributes: new Map([
                              ['Char', { type: 'text', value: ',', attributes: new Map() }]
                            ])
                          },
                          {
                            type: 'char',
                            attributes: new Map([
                              ['Char', { type: 'text', value: '\n', attributes: new Map() }]
                            ])
                          }
                        ],
                        attributes: new Map()
                      }]
                    ])
                  }]
                ])
              }]
            ])
          }
        ],
        attributes: new Map()
      }]
    ])
  }));

  // Create and return the grammar
  return new Grammar(definitions, 'CSV');
}

// Example usage
function main() {
  // Create the grammar
  const csvGrammar = createCsvGrammar();
  console.log('Created CSV grammar with root:', csvGrammar.root);

  // Optimize the grammar
  const optimizedGrammar = optimizeGrammar(csvGrammar);
  console.log('Grammar optimized:', optimizedGrammar instanceof OptimizedGrammar);

  // Parse a simple CSV string
  const csvString = 'a,b,c\n1,2,3\n4,5,6';

  const result = parseInput(optimizedGrammar, csvString);
  console.log('Parsing successful:', result !== null);

  if (result) {
    console.log('Parsed CSV structure:', JSON.stringify(result, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2));
  }

  // Example of using the convenience methods
  console.log('\nUsing convenience methods:');
  const parseResult = parseInputOptimized(csvGrammar, csvString);
  console.log('Parsing with automatic optimization successful:', parseResult !== null);
}

main();
