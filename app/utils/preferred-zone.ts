import type { PreferredStockEntry } from '#shared/types/screener-detail'

// 特別股專區（/preferred，2026-10-18，使用者：「設計特別股專區，包含 sidebar 的項目怎麼分」→ 選了「依投資人的問題排」、單層）。
// 側欄的順序就是退休族看一檔特別股會問的順序：有哪些 → 領多少 → 會不會被收回、買貴了會怎樣 → 實際配了多少 → 權利條款 → 好不好買賣 →
// 自己用條件挑。description 是總覽頁導覽表每列的一句話（同 macro-nav.ts）。
//
// 文案底線（投信投顧法）：只陳述數字與「符合條件」，不寫安全、推薦、便宜、貴；特別股不保本。上游的 null 是「未知」不是「沒有」。
export interface PreferredNavNode {
  label: string
  to: string
  description: string
}

export const PREFERRED_ZONE_PATH = '/preferred'

export const PREFERRED_NAV_ITEMS: PreferredNavNode[] = [
  { label: '特別股總覽', to: PREFERRED_ZONE_PATH, description: '現在上市櫃的特別股有哪幾檔，每一檔的現價、殖利率、最差殖利率與最早可收回日。' },
  { label: '殖利率比較', to: `${PREFERRED_ZONE_PATH}/yields`, description: '票面利率、用現價算的殖利率、把被收回也算進去的最差殖利率，三種算法並排。' },
  { label: '收回時程與溢價', to: `${PREFERRED_ZONE_PATH}/call-schedule`, description: '發行公司最早什麼時候可以收回、收回條件原文，以及現價比發行價高出多少。' },
  { label: '實際配息紀錄', to: `${PREFERRED_ZONE_PATH}/dividends`, description: '每一檔近幾年實際配發的股息，對照目前公告的每年股息。' },
  { label: '權利條款比較', to: `${PREFERRED_ZONE_PATH}/terms`, description: '累積、參加、可轉換、表決權、清算優先與可收回，各檔條款並排。' },
  { label: '成交量', to: `${PREFERRED_ZONE_PATH}/liquidity`, description: '近 60 個交易日平均每天成交多少張、有幾天沒有成交。' },
  { label: '條件篩選', to: SCREENER_PATHS.preferred, description: '用殖利率、溢價率與條款組合條件，找出符合的特別股。' }
]

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
