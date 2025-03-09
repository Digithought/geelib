# Recursion in Gee Grammar

This document describes the conceptual architecture for handling recursion in Gee grammars.

## Types of Recursion

Gee grammar supports several types of recursion in definitions:

1. **Left Recursion**: When a definition references itself at the beginning of its sequence.
   ```
   Expression := Expression "+" Term
   ```

2. **Right Recursion**: When a definition references itself at the end of its sequence.
   ```
   Expression := Term "+" Expression
   ```

3. **Full Recursion**: When a definition is recursive on both ends.
   ```
   Expression := Expression "+" Expression
   ```

4. **No Recursion**: When a definition does not reference itself directly or indirectly.
   ```
   Term := Number | Variable
   ```

## Exclusivity in Recursion Detection

When determining recursion in a sequence, we need to consider that the edgemost items (first or last) might be optional or part of alternative paths. This introduces the concept of **exclusivity**:

1. **Exclusive Recursion**: A recursive reference that is guaranteed to be part of the recursion path.
   - For example, in `Expression := Expression "+" Term`, the reference to `Expression` is exclusive because it must be processed.

2. **Non-Exclusive Recursion**: A recursive reference that might be bypassed.
   - For example, in `Expression := [Expression] "+" Term` (where `[]` indicates optional), the reference to `Expression` is non-exclusive because it might be skipped.

The system must track exclusivity to correctly determine recursion types:
- If a left-edge item is optional, we need to continue checking subsequent items for left recursion
- If a right-edge item is optional, we need to continue checking preceding items for right recursion
- Only when we find an exclusive recursive reference can we stop checking in that direction

## Precedence and Recursion

In Gee grammar, precedence and recursion are closely related:

1. **Recursive definitions must have explicit precedence**:
   - This is required to resolve ambiguities in parsing.
   - The precedence value determines which definition takes priority when multiple definitions could match.

2. **Non-recursive definitions should not have explicit precedence**:
   - Since there's no ambiguity to resolve, precedence is unnecessary.
   - Using precedence for non-recursive definitions can lead to confusion.

## Associativity

For recursive definitions, associativity determines how expressions are grouped:

1. **Left Associativity (L)**: Operations are grouped from left to right. This is the default, if not specified.
   ```
   a + b + c  →  (a + b) + c
   ```

2. **Right Associativity (R)**: Operations are grouped from right to left.
   ```
   a + b + c  →  a + (b + c)
   ```

## Detection and Validation

The system detects recursion through these steps:

1. **Group Identification**: Definitions with the same name are grouped together, and can be referenced by their shared name.

2. **Reference Tracking**: For each definition, track which other definitions it references.

3. **Recursion Detection**: Determine if a definition directly or indirectly references itself.
   - Direct: The definition explicitly references its own name.
   - Indirect: The definition references another definition that eventually references back to it.

4. **Exclusivity Tracking**: For each recursive reference, determine if it's exclusive or can be bypassed.
   - Exclusive references immediately determine the recursion type
   - Non-exclusive references require checking additional items in the sequence

5. **Recursion Classification**: Based on where the recursion occurs and its exclusivity, classify it as left, right, or full.

6. **Validation**: Ensure that:
   - All recursive definitions have explicit precedence.
   - Non-recursive definitions do not have explicit precedence.

## Implementation Considerations

1. **Cycle Detection**: The implementation handle cycles in the reference graph without infinite loops.

2. **Precedence Inheritance**: When a definition references another with a different precedence, the system determines which precedence applies.

3. **Handling Optional Elements**: The implementation must correctly handle optional elements and alternatives when determining recursion.
   - Optional elements (like `[...]`) are non-exclusive and should not immediately determine recursion type
   - The system must continue checking beyond optional elements until finding an exclusive recursive reference or exhausting the sequence

4. **Consistency**: The system ensures that all definitions in a recursive group have consistent precedence and associativity rules.

5. **Error Reporting**: When validation fails, error messages indicate the specific issue and how to fix it.

## Example

Consider this grammar fragment with optional elements:

```
expression =
  [expression "+"] term

term =
  factor ["*" term]
```

Here:
- `expression` has left recursion, but it's non-exclusive because the `[expression "+"]` part is optional
- `term` has right recursion, but it's non-exclusive because the `["*" term]` part is optional
- Both definitions should still have explicit precedence because they are recursive
