import { item } from "./ast.js";

export const geeAst = item({ Unit: item({
	Name: item('Gee'),
	Comparer: item('sensitive'),
	Whitespace: item('_'),
	Definitions: item([
		item({
			Name: item('Unit'),
			Type: item(':='),
			Sequence: item([
				item({ Optional: item({ Sequence: item([
						item({ Quote: item({ Text: item('grammar') }) }),
						item({ Declaration: item({
							Name: item('Name'),
							Expression: item({ Reference: item({ Name: item('identifier') }) })
						}) }),
						item({ Optional: item({ Sequence: item([
							item({ Quote: item({ Text: item('root') }) }),
							item({ Quote: item({ Text: item(':') }) }),
							item({ Declaration: item({
								Name: item('Root'),
								Expression: item({ Reference: item({ Name: item('identifier') }) })
							}) })
						]) }) }),
						item({ Optional: item({ Sequence: item([
							item({ Quote: item({ Text: item('comparer') }) }),
							item({ Quote: item({ Text: item(':') }) }),
							item({ Declaration: item({
								Name: item('Comparer'),
								Expression: item({ Or: item({
									Expressions: item([
										item({ Quote: item({ Text: item('sensitive') }) }),
										item({ Quote: item({ Text: item('insensitive') }) })
									])
								}) })
							}) })
						]) }) }),
						item({ Optional: item({ Sequence: item([
							item({ Quote: item({ Text: item('whitespace') }) }),
							item({ Quote: item({ Text: item(':') }) }),
							item({ Declaration: item({
								Name: item('Whitespace'),
								Expression: item({ Reference: item({ Name: item('identifier') }) })
							}) })
						]) }) })
					]) })
				}),
				item({ Declaration: item({
					Name: item('Definitions'),
					Expression: item({ Repeat: item({
						Expression: item({ Optional: item({
							Sequence: item([
								item({ Reference: item({ Name: item('Definition') }) })
							])
						}) })
					}) })
				}) })
			])
		}),
		item({
			Name: item('Definition'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Name'),
							Expression: item({ Reference: item({ Name: item('identifier') }) })
						}) }),
						item({ Optional: item({
							Sequence: item([
								item({ Declaration: item({
									Name: item('Precedence'),
									Expression: item({ Reference: item({ Name: item('integer') }) })
								}) })
							])
						}) }),
						item({ Optional: item({
							Sequence: item([
								item({ Declaration: item({
									Name: item('Associativity'),
									Expression: item({ CharSet: item({
										Entries: item([
											item({ Quote: item({ Text: item('L') }) }),
											item({ Quote: item({ Text: item('R') }) })
										])
									}) })
								}) })
							])
						}) }),
						item({ Declaration: item({
							Name: item('Type'),
							Expression: item({ Or: item({
								Expressions: item([
									item({ Quote: item({ Text: item('=') }) }),
									item({ Quote: item({ Text: item(':=') }) })
								])
							}) })
						}) }),
						item({ Reference: item({ Name: item('Sequence') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('Sequence'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Repeat: item({
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('expression'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Or: item({
							Expressions: item([
								item({ Reference: item({ Name: item('Range') }) }),
								item({ Reference: item({ Name: item('Char') }) }),
								item({ Reference: item({ Name: item('String') }) }),
								item({ Reference: item({ Name: item('Quote') }) }),
								item({ Reference: item({ Name: item('CharSet') }) }),
								item({ Reference: item({ Name: item('Reference') }) }),
								item({ Reference: item({ Name: item('Group') }) }),
								item({ Reference: item({ Name: item('Optional') }) })
							])
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('expression'),
			Type: item('='),
			Precedence: item('0'),
			Associativity: item('R'),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('Declaration') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('expression'),
			Type: item('='),
			Precedence: item('0'),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('Or') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('expression'),
			Type: item('='),
			Precedence: item('1'),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Or: item({
							Expressions: item([
								item({ Reference: item({ Name: item('Repeat') }) }),
								item({ Reference: item({ Name: item('As') }) }),
								item({ Reference: item({ Name: item('AndNot') }) }),
								item({ Reference: item({ Name: item('Separated') }) }),
								item({ Reference: item({ Name: item('Capture') }) })
							])
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Declaration'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Name'),
							Expression: item({ Reference: item({ Name: item('identifier') }) })
						}) }),
						item({ Quote: item({ Text: item(':') }) }),
						item({ Declaration: item({
							Name: item('Expression'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Or'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Expressions'),
							Expression: item({ Separated: item({
								Expression: item({ Reference: item({ Name: item('expression') }) }),
								Separator: item({ Quote: item({ Text: item('|') }) })
							}) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Repeat'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Expression'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) }),
						item({ Quote: item({ Text: item('*') }) }),
						item({ Optional: item({
							Sequence: item([
								item({ Or: item({
									Expressions: item([
										item({ Declaration: item({
											Name: item('Count'),
											Expression: item({ Reference: item({ Name: item('integer') }) })
										}) }),
										item({ Group: item({
											Sequence: item([
												item({ Declaration: item({
													Name: item('From'),
													Expression: item({ Reference: item({ Name: item('integer') }) })
												}) }),
												item({ Quote: item({ Text: item('..') }) }),
												item({ Declaration: item({
													Name: item('To'),
													Expression: item({ Or: item({
														Expressions: item([
															item({ Reference: item({ Name: item('integer') }) }),
															item({ Quote: item({ Text: item('n') }) })
														])
													}) })
												}) })
											])
										}) })
									])
								}) })
							])
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Separated'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Expression'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) }),
						item({ Quote: item({ Text: item('^') }) }),
						item({ Declaration: item({
							Name: item('Separator'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Capture'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Expression'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) }),
						item({ Quote: item({ Text: item('+') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('AndNot'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Expression'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) }),
						item({ Quote: item({ Text: item('&!') }) }),
						item({ Declaration: item({
							Name: item('Not'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('As'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('Expression'),
							Expression: item({ Reference: item({ Name: item('expression') }) })
						}) }),
						item({ Quote: item({ Text: item('as') }) }),
						item({ Declaration: item({
							Name: item('Value'),
							Expression: item({ Reference: item({ Name: item('String') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Group'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Quote: item({ Text: item('(') }) }),
						item({ Reference: item({ Name: item('Sequence') }) }),
						item({ Quote: item({ Text: item(')') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('Optional'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Quote: item({ Text: item('[') }) }),
						item({ Reference: item({ Name: item('Sequence') }) }),
						item({ Quote: item({ Text: item(']') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('Reference'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Optional: item({
							Sequence: item([
								item({ Declaration: item({
									Name: item('GrammarName'),
									Expression: item({ Reference: item({ Name: item('identifier') }) })
								}) }),
								item({ Quote: item({ Text: item('.') }) })
							])
						}) }),
						item({ Declaration: item({
							Name: item('Name'),
							Expression: item({ Reference: item({ Name: item('identifier') }) })
						}) }),
						item({ AndNot: item({
							Expression: item({ Reference: item({ Name: item('identifier') }) }),
							Not: item({ Or: item({
								Expressions: item([
									item({ Reference: item({ Name: item('Definition') }) }),
									item({ Reference: item({ Name: item('Declaration') }) })
								])
							}) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Quote'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('_') }) }),
						item({ String: item({ Text: item('"') }) }),
						item({ Declaration: item({
							Name: item('Text'),
							Expression: item({ Repeat: item({
								Expression: item({ Or: item({
									Expressions: item([
										item({ As: item({
											Expression: item({ String: item({ Text: item('""') }) }),
											Value: item({ String: item({ Text: item('"') }) })
										}) }),
										item({ AndNot: item({
											Expression: item({ CharSet: item({ All: item('true') }) }),
											Not: item({ String: item({ Text: item('"') }) })
										}) })
									])
								}) })
							}) })
						}) }),
						item({ String: item({ Text: item('"') }) }),
						item({ Reference: item({ Name: item('_') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('String'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('_') }) }),
						item({ String: item({ Text: item('\'') }) }),
						item({ Declaration: item({
							Name: item('Text'),
							Expression: item({ Repeat: item({
								Expression: item({ Or: item({
									Expressions: item([
										item({ As: item({
											Expression: item({ String: item({ Text: item('\'\'') }) }),
											Value: item({ String: item({ Text: item('\'') }) })
										}) }),
										item({ AndNot: item({
											Expression: item({ CharSet: item({ All: item('true') }) }),
											Not: item({ String: item({ Text: item('\'') }) })
										}) })
									])
								}) })
							}) })
						}) }),
						item({ String: item({ Text: item('\'') }) }),
						item({ Reference: item({ Name: item('_') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('Range'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Declaration: item({
							Name: item('From'),
							Expression: item({ Reference: item({ Name: item('Char') }) })
						}) }),
						item({ Quote: item({ Text: item('..') }) }),
						item({ Declaration: item({
							Name: item('To'),
							Expression: item({ Reference: item({ Name: item('Char') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('Char'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('_') }) }),
						item({ Or: item({
							Expressions: item([
								item({ Group: item({
									Sequence: item([
										item({ String: item({ Text: item('#') }) }),
										item({ Declaration: item({
											Name: item('Index'),
											Expression: item({ Repeat: item({
												Expression: item({ Reference: item({ Name: item('digit') }) })
											}) })
										}) })
									])
								}) }),
								item({ Group: item({
									Sequence: item([
										item({ String: item({ Text: item('\'') }) }),
										item({ Declaration: item({
											Name: item('Literal'),
											Expression: item({ Or: item({
												Expressions: item([
													item({ As: item({
														Expression: item({ String: item({ Text: item('\'\'') }) }),
														Value: item({ String: item({ Text: item('\'') }) })
													}) }),
													item({ CharSet: item({ All: item('true') }) })
												])
											}) })
										}) }),
										item({ String: item({ Text: item('\'') }) }),
										item({ AndNot: item({
											Expression: item({ Reference: item({ Name: item('identifier') }) }),
											Not: item({ String: item({ Text: item('\'\'') }) })
										}) })
									])
								}) })
							])
						}) }),
						item({ Reference: item({ Name: item('_') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('CharSet'),
			Type: item(':='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Quote: item({ Text: item('{') }) }),
						item({ Optional: item({
							Sequence: item([
								item({ Declaration: item({
									Name: item('Not'),
									Expression: item({ Quote: item({ Text: item('!') }) })
								}) })
							])
						}) }),
						item({ Or: item({
							Expressions: item([
								item({ Declaration: item({
									Name: item('All'),
									Expression: item({ Quote: item({ Text: item('?') }) })
								}) }),
								item({ Declaration: item({
									Name: item('Entries'),
									Expression: item({ Separated: item({
										Expression: item({ Or: item({
											Expressions: item([
												item({ Reference: item({ Name: item('Range') }) }),
												item({ Reference: item({ Name: item('Char') }) })
											])
										}) }),
										Separator: item({ Quote: item({ Text: item(',') }) })
									}) })
								}) })
							])
						}) }),
						item({ Quote: item({ Text: item('}') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('identifier'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('_') }) }),
						item({ Capture: item({
							Expression: item({ Repeat: item({
								Expression: item({ Or: item({
									Expressions: item([
										item({ Reference: item({ Name: item('letter') }) }),
										item({ Group: item({
											Sequence: item([
												item({ String: item({ Text: item('_') }) }),
												item({ Optional: item({
													Sequence: item([
														item({ Repeat: item({
															Expression: item({ Or: item({
																Expressions: item([
																	item({ Reference: item({ Name: item('letter') }) }),
																	item({ Reference: item({ Name: item('digit') }) }),
																	item({ String: item({ Text: item('_') }) })
																])
															}) })
														}) })
													])
												}) })
											])
										}) })
									])
								}) })
							}) })
						}) }),
						item({ Reference: item({ Name: item('_') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('integer'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Reference: item({ Name: item('_') }) }),
						item({ Capture: item({
							Expression: item({ Repeat: item({
								Expression: item({ Reference: item({ Name: item('digit') }) })
							}) })
						}) }),
						item({ Reference: item({ Name: item('_') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('letter'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ CharSet: item({
							Entries: item([
								item({ Range: item({
									From: item({ String: item({ Text: item('a') }) }),
									To: item({ String: item({ Text: item('z') }) })
								}) }),
								item({ Range: item({
									From: item({ String: item({ Text: item('A') }) }),
									To: item({ String: item({ Text: item('Z') }) })
								}) })
							])
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('digit'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Range: item({
							From: item({ String: item({ Text: item('0') }) }),
							To: item({ String: item({ Text: item('9') }) })
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('_'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ Optional: item({
							Sequence: item([
								item({ Repeat: item({
									Expression: item({ Or: item({
										Expressions: item([
											item({ CharSet: item({
												Entries: item([
													item({ String: item({ Text: item(' ') }) }),
													item({ Range: item({
														From: item({ Char: item({ Index: item('9') }) }),
														To: item({ Char: item({ Index: item('13') }) })
													}) })
												])
											}) }),
											item({ Reference: item({ Name: item('lineComment') }) }),
											item({ Reference: item({ Name: item('blockComment') }) })
										])
									}) })
								}) })
							])
						}) })
					])
				}) })
			])
		}),
		item({
			Name: item('blockComment'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ String: item({ Text: item('/*') }) }),
						item({ Repeat: item({
							Expression: item({ Or: item({
								Expressions: item([
									item({ Reference: item({ Name: item('blockComment') }) }),
									item({ AndNot: item({
										Expression: item({ CharSet: item({ All: item('true') }) }),
										Not: item({ String: item({ Text: item('*/') }) })
									}) })
								])
							}) })
						}) }),
						item({ String: item({ Text: item('*/') }) })
					])
				}) })
			])
		}),
		item({
			Name: item('lineComment'),
			Type: item('='),
			Sequence: item([
				item({ Sequence: item({
					Sequence: item([
						item({ String: item({ Text: item('//') }) }),
						item({ Repeat: item({
							Expression: item({ CharSet: item({
								Not: item('true'),
								Entries: item([
									item({ Char: item({ Index: item('10') }) }),
									item({ Char: item({ Index: item('13') }) })
								])
							}) })
						}) })
					])
				}) })
			])
		})
	])
})});
