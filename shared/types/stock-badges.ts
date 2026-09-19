// Wire shape of bff-ts's GET /stocks/:symbol/badges (pure passthrough of analysis-ts's per-company
// badge evaluation) — shared by useStockBadges.ts (re-exported there) and server/utils/stock-data.ts.

export interface StockBadgeEntry {
  metricCode: string
  name: string
  nameEn: string
  timeframe: string
  value: number | null
  nullReason: string | null
  passed: boolean | null
  // knowledgeDateIsFallback=true means the value is stamped with the fiscal-period-end date
  // because the real filing-announcement date isn't available. Both null with no data at all.
  knowledgeDate: string | null
  knowledgeDateIsFallback: boolean | null
}

export interface StockBadgeCategory {
  categoryKey: string
  categoryDisplayName: string
  badges: StockBadgeEntry[]
}

export interface StockBadges {
  symbol: string
  categories: StockBadgeCategory[]
}
