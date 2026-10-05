// 持股自訂欄位的公式引擎：Excel 風格的公式（`=D/A`、`=ROUND(E/B*100, 2)`、`=IF(F>0.1, 1, 0)`）逐列計算。
//
// 使用者 2026-10-05：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值，UIUX 體感盡可能比照 Excel」。
// 自己寫而不用 filtrex／math.js：那兩個的等號是 `==`、沒有 `%` 百分比與 `<>`，語意跟 Excel 對不上；Excel 的
// 子集只要一個小解析器。**絕不 eval**——這裡只認數字、欄位字母、白名單函數與運算子，其餘一律是錯誤。
//
// 零 import，讓 scripts/check-holdings-formula.mjs 能直接 import。
//
// 錯誤值照 Excel：#DIV/0!（除以 0）、#N/A（那一列沒有這個值，例如沒報價）、#REF!（不存在的欄位、循環參照、
// 被刪掉的欄位）、#NAME?（不認得的函數）、#VALUE!（參數不對）。錯誤會一路往外傳，跟 Excel 一樣。

export type FormulaError = '#DIV/0!' | '#N/A' | '#REF!' | '#NAME?' | '#VALUE!'
export type FormulaValue = number | boolean | FormulaError

const ERRORS: readonly FormulaError[] = ['#DIV/0!', '#N/A', '#REF!', '#NAME?', '#VALUE!']

export function isFormulaError(value: FormulaValue): value is FormulaError {
  return typeof value === 'string'
}

// 0 → A、25 → Z、26 → AA
export function columnLetter(index: number): string {
  let letter = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter
  return letter
}

function columnIndex(letter: string): number {
  let index = 0
  for (const ch of letter) index = index * 26 + (ch.charCodeAt(0) - 64)
  return index - 1
}

// ---- 斷詞 ----

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ref'; value: string }
  | { kind: 'func'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'err'; value: FormulaError }
  | { kind: 'op'; value: string }

function tokenize(text: string): Token[] | string {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (/\s/.test(ch)) { i++; continue }
    const number = /^\d+(\.\d+)?|^\.\d+/.exec(text.slice(i))
    if (number) {
      tokens.push({ kind: 'num', value: Number(number[0]) })
      i += number[0].length
      continue
    }
    const error = ERRORS.find(code => text.startsWith(code, i))
    if (error) {
      tokens.push({ kind: 'err', value: error })
      i += error.length
      continue
    }
    const word = /^[A-Za-z]+/.exec(text.slice(i))
    if (word) {
      const upper = word[0].toUpperCase()
      i += word[0].length
      if (/^\s*\(/.test(text.slice(i))) tokens.push({ kind: 'func', value: upper })
      else if (upper === 'TRUE' || upper === 'FALSE') tokens.push({ kind: 'bool', value: upper === 'TRUE' })
      else tokens.push({ kind: 'ref', value: upper })
      continue
    }
    const op = ['<=', '>=', '<>'].find(two => text.startsWith(two, i)) ?? ('+-*/^%(),=<>'.includes(ch) ? ch : null)
    if (!op) return `看不懂「${ch}」`
    tokens.push({ kind: 'op', value: op })
    i += op.length
  }
  return tokens
}

// ---- 語法樹 ----

export type FormulaNode =
  | { type: 'num'; value: number }
  | { type: 'bool'; value: boolean }
  | { type: 'err'; value: FormulaError }
  | { type: 'ref'; letter: string }
  | { type: 'unary'; op: string; operand: FormulaNode }
  | { type: 'percent'; operand: FormulaNode }
  | { type: 'binary'; op: string; left: FormulaNode; right: FormulaNode }
  | { type: 'call'; name: string; args: FormulaNode[] }

export type ParseResult = { ok: true; node: FormulaNode } | { ok: false; message: string }

