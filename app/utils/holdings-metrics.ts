// 投資組合指標的顯示文字（2026-10-07，交易績效與風險頁共用；GET /holdings/performance、/holdings/risk 的
// 欄位見 bff-ts src/application/holdings/holdings.types.ts）。不 import 任何東西：scripts/check-holdings-metrics.mjs
// 直接用 node 跑它。
//
// 值是 6 位小數字串。null 不一律寫「－」——**每一種「沒有」各自命名**：樣本天數不夠、期間不滿一年、取不到
// 無風險利率，對讀者是三件不同的事（前兩件等久一點就會有，第三件不會）。只陳述數字與原因，不評價（投信投顧法）。

export type HoldingsMetricFormat = 'pct' | 'signedPct' | 'ratio' | 'money'

export const UNDER_A_YEAR = '期間未滿一年'
export const NO_RISK_FREE = '無風險利率暫時取不到'

// 尾端風險（VaR／ES）要 100 個交易日（尾端才有 5 筆以上）；共變異數與跟大盤比的那些要 120 個（bff-ts 的門檻）
export const TAIL_MIN_DAYS = 100
export const COVARIANCE_MIN_DAYS = 120

export function holdingsMetricText(value: string | null | undefined, format: HoldingsMetricFormat, missing = '－', digits?: number): string {
  if (value === null || value === undefined) return missing
  const number = Number(value)
  if (!Number.isFinite(number)) return missing
  if (format === 'ratio') return number.toFixed(digits ?? 2)
  if (format === 'money') return `${Math.round(number).toLocaleString('en-US')} 元`
  const percent = (number * 100).toFixed(digits ?? 1)
  if (format === 'signedPct' && Number(percent) > 0) return `+${percent}%`
  return `${Number(percent) === 0 ? (0).toFixed(digits ?? 1) : percent}%`
}

export function sampleShortfall(days: number, required: number): string | null {
  return days < required ? `樣本不足（${days} 天，需 ${required} 天）` : null
}

// 兩端都含的日曆天數不滿 365 天（bff-ts 年化與 Calmar 的門檻）
export function periodUnderYear(from: string, to: string): boolean {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1 < 365
}

// 第一個成立的原因；都不成立時是「－」
export function firstReason(...reasons: (string | null | false | undefined)[]): string {
  return reasons.find((reason): reason is string => !!reason) ?? '－'
}

// 「無風險利率：五大銀行一年期定存 1.70%（2026-08）」。用最後一個月實際套用的那一筆，日期寫它的 sourcePeriod
// 而不是 period——央行月報落後一到兩個月，寫 period 會讓人以為是即時利率（bff-ts 的要求）。
export function riskFreeLine(riskFree: { rates: { period: string; ratePct: number; sourcePeriod: string }[] } | null): string | null {
  const last = riskFree?.rates.at(-1)
  return last ? `無風險利率：五大銀行一年期定存 ${last.ratePct.toFixed(2)}%（${last.sourcePeriod}）` : null
}

// 「涵蓋 88% 市值」：有這個數字的持股佔市值的比例；接近 100% 時不寫（沒有要交代的）
export function coverageText(coverage: string | null): string | null {
  if (coverage === null) return null
  const share = Number(coverage)
  return share < 0.9995 ? `涵蓋 ${(share * 100).toFixed(0)}% 市值` : null
}
