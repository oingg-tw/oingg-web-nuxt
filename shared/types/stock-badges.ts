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
  // Where this symbol sits in the whole market for this metric — present only on percentileRank
  // badges（threshold.percentileRank, e.g. 盈餘創新高前 20%）, absent on every absolute-threshold
  // badge. Typed 2026-09-21 when the first of that family got a page: the fields were already being
  // sent and simply had no declaration, so the page could say 符合 without saying WHERE in the
  // distribution — which on a relative threshold is the entire content of the verdict.
  //
  // Stated as a plain rank and percentile, never as a band label: 排名前段 is in this app's own
  // compliance register（shared/utils/compliance-words.ts）, and「第 203 名／共 1,297 檔」is the
  // objective form the /rank pages already use.
  percentile?: number | null
  rank?: number | null
  totalCount?: number | null
  // The metric value at the badge's percentile boundary — what「前 20%」comes to in the metric's
  // own unit（2026-09-22, analysis-ts 9b51128f / bff-ts 88315c1, requested from「前20%對應到多少
  // 研發密度？」）. Same unit and precision as `value`; null on every absolute-threshold badge.
  //
  // Can legitimately be 0（shareholderYield's boundary is a real 0 — a fifth of the market returns
  // nothing）, so the presence test is `!= null`, never truthiness. Which side of it counts as met
  // depends on the badge's own direction（catalog badge.threshold.percentileRank.direction）: an
  // `asc` badge like 應計項目比率最低十分位 passes BELOW its boundary. `passed` stays the only
  // verdict — this is for showing the line, not for re-deriving which side of it a company is on.
  thresholdValue?: number | null
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
