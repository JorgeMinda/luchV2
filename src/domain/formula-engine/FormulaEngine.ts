/**
 * Formula Engine - Safe AST/DSL evaluator (no eval).
 * Soporta fórmulas Excel-like básicas: suma, resta, multiplicación, división, paréntesis,
 * referencias a celdas (A1, B2, etc.), y funciones básicas (SUM, AVERAGE, MIN, MAX, IF).
 * Versionado, auditable, y sin eval().
 */

// ============================================================
// TIPOS DEL AST (Discriminated Unions)
// ============================================================

export type FormulaNode =
  | NumberNode
  | CellRefNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | ParenthesisNode

export interface NumberNode {
  type: 'Number'
  value: number
  loc?: { start: number; end: number }
}

export interface CellRefNode {
  type: 'CellRef'
  sheet?: string
  col: number // 0-indexed (A=0, B=1, ...)
  row: number // 0-indexed
  absoluteCol: boolean
  absoluteRow: boolean
  loc?: { start: number; end: number }
}

export interface BinaryOpNode {
  type: 'BinaryOp'
  operator: '+' | '-' | '*' | '/' | '^' | '&'
  left: FormulaNode
  right: FormulaNode
  loc?: { start: number; end: number }
}

export interface UnaryOpNode {
  type: 'UnaryOp'
  operator: '+' | '-'
  operand: FormulaNode
  loc?: { start: number; end: number }
}

export interface FunctionCallNode {
  type: 'FunctionCall'
  name: string
  args: FormulaNode[]
  loc?: { start: number; end: number }
}

export interface ParenthesisNode {
  type: 'Parenthesis'
  expression: FormulaNode
  loc?: { start: number; end: number }
}

// ============================================================
// TOKENIZER
// ============================================================

export type TokenType =
  | 'NUMBER'
  | 'CELL_REF'
  | 'STRING'
  | 'IDENTIFIER'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'POWER'
  | 'CONCAT'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'SEMICOLON'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  start: number
  end: number
}

const CELL_REF_REGEX = /^(\$?[A-Z]+)(\$?\d+)$/i
const NUMBER_REGEX = /^\d+(\.\d+)?/

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const char = input[i]

    // Whitespace
    if (/\s/.test(char)) {
      i++
      continue
    }

    // Numbers
    const numMatch = input.slice(i).match(NUMBER_REGEX)
    if (numMatch) {
      tokens.push({
        type: 'NUMBER',
        value: numMatch[0],
        start: i,
        end: i + numMatch[0].length,
      })
      i += numMatch[0].length
      continue
    }

    // Cell references (e.g., A1, $A$1, Sheet1!A1)
    const cellMatch = input.slice(i).match(/^([A-Za-z]+!?)?\$?[A-Za-z]+\$?\d+/)
    if (cellMatch) {
      tokens.push({
        type: 'CELL_REF',
        value: cellMatch[0],
        start: i,
        end: i + cellMatch[0].length,
      })
      i += cellMatch[0].length
      continue
    }

    // Strings (double-quoted)
    if (char === '"') {
      let j = i + 1
      let value = ''
      while (j < input.length && input[j] !== '"') {
        if (input[j] === '\\' && j + 1 < input.length) {
          value += input[j + 1]
          j += 2
        } else {
          value += input[j]
          j++
        }
      }
      tokens.push({
        type: 'STRING',
        value,
        start: i,
        end: j + 1,
      })
      i = j + 1
      continue
    }

    // Identifiers (function names)
    if (/[A-Za-z_]/.test(char)) {
      let j = i
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) {
        j++
      }
      tokens.push({
        type: 'IDENTIFIER',
        value: input.slice(i, j).toUpperCase(),
        start: i,
        end: j,
      })
      i = j
      continue
    }

    // Operators and punctuation
    switch (char) {
      case '+':
        tokens.push({ type: 'PLUS', value: '+', start: i, end: i + 1 })
        i++
        break
      case '-':
        tokens.push({ type: 'MINUS', value: '-', start: i, end: i + 1 })
        i++
        break
      case '*':
        tokens.push({ type: 'MULTIPLY', value: '*', start: i, end: i + 1 })
        i++
        break
      case '/':
        tokens.push({ type: 'DIVIDE', value: '/', start: i, end: i + 1 })
        i++
        break
      case '^':
        tokens.push({ type: 'POWER', value: '^', start: i, end: i + 1 })
        i++
        break
      case '&':
        tokens.push({ type: 'CONCAT', value: '&', start: i, end: i + 1 })
        i++
        break
      case '(':
        tokens.push({ type: 'LPAREN', value: '(', start: i, end: i + 1 })
        i++
        break
      case ')':
        tokens.push({ type: 'RPAREN', value: ')', start: i, end: i + 1 })
        i++
        break
      case ',':
      case ';':
        tokens.push({ type: 'COMMA', value: char, start: i, end: i + 1 })
        i++
        break
      case ':':
        tokens.push({ type: 'COLON', value: ':', start: i, end: i + 1 })
        i++
        break
      default:
        throw new Error(`Carácter inesperado en fórmula: '${char}' en posición ${i}`)
    }
  }

  tokens.push({ type: 'EOF', value: '', start: i, end: i })
  return tokens
}

