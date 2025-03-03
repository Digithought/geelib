# Gee Grammar Language Documentation

Gee is a powerful grammar definition language that allows you to define parsers for context-free grammars. It combines features from traditional BNF notation with modern extensions for better expressiveness and control.  

Capabilities:
* **Combined parser/lexer** - Whitespace is specified as a rule, and tokens can use double quoted (called "quotes") or single quotes (called "strings") to indicate whitespace-sensitivity
* **AST inference** - Gee can infer the AST structure from the grammar rules
* **Recursive definitions** - Definitions can reference themselves
* **Declarative precedence and associativity** - Recursive definitions can explicitly specify precedence and associativity
* **Grammar optimization** - Gee can optimize grammars, to eliminate superfluous rules, push up common sub-patterns, and more

## Basic Structure

A Gee grammar file consists of:
1. Grammar header with optional settings
2. A series of grammar rule definitions

Example:
```gee
grammar MyLanguage
  comparer: sensitive
  whitespace: _

root = 
  [ "begin" Statements "end" ]

Statements :=
  Statement*

...
```

## Grammar Header

The grammar header defines the grammar name and optional settings:

- `grammar <Name>`: Defines the grammar name
- `comparer: (sensitive | insensitive)`: (default=sensitive) Sets case sensitivity for string matching
- `whitespace: <identifier>`: (default="_" if it exists, otherwise nothing) Specifies the whitespace handling rule

Example:
```gee
grammar Calculator
  comparer: sensitive  // Case-sensitive string matching
  whitespace: _       // Use the '_' rule for whitespace handling
```

## Rule Types

### Declarations vs Definitions

- `:=` indicates a declaration rule (creates a node in the AST).  Name these PascalCase.
- `=` indicates a definition rule (helper rule, doesn't create AST node).  Name these camelCase.

Example:
```gee
Expression := 
  number | operation    // Creates AST nodes

number = 
  digit+               // Helper rule, no AST node
```

### Rule Precedence and Associativity

Rules can specify precedence and associativity for handling operator precedence:

```gee
expression =
  number

expression 0 L = 
  L: expression "+" R: expression  // Left-associative, precedence 0

expression 1 R = 
  L: expression "*" R: expression  // Right-associative, precedence 1
```

Higher precedence rules are evaluated first.  If the precedence is the same, the associativity is used to determine which rule is evaluated first.  Rules without precedence are evaluated first, and are typically terminal rules, since precedence and associativity don't apply.

In the example above:
* `5 + 5 + 5` results in `(5 + 5) + 5` because `+` has left associativity.  
* `5 * 5 * 5` results in `5 * (5 * 5)` because `*` has right associativity.
* `5 + 5 * 3` results in `5 + (5 * 3)` because `*` has higher precedence than `+`.

## Expression Types

### Basic Expressions

1. **String Literals**:
   ```gee
   "keyword"     // Matches "keyword", ignoring whitespace on either side
   'exact'       // Matches 'exact' with no whitespace allowed
   ```

2. **Character Sets**:
   ```gee
   {a..z}        // Range of characters
   {!a..z}       // Negated range
   {?, !#0}      // Any char except null
   ```

3. **Character References**:
   ```gee
   #9            // Tab character
   #13           // Carriage return
   ```

### Grouping and Repetition

1. **Groups**:
   ```gee
   ( Expression )     // Grouping
   [ Expression ]     // Optional group
   ```

2. **Repetition**:
   ```gee
   Expression*        // Zero or more
   Expression+        // One or more
   Expression*3       // Exactly 3
   Expression*1..3    // 1 to 3 times
   Expression*2..n    // 2 or more times
   ```

3. **Separated Lists**:
   ```gee
   Expression^","     // List separated by commas
   ```

### Special Expressions

1. **Declarations**:
   ```gee
   Name : Expression  // Names a captured value
   ```

2. **And-Not Expressions**:
   ```gee
   Expression &! NotExpression  // Matches if Expression matches and NotExpression doesn't
   ```

3. **Value Mapping**:
   ```gee
   "''" as "'"       // Maps double quote to single quote
   ```

## Lexer Rules

### Whitespace and Comments

```gee
_ =  // Typically the whitespace rule name
  [ { ' ', #9..#13 } | lineComment | blockComment ]*

blockComment =
  '/*' [ blockComment | {?} &! '*/' ]* '*/'

lineComment =
  '//' [ {! #10, #13 } ]*
```

### Basic Character Classes

```gee
letter =
  { 'a'..'z', 'A'..'Z' }

digit =
  '0'..'9'

identifier =
  _ ( letter | '_' [ letter | digit | '_' ]* )+ _
```

## Examples

### Simple Calculator Grammar

```gee
grammar Calculator
  comparer: sensitive
  whitespace: _

expression =
  group | number

expression 0 =
  Add : number Operator : ( "+" | "-" ) number

expression 1 =
  Multiply : number Operator : ( "*" | "/" ) number

group =
  "(" expression ")"

number =
  _ ( Number : digit+ ) _

digit =
  '0'..'9'

_ =
  [ { ' ', #9..#13 } ]
```

### String with Escapes

```gee
string =
  _ '"' Text : [ '""' as '"' | {?} &! '"' ]* '"' _
```

### Nested Comments

```gee
comment =
  '/*' [ comment | {?} &! '*/' ]* '*/'
```

## Best Practices

1. Use meaningful names for rules (PascalCase for declarations, camelCase for definitions)
2. Group related rules together
3. Don't worry about superfluous rules, Gee will optimize them away
4. Use precedence and associativity for operator expressions
5. Use declarations only when you need nodes in the AST
6. Use helper definitions for common patterns
7. Document complex rules with comments

## Common Patterns

1. **Optional Elements**:
   ```gee
   [ "optional" ]
   ```

2. **Lists**:
   ```gee
   Item*           // Zero or more items
   Item+           // One or more items
   Item^","        // Comma-separated list
   ```

3. **Delimited Content**:
   ```gee
   "(" Content ")"
   "{" Content "}"
   ```

4. **Keywords**:
   ```gee
   "if" Condition "then" Statement [ "else" Statement ]
   ```

5. **Lookahead/Lookbehind**:
   ```gee
   Identifier &! Keyword  // Identifier that's not a keyword
   ``` 
