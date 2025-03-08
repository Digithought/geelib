* Change repeat syntax from + to <>
* Move all grammar validation into the optimization layer (out of runtime parser)
  * Better grammar errors (position, and DRY code)
* Make generator, but don't use dynamic eval.  Compose via functions.
* Better document how AST results are generated (capture.ts)
* Move caching to all expressions
* Split out null check from isNode, isList, and isText for performance (check only when grammar validation won't affect)
* Track what rule got the furthest for better errors 