// 優先順序照 Excel：比較 < 加減 < 乘除 < 次方 < 負號 < 百分比。Excel 的 -2^2 是 4（負號先於次方），這裡一樣。
export function parseFormula(formula: string): ParseResult {
  const body = formula.trim().replace(/^=/, '')
  if (!body.trim()) return { ok: false, message: '公式是空的' }
  const tokenized = tokenize(body)
  if (typeof tokenized === 'string') return { ok: false, message: tokenized }
  // 收窄後另存一個常數：下面的巢狀函式裡 TS 不會沿用 typeof 的收窄
  const tokens: Token[] = tokenized
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (value: string) => peek()?.kind === 'op' && peek()!.value === value

  function comparison(): FormulaNode {
    let node = additive()
    while (peek()?.kind === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek()!.value as string)) {
      const op = tokens[pos++]!.value as string
      node = { type: 'binary', op, left: node, right: additive() }
    }
    return node
  }
  function additive(): FormulaNode {
    let node = multiplicative()
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++]!.value as string
      node = { type: 'binary', op, left: node, right: multiplicative() }
    }
    return node
  }
  function multiplicative(): FormulaNode {
    let node = power()
    while (isOp('*') || isOp('/')) {
      const op = tokens[pos++]!.value as string
      node = { type: 'binary', op, left: node, right: power() }
    }
    return node
  }
  function power(): FormulaNode {
    let node = unary()
    while (isOp('^')) {
      pos++
      node = { type: 'binary', op: '^', left: node, right: unary() }
    }
    return node
  }
  function unary(): FormulaNode {
    if (isOp('-') || isOp('+')) {
      const op = tokens[pos++]!.value as string
      return { type: 'unary', op, operand: unary() }
    }
    let node = primary()
    while (isOp('%')) {
      pos++
      node = { type: 'percent', operand: node }
    }
    return node
  }
  function primary(): FormulaNode {
    const token = tokens[pos++]
    if (!token) throw new Error('公式還沒寫完')
    if (token.kind === 'num') return { type: 'num', value: token.value }
    if (token.kind === 'bool') return { type: 'bool', value: token.value }
    if (token.kind === 'err') return { type: 'err', value: token.value }
    if (token.kind === 'ref') return { type: 'ref', letter: token.value }
    if (token.kind === 'func') {
      pos++ // (
      const args: FormulaNode[] = []
      if (!isOp(')')) {
        args.push(comparison())
        while (isOp(',')) {
          pos++
          args.push(comparison())
        }
      }
      if (!isOp(')')) throw new Error(`${token.value}( 少了右括號`)
      pos++
      return { type: 'call', name: token.value, args }
    }
    if (token.value === '(') {
      const node = comparison()
      if (!isOp(')')) throw new Error('少了右括號')
      pos++
      return node
    }
    throw new Error(`「${token.value}」的位置不對`)
  }

  try {
    const node = comparison()
    if (pos < tokens.length) return { ok: false, message: `「${String(tokens[pos]!.value)}」的位置不對` }
    return { ok: true, node }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '公式寫法不對' }
  }
}

// ---- 計算 ----

type Lookup = (letter: string) => FormulaValue

function toNumber(value: FormulaValue): number | FormulaError {
  if (isFormulaError(value)) return value
  return typeof value === 'boolean' ? Number(value) : value
}

const FUNCTIONS: Record<string, (args: FormulaValue[]) => FormulaValue> = {
  ROUND: ([value, digits = 0]) => {
    const x = toNumber(value ?? '#VALUE!')
    const n = toNumber(digits)
    if (isFormulaError(x)) return x
    if (isFormulaError(n)) return n
    const factor = 10 ** Math.trunc(n)
    // Excel 的 ROUND 是「四捨五入、遠離 0」，不是 Math.round 的「.5 往正無限大」
    return Math.sign(x) * Math.round(Math.abs(x) * factor) / factor
  },
  ABS: ([value]) => {
    const x = toNumber(value ?? '#VALUE!')
    return isFormulaError(x) ? x : Math.abs(x)
  },
  MIN: args => aggregate(args, values => Math.min(...values)),
  MAX: args => aggregate(args, values => Math.max(...values)),
  SUM: args => aggregate(args, values => values.reduce((a, b) => a + b, 0)),
  AVERAGE: args => aggregate(args, values => values.reduce((a, b) => a + b, 0) / values.length)
}

function aggregate(args: FormulaValue[], fn: (values: number[]) => number): FormulaValue {
  if (args.length === 0) return '#VALUE!'
  const values: number[] = []
  for (const arg of args) {
    const x = toNumber(arg)
    if (isFormulaError(x)) return x
    values.push(x)
  }
  return fn(values)
}

