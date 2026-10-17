import type { PreferredDividendRow } from '#shared/types/screener-detail'

// GET /api/preferred/dividends — 特別股專區「實際配息紀錄」：每一檔實際配發的現金股利，依除息日的年份加總。
// 特別股的 dividend-history 從 2026-10-05 起 cashDividend 是真的特別股股息（業務中台），深度 0～8 年。走 cachedDividendHistory（跟個股頁同一份
// 快取）；某一檔讀不到就那一列 null，不讓整頁失敗。
export default defineEventHandler(async (): Promise<{ rows: PreferredDividendRow[] }> => {
  const list = await cachedPreferredStocks()
  const rows = await Promise.all(list.map(async (entry): Promise<PreferredDividendRow> => {
    const history = await settle(cachedDividendHistory(entry.symbol))
    if (!history) return { symbol: entry.symbol, byYear: null }
    const byYear: Record<string, number> = {}
    for (const year of history.entries ?? []) {
      for (const event of year.events ?? []) {
        if (!event.exDividendDate || !event.cashDividend) continue
        const key = event.exDividendDate.slice(0, 4)
        byYear[key] = Number(((byYear[key] ?? 0) + event.cashDividend).toFixed(6))
      }
    }
    return { symbol: entry.symbol, byYear }
  }))
  return { rows }
})
