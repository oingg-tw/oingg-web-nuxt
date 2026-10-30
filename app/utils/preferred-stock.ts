import type { PreferredStockEntry } from '#shared/types/screener-detail'

// 特別股個別頁的面向（2026-10-18，使用者：「我要的不是專區，我要的是特別股的個別瀏覽頁 可以透過 sidebar 切換不同面向」）。同一檔的四頁共用
// 一個側欄，順序是退休族看一檔特別股會問的順序：領多少 → 會不會被收回、買貴了會怎樣 → 實際配了多少 → 權利條款。前一版做成跨 28 檔的
// 專區（七項側欄），已經拆掉；28 檔的清單就是 /screener/preferred。
//
// 文案底線（投信投顧法）：只陳述數字與條款，不寫安全、推薦、便宜、貴；特別股不保本。上游的 null 是「未知」不是「沒有」。
export const PREFERRED_FACETS = [
  { label: '股息與殖利率', suffix: '' },
  { label: '收回條款與溢價', suffix: '/redemption' },
  { label: '實際配息紀錄', suffix: '/dividends' },
  { label: '權利條款', suffix: '/terms' }
] as const

export type PreferredFacetLabel = typeof PREFERRED_FACETS[number]['label']

// 特別股篩選結果表的一格連到這檔那個面向的頁（2026-10-30）。股息與殖利率那幾欄不在這裡：整列本來就連到第一頁
const FIELD_FACETS: Record<string, typeof PREFERRED_FACETS[number]['suffix']> = {
  ytwPct: '/redemption', issuePrice: '/redemption', premiumRatePct: '/redemption',
  exDividendMonths: '/dividends',
  cumulativeDividend: '/terms', participatingExcessDividend: '/terms', liquidationPreference: '/terms', votingRights: '/terms', convertible: '/terms',
  redeemable: '/terms', issueDate: '/terms', marketType: '/terms'
}
export const preferredFieldPath = (code: string, field: string): string | null =>
  FIELD_FACETS[field] === undefined ? null : `${preferredStockPath(code)}${FIELD_FACETS[field]}`

export const preferredFacetItems = (code: string) =>
  PREFERRED_FACETS.map(facet => ({ label: facet.label, to: `${preferredStockPath(code)}${facet.suffix}` }))

export const preferredPct = (value: number | null | undefined) => (value === null || value === undefined ? '－' : `${value.toFixed(2)}%`)
export const preferredYuan = (value: number | null | undefined) => (value === null || value === undefined ? '－' : `${groupThousands(Number(value.toFixed(4)))} 元`)
// 上游 null ＝ 未知（條款表 2026-09-08 起是快照，之後新發行的整列都是 null）
export const preferredYesNo = (value: boolean | null, yes: string, no: string) => (value === null ? '未知' : value ? yes : no)

// 收回殖利率假設的收回時點，用讀者的話說（上游的列舉見 PreferredStockEntry.ytcAssumption）
export const YTC_ASSUMPTION_TEXT: Record<string, string> = {
  past_redemption_date_assumed_next_period: '已過最早可收回日，假設下一期收回',
  scheduled_redemption_date: '假設在最早可收回日收回',
  no_scheduled_redemption_date_assumed_next_period: '條款沒寫收回日，假設下一期收回'
}

// 最早可收回日相對今天：已過（發行公司還沒收回）／還沒到／不可收回或未知
export function redemptionStatus(entry: PreferredStockEntry, today: string): 'passed' | 'upcoming' | 'none' {
  if (!entry.redeemable || !entry.redemptionDate) return 'none'
  return entry.redemptionDate <= today ? 'passed' : 'upcoming'
}
