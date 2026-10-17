import type { PreferredLiquidityRow } from '#shared/types/screener-detail'

// GET /api/preferred/liquidity — 特別股專區「成交量」：近 60 個交易日的日均成交股數與沒有成交的天數（2026-10-18）。
// 特別股成交量差很多（2026-10-18 量：2883B 約 140 萬股／日，8349A 約 5 千股／日），想賣的時候賣不賣得掉是退休族會問的事。
// 無成交日上游的收盤價是 0（isRealClose 的註解），成交量可能是 null：0 或收盤價 0 算「沒有成交」，平均只算知道成交量的那幾天（含 0）。
const DAYS = 60

const cachedRecentVolumes = defineCachedFunction(
  async (symbol: string) => (await businessFetch<{ entries: { tradeDate: string; close: number; volume: number | null }[] }>(`/stocks/${symbol}/daily-price-history`, { query: { limit: DAYS } })).entries ?? [],
  // 收盤後才會變，6 小時夠新
  { name: 'preferred-recent-volumes', getKey: symbol => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

export default defineEventHandler(async (): Promise<{ days: number; rows: PreferredLiquidityRow[] }> => {
  const list = await cachedPreferredStocks()
  const rows = await Promise.all(list.map(async (entry): Promise<PreferredLiquidityRow> => {
    const days = await settle(cachedRecentVolumes(entry.symbol))
    if (!days?.length) return { symbol: entry.symbol, averageVolume: null, zeroVolumeDays: null, days: 0 }
    const known = days.filter(day => day.volume !== null)
    const zeroVolumeDays = days.filter(day => day.volume === 0 || !isRealClose(day)).length
    return {
      symbol: entry.symbol,
      averageVolume: known.length ? Math.round(known.reduce((sum, day) => sum + (isRealClose(day) ? day.volume! : 0), 0) / known.length) : null,
      zeroVolumeDays,
      days: days.length
    }
  }))
  return { days: DAYS, rows }
})
