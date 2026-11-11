import type { RiverCellsByTimeframe } from '#shared/types/stock-metric-page'
import type { RiverKind } from '#shared/utils/metric-pages'

// GET /api/stock/:code/river-latest?kinds=pe,pb — 指標速覽數值表裡河流圖那幾列的數字（2026-11-01，使用者：表格也要跟圖一樣是最後一點）。
// 跟指標頁答句同一份快取（riverLatestOf）；伺服器端就算好，表格給搜尋引擎。不認得的 kind 丟掉。
// 沒有比值的期別帶原因（2026-11-12，使用者：「圖表沒資料時顯示原因」），格子寫「無法計算」、滑過去看原因
export default defineEventHandler(async (event): Promise<Partial<Record<RiverKind, RiverCellsByTimeframe>>> => {
  const code = requireListedSymbol(event)
  const raw = getQuery(event).kinds
  const kinds = [...new Set(String(typeof raw === 'string' ? raw : '').split(','))].filter((kind): kind is RiverKind => Object.hasOwn(RIVER_TIMEFRAMES, kind))
  const entries = await Promise.all(kinds.map(async kind => [kind, await riverLatestOf(code, kind, true)] as const))
  return Object.fromEntries(entries.filter(([, latest]) => latest && Object.keys(latest).length))
})
