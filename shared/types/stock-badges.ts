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
  // Explicit "this reading is a warning" tier, added by analysis-ts 2026-09-20 (commit 9d7a8141)
  // and mutually exclusive with `passed`. Only piotroskiFScore carries it so far, sourced from the
  // Wikipedia entry's own wording: 8–9 strong → passed, 0–2 weak → warning, 3–7 neither (both
  // false), no value → both null. Optional because the other 22 badges omit it entirely.
  warning?: boolean | null
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
