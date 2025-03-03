import { list, node, text } from "./ast.js";

export const geeAst = node('unit', {
	Name: text('Gee'),
	Comparer: text('sensitive'),
	Whitespace: text('_'),
	Definitions: list([
		node('definition', {
			Name: text('Unit'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('optional', {
							Sequence: list([
								node('quote', { Text: text('grammar') })
							])
						}),
						node('declaration', {
							Name: text('Name'),
							Expression: node('reference', { Name: text('identifier') })
						}),
						node('optional', {
							Sequence: list([
								node('quote', { Text: text('comparer') }),
								node('quote', { Text: text(':') }),
								node('declaration', {
									Name: text('Comparer'),
									Expression: node('or', {
										Expressions: list([
											node('quote', { Text: text('sensitive') }),
											node('quote', { Text: text('insensitive') })
										])
									})
								})
							])
						}),
						node('optional', {
							Sequence: list([
								node('quote', { Text: text('whitespace') }),
								node('quote', { Text: text(':') }),
								node('declaration', {
									Name: text('Whitespace'),
									Expression: node('reference', { Name: text('identifier') })
								})
							])
						})
					])
				}),
				node('declaration', {
					Name: text('Definitions'),
					Expression: node('repeat', {
						Expression: node('optional', {
							Sequence: list([
								node('reference', { Name: text('Definition') })
							])
						})
					})
				})
			])
		}),
		node('definition', {
			Name: text('Definition'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Name'),
							Expression: node('reference', { Name: text('identifier') })
						}),
						node('optional', {
							Sequence: list([
								node('declaration', {
									Name: text('Precedence'),
									Expression: node('reference', { Name: text('integer') })
								})
							])
						}),
						node('optional', {
							Sequence: list([
								node('declaration', {
									Name: text('Associativity'),
									Expression: node('charSet', {
										Entries: list([
											node('quote', { Text: text('L') }),
											node('quote', { Text: text('R') })
										])
									})
								})
							])
						}),
						node('declaration', {
							Name: text('Type'),
							Expression: node('or', {
								Expressions: list([
									node('quote', { Text: text('=') }),
									node('quote', { Text: text(':=') })
								])
							})
						}),
						node('reference', { Name: text('Sequence') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('Sequence'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('repeat', {
							Expression: node('reference', { Name: text('expression') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('expression'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('or', {
							Expressions: list([
								node('reference', { Name: text('Range') }),
								node('reference', { Name: text('Char') }),
								node('reference', { Name: text('String') }),
								node('reference', { Name: text('Quote') }),
								node('reference', { Name: text('CharSet') }),
								node('reference', { Name: text('Reference') }),
								node('reference', { Name: text('Group') }),
								node('reference', { Name: text('OptionalGroup') })
							])
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('expression'),
			Type: text('='),
			Precedence: text('0'),
			Associativity: text('R'),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('Declaration') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('expression'),
			Type: text('='),
			Precedence: text('0'),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('Or') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('expression'),
			Type: text('='),
			Precedence: text('1'),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('or', {
							Expressions: list([
								node('reference', { Name: text('Repeat') }),
								node('reference', { Name: text('As') }),
								node('reference', { Name: text('AndNot') }),
								node('reference', { Name: text('SeparatedRepeat') }),
								node('reference', { Name: text('Capture') })
							])
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Declaration'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Name'),
							Expression: node('reference', { Name: text('identifier') })
						}),
						node('quote', { Text: text(':') }),
						node('declaration', {
							Name: text('Expression'),
							Expression: node('reference', { Name: text('expression') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Or'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Expressions'),
							Expression: node('separated', {
								Expression: node('reference', { Name: text('expression') }),
								Separator: node('quote', { Text: text('|') })
							})
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Repeat'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Expression'),
							Expression: node('reference', { Name: text('expression') })
						}),
						node('quote', { Text: text('*') }),
						node('optional', {
							Sequence: list([
								node('or', {
									Expressions: list([
										node('declaration', {
											Name: text('Count'),
											Expression: node('reference', { Name: text('integer') })
										}),
										node('group', {
											Sequence: list([
												node('declaration', {
													Name: text('From'),
													Expression: node('reference', { Name: text('integer') })
												}),
												node('quote', { Text: text('..') }),
												node('declaration', {
													Name: text('To'),
													Expression: node('or', {
														Expressions: list([
															node('reference', { Name: text('integer') }),
															node('quote', { Text: text('n') })
														])
													})
												})
											])
										})
									])
								})
							])
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('SeparatedRepeat'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Expression'),
							Expression: node('reference', { Name: text('expression') })
						}),
						node('quote', { Text: text('^') }),
						node('declaration', {
							Name: text('Separator'),
							Expression: node('reference', { Name: text('expression') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Capture'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Expression'),
							Expression: node('reference', { Name: text('expression') })
						}),
						node('quote', { Text: text('+') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('AndNot'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Expression'),
							Expression: node('reference', { Name: text('expression') })
						}),
						node('quote', { Text: text('&!') }),
						node('declaration', {
							Name: text('NotExpression'),
							Expression: node('reference', { Name: text('expression') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('As'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('Expression'),
							Expression: node('reference', { Name: text('expression') })
						}),
						node('quote', { Text: text('as') }),
						node('declaration', {
							Name: text('Value'),
							Expression: node('reference', { Name: text('String') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Group'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('quote', { Text: text('(') }),
						node('reference', { Name: text('Sequence') }),
						node('quote', { Text: text(')') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('OptionalGroup'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('quote', { Text: text('[') }),
						node('reference', { Name: text('Sequence') }),
						node('quote', { Text: text(']') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('Reference'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('optional', {
							Sequence: list([
								node('declaration', {
									Name: text('GrammarName'),
									Expression: node('reference', { Name: text('identifier') })
								}),
								node('quote', { Text: text('.') })
							])
						}),
						node('declaration', {
							Name: text('Name'),
							Expression: node('reference', { Name: text('identifier') })
						}),
						node('andNot', {
							Expression: node('reference', { Name: text('identifier') }),
							NotExpression: node('or', {
								Expressions: list([
									node('reference', { Name: text('Definition') }),
									node('reference', { Name: text('Declaration') })
								])
							})
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Quote'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('_') }),
						node('string', { Text: text('"') }),
						node('declaration', {
							Name: text('Text'),
							Expression: node('repeat', {
								Expression: node('or', {
									Expressions: list([
										node('as', {
											Expression: node('string', { Text: text('""') }),
											Value: node('string', { Text: text('"') })
										}),
										node('andNot', {
											Expression: node('charSet', { All: text('true') }),
											NotExpression: node('string', { Text: text('"') })
										})
									])
								})
							})
						}),
						node('string', { Text: text('"') }),
						node('reference', { Name: text('_') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('String'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('_') }),
						node('string', { Text: text('\'') }),
						node('declaration', {
							Name: text('Text'),
							Expression: node('repeat', {
								Expression: node('or', {
									Expressions: list([
										node('as', {
											Expression: node('string', { Text: text('\'\'') }),
											Value: node('string', { Text: text('\'') })
										}),
										node('andNot', {
											Expression: node('charSet', { All: text('true') }),
											NotExpression: node('string', { Text: text('\'') })
										})
									])
								})
							})
						}),
						node('string', { Text: text('\'') }),
						node('reference', { Name: text('_') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('Range'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('declaration', {
							Name: text('From'),
							Expression: node('reference', { Name: text('Char') })
						}),
						node('quote', { Text: text('..') }),
						node('declaration', {
							Name: text('To'),
							Expression: node('reference', { Name: text('Char') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('Char'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('_') }),
						node('or', {
							Expressions: list([
								node('group', {
									Sequence: list([
										node('string', { Text: text('#') }),
										node('declaration', {
											Name: text('Index'),
											Expression: node('repeat', {
												Expression: node('reference', { Name: text('digit') })
											})
										})
									])
								}),
								node('group', {
									Sequence: list([
										node('string', { Text: text('\'') }),
										node('declaration', {
											Name: text('Literal'),
											Expression: node('or', {
												Expressions: list([
													node('as', {
														Expression: node('string', { Text: text('\'\'') }),
														Value: node('string', { Text: text('\'') })
													}),
													node('charSet', { All: text('true') })
												])
											})
										}),
										node('string', { Text: text('\'') }),
										node('andNot', {
											Expression: node('reference', { Name: text('identifier') }),
											NotExpression: node('string', { Text: text('\'\'') })
										})
									])
								})
							])
						}),
						node('reference', { Name: text('_') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('CharSet'),
			Type: text(':='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('quote', { Text: text('{') }),
						node('optional', {
							Sequence: list([
								node('declaration', {
									Name: text('Not'),
									Expression: node('quote', { Text: text('!') })
								})
							])
						}),
						node('or', {
							Expressions: list([
								node('declaration', {
									Name: text('All'),
									Expression: node('quote', { Text: text('?') })
								}),
								node('declaration', {
									Name: text('Entries'),
									Expression: node('separated', {
										Expression: node('or', {
											Expressions: list([
												node('reference', { Name: text('Range') }),
												node('reference', { Name: text('Char') })
											])
										}),
										Separator: node('quote', { Text: text(',') })
									})
								})
							])
						}),
						node('quote', { Text: text('}') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('identifier'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('_') }),
						node('capture', {
							Expression: node('repeat', {
								Expression: node('or', {
									Expressions: list([
										node('reference', { Name: text('letter') }),
										node('group', {
											Sequence: list([
												node('string', { Text: text('_') }),
												node('optional', {
													Sequence: list([
														node('repeat', {
															Expression: node('or', {
																Expressions: list([
																	node('reference', { Name: text('letter') }),
																	node('reference', { Name: text('digit') }),
																	node('string', { Text: text('_') })
																])
															})
														})
													])
												})
											])
										})
									])
								})
							})
						}),
						node('reference', { Name: text('_') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('integer'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('reference', { Name: text('_') }),
						node('capture', {
							Expression: node('repeat', {
								Expression: node('reference', { Name: text('digit') })
							})
						}),
						node('reference', { Name: text('_') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('letter'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('charSet', {
							Entries: list([
								node('range', {
									From: node('string', { Text: text('a') }),
									To: node('string', { Text: text('z') })
								}),
								node('range', {
									From: node('string', { Text: text('A') }),
									To: node('string', { Text: text('Z') })
								})
							])
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('digit'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('range', {
							From: node('string', { Text: text('0') }),
							To: node('string', { Text: text('9') })
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('_'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('optional', {
							Sequence: list([
								node('repeat', {
									Expression: node('or', {
										Expressions: list([
											node('charSet', {
												Entries: list([
													node('string', { Text: text(' ') }),
													node('range', {
														From: node('char', { Index: text('9') }),
														To: node('char', { Index: text('13') })
													})
												])
											}),
											node('reference', { Name: text('lineComment') }),
											node('reference', { Name: text('blockComment') })
										])
									})
								})
							])
						})
					])
				})
			])
		}),
		node('definition', {
			Name: text('blockComment'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('string', { Text: text('/*') }),
						node('repeat', {
							Expression: node('or', {
								Expressions: list([
									node('reference', { Name: text('blockComment') }),
									node('andNot', {
										Expression: node('charSet', { All: text('true') }),
										NotExpression: node('string', { Text: text('*/') })
									})
								])
							})
						}),
						node('string', { Text: text('*/') })
					])
				})
			])
		}),
		node('definition', {
			Name: text('lineComment'),
			Type: text('='),
			Sequence: list([
				node('sequence', {
					Sequence: list([
						node('string', { Text: text('//') }),
						node('repeat', {
							Expression: node('charSet', {
								Not: text('true'),
								Entries: list([
									node('char', { Index: text('10') }),
									node('char', { Index: text('13') })
								])
							})
						})
					])
				})
			])
		})
	])
});
