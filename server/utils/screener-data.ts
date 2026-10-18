import type { EtfDetail, EtfDistributions, EtfHolders, EtfMonthlyPoint, EtfPremiumMonth, LatestClose, PreferredStockEntry } from '#shared/types/screener-detail'

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

// ETF 第二批面向（2026-10-18，業務中台 f667085 轉發 analysis-ts 6189b3d）。每月快照歷史（2024-01 起）原樣
export const cachedEtfMonthlyHistory = defineCachedFunction(
  async (symbol: string): Promise<EtfMonthlyPoint[]> => (await businessFetch<{ entries: EtfMonthlyPoint[] }>(`/etfs/${symbol}/monthly-history`)).entries ?? [],
  { name: 'etf-monthly-history', getKey: symbol => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

// 每日折溢價彙總成每月的平均、最高、最低：0050 全歷史 5,410 天約 428KB，快取與頁面都只放彙總（約 270 個月）。沒成交的日子上游 null，不算。
// 淨值與收盤價沒有還原分割，但折溢價是同一天的市價對淨值，不受分割影響
export const cachedEtfPremiumMonths = defineCachedFunction(
  async (symbol: string): Promise<EtfPremiumMonth[]> => {
    const { entries } = await businessFetch<{ entries: { tradeDate: string; premiumDiscountPct: number | null }[] }>(`/etfs/${symbol}/daily-nav`)
    const months = new Map<string, number[]>()
    for (const day of entries ?? []) {
      if (day.premiumDiscountPct === null) continue
      const month = day.tradeDate.slice(0, 7)
      months.set(month, [...(months.get(month) ?? []), day.premiumDiscountPct])
    }
    return [...months].map(([month, values]) => ({
      month,
      tradingDays: values.length,
      average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100,
      highest: Math.max(...values),
      lowest: Math.min(...values)
    }))
  },
  { name: 'etf-premium-months', getKey: symbol => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)

// 集保股權分散（每週，2026-09-18 起）：15 個級距併成 5 組畫圖（用每級的股數上限分，不寫死級數），最新一週的 15 級原樣給表格。
// 第 16 級（調整）與第 17 級（合計）不畫
const HOLDER_GROUPS = [
  { name: '不到 1 張', upTo: 999 },
  { name: '1～10 張', upTo: 10_000 },
  { name: '10～100 張', upTo: 100_000 },
  { name: '100～1,000 張', upTo: 1_000_000 },
  { name: '1,000 張以上', upTo: Infinity }
]
export const cachedEtfHolders = defineCachedFunction(
  async (symbol: string): Promise<EtfHolders> => {
    type Level = EtfHolders['latestLevels'][number] & { levelKind: string }
    const { entries } = await businessFetch<{ entries: { dataDate: string; levels: Level[] }[] }>(`/etfs/${symbol}/shareholding-distribution`)
    const weeks = (entries ?? []).map(({ dataDate, levels }) => {
      const brackets = levels.filter(level => level.levelKind === 'bracket')
      return {
        dataDate,
        groups: HOLDER_GROUPS.map((group, index) => {
          const members = brackets.filter(level => (level.maxShares ?? Infinity) <= group.upTo && (index === 0 || (level.maxShares ?? Infinity) > HOLDER_GROUPS[index - 1]!.upTo))
          return { name: group.name, holders: members.reduce((sum, level) => sum + level.holders, 0), custodyPct: Math.round(members.reduce((sum, level) => sum + level.custodyPct, 0) * 100) / 100 }
        })
      }
    })
    const latest = entries?.at(-1)?.levels.filter(level => level.levelKind === 'bracket') ?? []
    return { weeks, latestLevels: latest.map(({ level, minShares, maxShares, holders, shares, custodyPct }) => ({ level, minShares, maxShares, holders, shares, custodyPct })) }
  },
  { name: 'etf-holders', getKey: symbol => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
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
