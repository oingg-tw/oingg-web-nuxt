import type { CompanyRankResponse } from '#shared/types/stock-context'
import type { StockPageDigest } from '~/utils/stock-digest'

// Pure sentence builders for the question-form sections of the /stock/:code pages (2026-09-19, the
// SEO build). Same contract as stock-digest.ts: deterministic on both renders（no Date, no locale
// formatting）, the compliance register（numbers and statistical positions, no adjectives）, and a
// clause with no number is dropped rather than printed as a placeholder — never「資料不足」.

// Joins the non-empty clauses with「、」and ends the sentence; null when nothing survived.
export function joinClauses(clauses: (string | null | undefined)[], end = '。'): string | null {
  const kept = clauses.filter((clause): clause is string => !!clause)
  return kept.length ? `${kept.join('、')}${end}` : null
}

// Joins whole sentences（each already ending with 。）into one paragraph.
export function joinSentences(sentences: (string | null | undefined)[]): string | null {
  const kept = sentences.filter((sentence): sentence is string => !!sentence)
  return kept.length ? kept.join('') : null
}

// The digest's own「近四季 EPS 86.27 元」texts for the requested codes, in the requested order.
export function factTexts(digest: StockPageDigest | null, codes: string[]): string[] {
  if (!digest) return []
  const byCode = new Map(digest.facts.map(fact => [fact.code, fact.text]))
  return codes.map(code => byCode.get(code) ?? null).filter((text): text is string => text !== null)
}

export function factValue(digest: StockPageDigest | null, code: string): number | null {
  return digest?.facts.find(fact => fact.code === code)?.value ?? null
}

// Thousands separators without toLocaleString（deterministic across runtimes）.
// 全站唯一一份千分位分組。2026-10-02 之前有三份：這一份、format-significant-digits.ts 的區域版、
// formatStatementAmount 內嵌的那四行，以及 SharedMetricTable 的 addThousandSeparators（第四份，原本的盤點漏掉它）。
//
// 三份都用同一個 `\B(?=(\d{3})+(?!\d))` lookahead，但另兩份額外自己剝負號——那是多餘的：`-` 與第一個
// 數字之間本來就是 word boundary，所以 `\B` 不會在那裡命中。掃 30 個輸入（含負數、小數、15 位數、
// `-0.00`）比對三份輸出：**唯一的差異是 `"1234."` 這種尾點輸入**（另兩份保留小數點，這一份丟掉），
// 而兩個呼叫端都到不了那裡——一個吃 `Number.toString()`（不產生尾點），一個吃 bff-ts 的 bigint 字串。
//
// 刻意不用 `toLocaleString('zh-TW')`：它的輸出取決於 Node 的 ICU 建置，SSR 與瀏覽器可能不同
// （見 financial-statement-rows.ts 的 formatStatementAmount 註解，那是一個修過的真 bug）。
export function groupThousands(value: number | string): string {
  const [integer, fraction] = String(value).split('.')
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

// 「近四季 ROE 34.78%：全市場 1,760 家由高到低第 61 名（前 3.5%）」— a statistical position, never a
// judgement. `topPercent` is bff-ts's own "position from the top" figure. `populationLabel`
// defaults to 全市場（every field except dividendYield.EOD ranks against the whole market）— a
// caller whose own GET /screener/company-rank call used `excludeZero` (2026-09-20, see
// server/utils/stock-data.ts's own comment) passes a label naming the narrower population instead,
// since `rank.totalCount` itself already reflects that smaller denominator and saying 全市場 would
// misstate what the company is actually being ranked against.
export function rankSentence(label: string, unit: string, rank: CompanyRankResponse | null | undefined, direction: 'asc' | 'desc', populationLabel = '全市場'): string | null {
  if (!rank || !rank.found || rank.rank === null || rank.totalCount === null || rank.value === null) return null
  const value = Number.isInteger(rank.value) ? String(rank.value) : rank.value.toFixed(2)
  const unitText = unit === '%' ? '%' : unit ? ` ${unit}` : ''
  const order = direction === 'desc' ? '由高到低' : '由低到高'
  const top = rank.topPercent !== null ? `（前 ${rank.topPercent}%）` : ''
  return `${label} ${value}${unitText}：${populationLabel} ${groupThousands(rank.totalCount)} 家${order}第 ${groupThousands(rank.rank)} 名${top}`
}
