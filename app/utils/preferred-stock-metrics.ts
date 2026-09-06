import type { PreferredStock } from '~/composables/preferred/usePreferredStockList'

// Shared by preferred-stocks/index.vue (list table) and preferred-stocks/[code].vue (detail
// view) so the two never quietly drift on how 溢價率/負凸性警示 are derived. A countdown
// helper (距贖回日 as "剩餘 X 年 Y 個月") lived here too until direct request ("我希望不要寫倒
// 數多久，請直接呈現日期") replaced every countdown display with the raw redemptionDate value —
// removed since nothing computed from it anymore.

// 溢價率 — 現價相對發行人贖回價的溢價幅度，null 代表無贖回價可比較（doc §負凸性警示的判斷基礎）
// ——真實資料目前查無贖回價（redemptionConditions 是自由格式文字，無法可靠解析出數字），這裡
// 會自然回傳 null，不會用假數字硬算。
export function premiumRate(stock: Pick<PreferredStock, 'price' | 'callPrice'>): number | null {
  if (stock.price === null || stock.callPrice === null || stock.callPrice === 0) return null
  return ((stock.price - stock.callPrice) / stock.callPrice) * 100
}

// 負凸性警示 — doc 定義為「溢價 > 2%」觸發：市價已顯著高於發行人贖回價，一旦發行人行使買回權，
// 投資人將承擔溢價虧損。
export function hasNegativeConvexityWarning(stock: Pick<PreferredStock, 'price' | 'callPrice'>): boolean {
  const rate = premiumRate(stock)
  return rate !== null && rate > 2
}