// ============================================================
// PARSER (Recursive Descent)
// ============================================================

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private current(): Token {
    return this.tokens[this.pos]
  }

  private advance(): Token {
    return this.tokens[this.pos++]
  }

  private expect(type: TokenType): Token {
    const token = this.current()
    if (token.type !== type) {
      throw new Error(`Se esperaba ${type}, se encontró ${token.type} en posición ${token.start}`)
    }
    return this.advance()
  }

  parse(): FormulaNode {
    const node = this.parseExpression()
    this.expect('EOF')
    return node
  }

  // Expression -> ConcatExpression
  private parseExpression(): FormulaNode {
    return this.parseConcat()
  }

  // ConcatExpression -> AddSubExpression ('&' AddSubExpression)*
  private parseConcat(): FormulaNode {
    let left = this.parseAddSub()
    while (this.current().type === 'CONCAT') {
      this.advance()
      const right = this.parseAddSub()
      left = {
        type: 'BinaryOp',
        operator: '&',
        left,
        right,
        loc: { start: left.loc?.start ?? 0, end: right.loc?.end ?? 0 },
      }
    }
    return left
  }

  // AddSubExpression -> MulDivExpression (('+' | '-') MulDivExpression)*
  private parseAddSub(): FormulaNode {
    let left = this.parseMulDiv()
    while (this.current().type === 'PLUS' || this.current().type === 'MINUS') {
      const op = this.advance()
      const right = this.parseMulDiv()
      left = {
        type: 'BinaryOp',
        operator: op.type === 'PLUS' ? '+' : '-',
        left,
        right,
        loc: { start: left.loc?.start ?? 0, end: right.loc?.end ?? 0 },
      }
    }
    return left
  }

  // MulDivExpression -> PowerExpression (('*' | '/') PowerExpression)*
  private parseMulDiv(): FormulaNode {
    let left = this.parsePower()
    while (this.current().type === 'MULTIPLY' || this.current().type === 'DIVIDE') {
      const op = this.advance()
      const right = this.parsePower()
      left = {
        type: 'BinaryOp',
        operator: op.type === 'MULTIPLY' ? '*' : '/',
        left,
        right,
        loc: { start: left.loc?.start ?? 0, end: right.loc?.end ?? 0 },
      }
    }
    return left
  }

  // PowerExpression -> UnaryExpression ('^' PowerExpression)?
  private parsePower(): FormulaNode {
    let left = this.parseUnary()
    if (this.current().type === 'POWER') {
      this.advance()
      const right = this.parsePower()
      left = { type: 'BinaryOp', operator: '^', left, right, loc: { start: left.loc?.start ?? 0, end: right.loc?.end ?? 0 } }
    }
    return left
  }

  // UnaryExpression -> ('+' | '-') UnaryExpression | Primary
  private parseUnary(): FormulaNode {
    if (this.current().type === 'PLUS' || this.current().type === 'MINUS') {
      const op = this.advance()
      const operand = this.parseUnary()
      return {
        type: 'UnaryOp',
        operator: op.type === 'PLUS' ? '+' : '-',
        operand,
        loc: { start: op.start, end: operand.loc?.end ?? op.end },
      }
    }
    return this.parsePrimary()
  }

  // Primary -> Number | CellRef | FunctionCall | '(' Expression ')'
  private parsePrimary(): FormulaNode {
    const token = this.current()

    if (token.type === 'NUMBER') {
      this.advance()
      return { type: 'Number', value: parseFloat(token.value), loc: { start: token.start, end: token.end } }
    }

    if (token.type === 'CELL_REF') {
      this.advance()
      return this.parseCellRef(token.value, token.start, token.end)
    }

    if (token.type === 'IDENTIFIER') {
      return this.parseFunctionCall()
    }

    if (token.type === 'LPAREN') {
      this.advance()
      const expr = this.parseExpression()
      this.expect('RPAREN')
      return { type: 'Parenthesis', expression: expr, loc: { start: token.start, end: this.current().end } }
    }

    throw new Error(`Expresión inesperada: ${token.type} en posición ${token.start}`)
  }

  private parseCellRef(value: string, start: number, end: number): CellRefNode {
    // Handle sheet prefix (Sheet1!A1)
    let sheet: string | undefined
    let cellPart = value
    const sheetIdx = value.indexOf('!')
    if (sheetIdx !== -1) {
      sheet = value.slice(0, sheetIdx)
      cellPart = value.slice(sheetIdx + 1)
    }

    const match = cellPart.match(CELL_REF_REGEX)
    if (!match) {
      throw new Error(`Referencia de celda inválida: ${value}`)
    }

    const [, colPart, rowPart] = match
    const absoluteCol = colPart.startsWith('$')
    const absoluteRow = rowPart.startsWith('$')
    const col = this.colToIndex(colPart.replace('$', ''))
    const row = parseInt(rowPart.replace('$', ''), 10) - 1 // 0-indexed

    return {
      type: 'CellRef',
      sheet,
      col,
      row,
      absoluteCol,
      absoluteRow,
      loc: { start, end },
    }
  }

  private colToIndex(col: string): number {
    let index = 0
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
    }
    return index - 1
  }

  private parseFunctionCall(): FunctionCallNode {
    const nameToken = this.expect('IDENTIFIER')
    const name = nameToken.value
    this.expect('LPAREN')

    const args: FormulaNode[] = []
    if (this.current().type !== 'RPAREN') {
      args.push(this.parseExpression())
      while (this.current().type === 'COMMA') {
        this.advance()
        args.push(this.parseExpression())
      }
    }

    const rparen = this.expect('RPAREN')

    return {
      type: 'FunctionCall',
      name,
      args,
      loc: { start: nameToken.start, end: rparen.end },
    }
  }
}

