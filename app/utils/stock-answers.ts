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
