import type { PreferredStock } from '~/composables/preferred/usePreferredStockList'

// Shared by preferred-stocks/index.vue (list table) and preferred-stocks/[code].vue (detail
// view) so the two never quietly drift on how 溢價率/負凸性警示 are derived. A countdown
// helper (距贖回日 as "剩餘 X 年 Y 個月") lived here too until direct request ("我希望不要寫倒
// 數多久，請直接呈現日期") replaced every countdown display with the raw redemptionDate value —
// removed since nothing computed from it anymore.

// A null redemptionDate used to render as the flat assertion "無贖回條款" — per direct request
// ("不可以說無贖回條款...這個警示代表等待平台或是用戶自行查證"), that's not a claim this app
// can actually back: mops-ts's own source field is generic free text with no structural
// guarantee the absence of a parsed date means the clause genuinely doesn't exist (could just
// as easily be a data gap). Both pages now show a WarningFilled-flagged "待查證" instead,
// carrying this same explanation as a tooltip/caption.
export const REDEMPTION_UNCONFIRMED_NOTE = '尚無明確資料可判斷是否具備贖回條款，非本站或用戶已確認為無，建議自行查證公開說明書或公告。'

// 溢價率 — 現價相對贖回價的溢價幅度，null 代表無贖回價可比較（doc §負凸性警示的判斷基礎）
// ——真實資料目前查無贖回價（redemptionConditions 是自由格式文字，無法可靠解析出數字），這裡
// 會自然回傳 null，不會用假數字硬算。Not labeled "發行人贖回價" — mops-ts confirmed 2026-09-07
// that MOPS's「是否收回」/「收回條件」欄位是通用自由文字，沒有結構化保證這是發行人還是股東的
// 權利，不能自行加註歸屬（見 usePreferredStockList.ts 對 redemptionDate/redemptionConditions
// 的同一份說明）。
export function premiumRate(stock: Pick<PreferredStock, 'price' | 'callPrice'>): number | null {
  if (stock.price === null || stock.callPrice === null || stock.callPrice === 0) return null
  return ((stock.price - stock.callPrice) / stock.callPrice) * 100
}

// 負凸性警示 — doc 定義為「溢價 > 2%」觸發：市價已顯著高於贖回價，一旦條款觸發收回，投資人將
// 承擔溢價虧損。
export function hasNegativeConvexityWarning(stock: Pick<PreferredStock, 'price' | 'callPrice'>): boolean {
  const rate = premiumRate(stock)
  return rate !== null && rate > 2
}
