import { OptimizedGrammar, parseGrammar, optimizeGrammar, parseInput, parseWithGrammarText } from '../src';

// Example: Parse a grammar from a string and use it to parse input
function main() {
  // Define a simple grammar for arithmetic expressions
  const grammarText = `
    grammar Arithmetic

    Expression
      : Term
      | Expression "+" Term
      | Expression "-" Term
      ;

    Term
      : Factor
      | Term "*" Factor
      | Term "/" Factor
      ;

    Factor
      : Number
      | "(" Expression ")"
      ;

    Number
      : [0-9]+
      ;
  `;

  console.log('Parsing grammar from string...');

  // Parse the grammar
  const grammar = parseGrammar(grammarText);
  console.log('Grammar parsed successfully with root:', grammar.root);

  // Optimize the grammar
  const optimizedGrammar = optimizeGrammar(grammar);
  console.log('Grammar optimized:', optimizedGrammar instanceof OptimizedGrammar);

  // Parse an arithmetic expression
  const input = '2 + 3 * (4 - 1)';
  console.log(`\nParsing input: "${input}"`);

  const result = parseInput(optimizedGrammar, input);
  console.log('Parsing successful:', result !== null);

  if (result) {
    console.log('Parsed structure:', JSON.stringify(result, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2));
  }

  // Example of using the convenience method
  console.log('\nUsing convenience method:');
  const parseResult = parseWithGrammarText(grammarText, input);
  console.log('Parsing with grammar text successful:', parseResult !== null);
}

main();