// ============================================================
// EVALUATOR
// ============================================================

export interface EvaluationContext {
  getCellValue(sheet: string | undefined, col: number, row: number): number | string | null
  getRangeValues(sheet: string | undefined, startCol: number, startRow: number, endCol: number, endRow: number): (number | string | null)[][]
}

export interface EvaluationResult {
  value: number | string
  dependencies: Set<string> // Cell references used (e.g., "A1", "Sheet1!B2")
  warnings: string[]
}

const SUPPORTED_FUNCTIONS = new Set([
  'SUM',
  'AVERAGE',
  'MIN',
  'MAX',
  'COUNT',
  'COUNTA',
  'IF',
  'ABS',
  'ROUND',
  'ROUNDUP',
  'ROUNDDOWN',
  'SQRT',
  'POWER',
  'MOD',
])

function evaluateNode(node: FormulaNode, context: EvaluationContext): EvaluationResult {
  const warnings: string[] = []
  const dependencies = new Set<string>()

  switch (node.type) {
    case 'Number':
      return { value: node.value, dependencies, warnings }

    case 'CellRef': {
      const sheetName = node.sheet ?? ''
      const ref = `${sheetName}${sheetName ? '!' : ''}${colToLetter(node.col)}${node.row + 1}`
      dependencies.add(ref)

      const value = context.getCellValue(node.sheet, node.col, node.row)
      if (value === null) {
        warnings.push(`Celda vacía: ${ref}`)
        return { value: 0, dependencies, warnings }
      }
      if (typeof value === 'string') {
        const num = parseFloat(value)
        if (isNaN(num)) {
          warnings.push(`Valor no numérico en ${ref}: ${value}`)
          return { value: 0, dependencies, warnings }
        }
        return { value: num, dependencies, warnings }
      }
      return { value, dependencies, warnings }
    }

    case 'BinaryOp': {
      const left = evaluateNode(node.left, context)
      const right = evaluateNode(node.right, context)
      left.dependencies.forEach((d) => dependencies.add(d))
      right.dependencies.forEach((d) => dependencies.add(d))
      left.warnings.forEach((w) => warnings.push(w))
      right.warnings.forEach((w) => warnings.push(w))

      const l = typeof left.value === 'number' ? left.value : parseFloat(String(left.value)) || 0
      const r = typeof right.value === 'number' ? right.value : parseFloat(String(right.value)) || 0

      let result: number | string
      switch (node.operator) {
        case '+':
          result = l + r
          break
        case '-':
          result = l - r
          break
        case '*':
          result = l * r
          break
        case '/':
          if (r === 0) {
            warnings.push('División por cero')
            result = 0
          } else {
            result = l / r
          }
          break
        case '^':
          result = Math.pow(l, r)
          break
        case '&':
          result = String(left.value) + String(right.value)
          break
        default: {
          const _exhaustive: never = node
          throw new Error(`Operador binario no soportado: ${_exhaustive}`)
        }
      }
      return { value: result, dependencies, warnings }
    }

    case 'UnaryOp': {
      const operand = evaluateNode(node.operand, context)
      operand.dependencies.forEach((d) => dependencies.add(d))
      operand.warnings.forEach((w) => warnings.push(w))

      const val = typeof operand.value === 'number' ? operand.value : parseFloat(String(operand.value)) || 0
      return {
        value: node.operator === '-' ? -val : val,
        dependencies,
        warnings,
      }
    }

    case 'FunctionCall': {
      if (!SUPPORTED_FUNCTIONS.has(node.name)) {
        warnings.push(`Función no soportada: ${node.name}`)
        return { value: 0, dependencies, warnings }
      }

      const argResults = node.args.map((arg) => evaluateNode(arg, context))
      argResults.forEach((ar) => {
        ar.dependencies.forEach((d) => dependencies.add(d))
        ar.warnings.forEach((w) => warnings.push(w))
      })

      const argValues = argResults.map((ar) =>
        typeof ar.value === 'number' ? ar.value : parseFloat(String(ar.value)) || 0,
      )

      let result: number
      switch (node.name) {
        case 'SUM':
          result = argValues.reduce((a, b) => a + b, 0)
          break
        case 'AVERAGE':
          result = argValues.length > 0 ? argValues.reduce((a, b) => a + b, 0) / argValues.length : 0
          break
        case 'MIN':
          result = argValues.length > 0 ? Math.min(...argValues) : 0
          break
        case 'MAX':
          result = argValues.length > 0 ? Math.max(...argValues) : 0
          break
        case 'COUNT':
          result = argValues.filter((v) => !isNaN(v)).length
          break
        case 'COUNTA':
          result = argValues.length
          break
        case 'IF':
          if (argValues.length >= 3) {
            result = argValues[0] !== 0 ? argValues[1] : argValues[2]
          } else {
            warnings.push('IF requiere 3 argumentos')
            result = 0
          }
          break
        case 'ABS':
          result = Math.abs(argValues[0] ?? 0)
          break
        case 'ROUND':
          result = Math.round((argValues[0] ?? 0) * Math.pow(10, argValues[1] ?? 0)) / Math.pow(10, argValues[1] ?? 0)
          break
        case 'ROUNDUP':
          result = Math.ceil((argValues[0] ?? 0) * Math.pow(10, argValues[1] ?? 0)) / Math.pow(10, argValues[1] ?? 0)
          break
        case 'ROUNDDOWN':
          result = Math.floor((argValues[0] ?? 0) * Math.pow(10, argValues[1] ?? 0)) / Math.pow(10, argValues[1] ?? 0)
          break
        case 'SQRT':
          result = Math.sqrt(Math.max(0, argValues[0] ?? 0))
          break
        case 'POWER':
          result = Math.pow(argValues[0] ?? 0, argValues[1] ?? 0)
          break
        case 'MOD':
          result = (argValues[0] ?? 0) % (argValues[1] ?? 1)
          break
        default:
          throw new Error(`Función no implementada: ${node.name}`)
      }
      return { value: result, dependencies, warnings }
    }

    case 'Parenthesis':
      return evaluateNode(node.expression, context)

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = node
      throw new Error(`Tipo de nodo desconocido: ${_exhaustive}`)
  }
}

