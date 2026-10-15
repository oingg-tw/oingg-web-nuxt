import type { EtfDetail, EtfDistributions, LatestClose, PreferredStockEntry } from '#shared/types/screener-detail'

// 篩選區兩種個別頁（ETF、特別股）與它們的 sitemap 的伺服器端讀取（2026-10-15 三組篩選重新設計）。同 stock-data.ts 的規則：
// businessFetch 丟錯就不快取、具名、stale-while-revalidate。
//
// DEV 注意：GET /etfs/:symbol 要等 analysis-ts 部署，在那之前 DEV 對每一檔都回 404（業務中台 2026-10-15）；本機 4000 可以用。

export const cachedEtf = defineCachedFunction(
  (symbol: string) => businessFetch<EtfDetail>(`/etfs/${symbol}`),
  // 規模、受益人數是月報，淨值與折溢價每天變；6 小時夠新
  { name: 'etf-detail', getKey: symbol => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

export const cachedEtfDistributions = defineCachedFunction(
  (symbol: string) => businessFetch<EtfDistributions>('/market/etf-distributions', { query: { symbol } }),
  { name: 'etf-distributions', getKey: symbol => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

// 28 檔一次讀完；個別頁與 sitemap 共用
export const cachedPreferredStocks = defineCachedFunction(
  async () => (await businessFetch<{ entries: PreferredStockEntry[] }>('/stocks/preferred-stocks')).entries,
  { name: 'preferred-stocks', getKey: () => 'all', maxAge: HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

// 只要最後兩個有成交的交易日（摘要卡的股價與漲跌）；拿 5 天是為了跳過收盤價 0 的無成交日（isRealClose）
export const cachedLatestClose = defineCachedFunction(
  async (symbol: string): Promise<LatestClose | null> => {
    const response = await businessFetch<{ entries: { tradeDate: string; close: number }[] }>(`/stocks/${symbol}/daily-price-history`, { query: { limit: 5 } })
    const closes = [...(response.entries ?? [])].filter(isRealClose).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    const last = closes.at(-1)
    if (!last) return null
    const previous = closes.at(-2)
    const change = previous ? Number((last.close - previous.close).toFixed(4)) : null
    return {
      tradeDate: last.tradeDate,
      price: last.close,
      change,
      changePercent: previous && change !== null ? Number(((change / previous.close) * 100).toFixed(2)) : null
    }
  },
  { name: 'latest-close', getKey: symbol => symbol, maxAge: HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

// sitemap 用的 ETF 代號清單：POST /etf-screener 一頁最多 200 筆（2026-10-15 共 339 檔，兩頁）
const ETF_PAGE_SIZE = 200

export const cachedEtfSymbols = defineCachedFunction(
  async (): Promise<string[]> => {
    const symbols: string[] = []
    for (let page = 1; ; page += 1) {
      const response = await businessFetch<{ totalPages: number; results: { symbol: string }[] }>('/etf-screener', {
        method: 'POST',
        body: { columns: [{ field: 'market' }], page, pageSize: ETF_PAGE_SIZE }
      })
      symbols.push(...response.results.map(row => row.symbol))
      if (page >= response.totalPages) return symbols
    }
  },
  { name: 'etf-symbols', getKey: () => 'all', maxAge: TTL_STATIC, swr: true }
)
