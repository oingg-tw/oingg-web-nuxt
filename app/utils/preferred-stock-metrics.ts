import type { PreferredStock } from '~/components/preferred/PreferredStockCard.vue'

// Shared by PreferredStockCard.vue (list view) and preferred-stocks/[code].vue (detail view)
// so the two never quietly drift on how 距贖回日/溢價率/負凸性警示 are derived.

// 距贖回日 — 無贖回條款 / 已達贖回日 / 剩餘 X 年 Y 個月，三選一，doc §發行人贖回權要求同時揭露
// 贖回日與剩餘年限。
export function callCountdown(stock: Pick<PreferredStock, 'callDate'>): string {
  if (!stock.callDate) return '無贖回條款'
  const today = new Date()
  const call = new Date(stock.callDate)
  const totalMonths = (call.getFullYear() - today.getFullYear()) * 12 + (call.getMonth() - today.getMonth())
  if (totalMonths <= 0) return '已達贖回日'
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `剩餘 ${months} 個月`
  if (months === 0) return `剩餘 ${years} 年`
  return `剩餘 ${years} 年 ${months} 個月`
}

// 溢價率 — 現價相對發行人贖回價的溢價幅度，null 代表無贖回條款可比較（doc §負凸性警示的判斷基礎）。
export function premiumRate(stock: Pick<PreferredStock, 'price' | 'callPrice'>): number | null {
  if (stock.callPrice === null || stock.callPrice === 0) return null
  return ((stock.price - stock.callPrice) / stock.callPrice) * 100
}

// 負凸性警示 — doc 定義為「溢價 > 2%」觸發：市價已顯著高於發行人贖回價，一旦發行人行使買回權，
// 投資人將承擔溢價虧損。
export function hasNegativeConvexityWarning(stock: Pick<PreferredStock, 'price' | 'callPrice'>): boolean {
  const rate = premiumRate(stock)
  return rate !== null && rate > 2
}