function colToLetter(col: number): string {
  let result = ''
  col++
  while (col > 0) {
    const rem = (col - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    col = Math.floor((col - 1) / 26)
  }
  return result
}

// ============================================================
// PUBLIC API
// ============================================================

export interface ParsedFormula {
  ast: FormulaNode
  version: number
  originalFormula: string
  parsedAt: string
  dependencies: string[] // Cell references found statically
}

export interface FormulaEvaluationResult {
  value: number | string
  dependencies: string[]
  warnings: string[]
  evaluatedAt: string
}

export class FormulaEngine {
  private static readonly VERSION = 1

  /**
   * Parsea una fórmula y retorna el AST.
   * Lanza error si la fórmula es inválida.
   */
  static parse(formula: string): ParsedFormula {
    if (!formula || !formula.trim()) {
      throw new Error('Fórmula vacía')
    }

    // Normalizar: remover '=' inicial si existe
    const normalized = formula.trim().startsWith('=') ? formula.trim().slice(1) : formula.trim()

    const tokens = tokenize(normalized)
    const parser = new Parser(tokens)
    const ast = parser.parse()

    // Extraer dependencias estáticas (referencias de celda)
    const dependencies = this.extractDependencies(ast)

    return {
      ast,
      version: FormulaEngine.VERSION,
      originalFormula: formula,
      parsedAt: new Date().toISOString(),
      dependencies,
    }
  }

  /**
   * Evalúa una fórmula parseada contra un contexto.
   */
  static evaluate(parsed: ParsedFormula, context: EvaluationContext): FormulaEvaluationResult {
    const result = evaluateNode(parsed.ast, context)
    return {
      value: result.value,
      dependencies: Array.from(result.dependencies),
      warnings: result.warnings,
      evaluatedAt: new Date().toISOString(),
    }
  }

  /**
   * Parsea y evalúa en un solo paso.
   */
  static parseAndEvaluate(formula: string, context: EvaluationContext): FormulaEvaluationResult {
    const parsed = this.parse(formula)
    return this.evaluate(parsed, context)
  }

  /**
   * Extrae referencias de celda del AST estáticamente.
   */
  private static extractDependencies(node: FormulaNode): string[] {
    const deps = new Set<string>()

    function walk(n: FormulaNode) {
      if (n.type === 'CellRef') {
        const ref = `${n.sheet ?? ''}${n.sheet ? '!' : ''}${colToLetter(n.col)}${n.row + 1}`
        deps.add(ref)
      } else if (n.type === 'BinaryOp') {
        walk(n.left)
        walk(n.right)
      } else if (n.type === 'UnaryOp') {
        walk(n.operand)
      } else if (n.type === 'FunctionCall') {
        n.args.forEach(walk)
      } else if (n.type === 'Parenthesis') {
        walk(n.expression)
      }
    }

    walk(node)
    return Array.from(deps).sort()
  }

  /**
   * Valida una fórmula sin evaluarla.
   * Retorna true si es sintácticamente válida.
   */
  static validate(formula: string): { valid: boolean; error?: string } {
    try {
      this.parse(formula)
      return { valid: true }
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /**
   * Obtiene la versión del motor de fórmulas.
   */
  static getVersion(): number {
    return FormulaEngine.VERSION
  }
}