function evaluate(node: FormulaNode, lookup: Lookup): FormulaValue {
  switch (node.type) {
    case 'num': return node.value
    case 'bool': return node.value
    case 'err': return node.value
    case 'ref': return lookup(node.letter)
    case 'unary': {
      const x = toNumber(evaluate(node.operand, lookup))
      if (isFormulaError(x)) return x
      return node.op === '-' ? -x : x
    }
    case 'percent': {
      const x = toNumber(evaluate(node.operand, lookup))
      return isFormulaError(x) ? x : x / 100
    }
    case 'call': {
      // IF 與 IFERROR 要先看第一個參數才決定算哪一支，跟 Excel 一樣不會因為沒走到的那支出錯而出錯
      if (node.name === 'IF') {
        if (node.args.length < 2 || node.args.length > 3) return '#VALUE!'
        const condition = toNumber(evaluate(node.args[0]!, lookup))
        if (isFormulaError(condition)) return condition
        if (condition !== 0) return evaluate(node.args[1]!, lookup)
        return node.args[2] ? evaluate(node.args[2], lookup) : false
      }
      if (node.name === 'IFERROR') {
        if (node.args.length !== 2) return '#VALUE!'
        const value = evaluate(node.args[0]!, lookup)
        return isFormulaError(value) ? evaluate(node.args[1]!, lookup) : value
      }
      const fn = FUNCTIONS[node.name]
      if (!fn) return '#NAME?'
      return fn(node.args.map(arg => evaluate(arg, lookup)))
    }
    case 'binary': {
      const left = toNumber(evaluate(node.left, lookup))
      if (isFormulaError(left)) return left
      const right = toNumber(evaluate(node.right, lookup))
      if (isFormulaError(right)) return right
      switch (node.op) {
        case '+': return left + right
        case '-': return left - right
        case '*': return left * right
        case '/': return right === 0 ? '#DIV/0!' : left / right
        case '^': {
          const result = left ** right
          return Number.isFinite(result) ? result : '#VALUE!'
        }
        case '=': return left === right
        case '<>': return left !== right
        case '<': return left < right
        case '>': return left > right
        case '<=': return left <= right
        default: return left >= right
      }
    }
  }
}

export interface CustomColumnFormula {
  letter: string
  formula: string
}

// 一列的所有自訂欄位。builtIn 是內建欄位的值（null ＝ 那一列沒有這個值 → #N/A）。自訂欄位可以互相參照，
// 循環參照是 #REF!；語法錯的公式也是 #REF!——編輯器在存之前就會擋，這裡只是不讓一筆壞資料弄壞整張表。
export function evaluateRow(builtIn: Record<string, number | null>, custom: CustomColumnFormula[]): Record<string, FormulaValue> {
  const parsed = new Map(custom.map(column => [column.letter, parseFormula(column.formula)]))
  const results: Record<string, FormulaValue> = {}
  const visiting = new Set<string>()
  const lookup: Lookup = (letter) => {
    if (letter in builtIn) return builtIn[letter] ?? '#N/A'
    if (letter in results) return results[letter]!
    const parse = parsed.get(letter)
    if (!parse || !parse.ok || visiting.has(letter)) return '#REF!'
    visiting.add(letter)
    const value = evaluate(parse.node, lookup)
    visiting.delete(letter)
    results[letter] = value
    return value
  }
  for (const column of custom) lookup(column.letter)
  return results
}

// 刪掉一欄時改寫公式，跟 Excel 一樣：參照被刪那一欄的變成 #REF!，後面的欄位字母往前移一格。
// 用斷詞而不是字串取代，所以函數名稱（例如 ROUND 裡的字母）不會被誤改。
export function rewriteAfterDelete(formula: string, deletedLetter: string): string {
  const deleted = columnIndex(deletedLetter)
  return formula.replace(/(#[A-Z/0!?]+)|([A-Za-z]+)(\s*\()?/g, (match, error: string | undefined, word: string | undefined, call: string | undefined) => {
    if (error || call || !word) return match
    const upper = word.toUpperCase()
    if (upper === 'TRUE' || upper === 'FALSE') return match
    const index = columnIndex(upper)
    if (index === deleted) return '#REF!'
    return index > deleted ? columnLetter(index - 1) : match
  })
}
