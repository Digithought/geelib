Optimizations:

        Note: Optimizations assume and optimize for single root; If another root is desired, must optimize from original definitions.
      
  Push-up:
    -Leading definition sequences are pushed up to their referencers when there 
      is no declaration involved and the node isn't root
    -Self recursives are not pushed up
    -Two optimization passes are necessary to push up recursive references
    -Example:
      a := b c 
      b := x y
      c := xx Yy : yy
      Becomes:
      a := (x y) (xx c)
      c := Yy : yy
      
  Group flattening:
    -Groups immediately appearing in sequences are removed (transitively)
    -Example:
      a := (b c (d e))
      Becomes:
      a := b c d e
      
  Common OR condition extraction:
    -Leading sequences which are common across OR conditions are pulled in front of the OR
    -Example:
      a ::= (b c) | (b d)
      Becomes:
      a ::= b c | d
