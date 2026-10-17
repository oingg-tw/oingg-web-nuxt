import type { PreferredStockEntry } from '#shared/types/screener-detail'

// Shared by the preferred screener's 溢價率 column note and /preferred/[code] (detail
// view) so the two never quietly drift on how 溢價率/負凸性提示 are derived. A countdown
// helper (距贖回日 as "剩餘 X 年 Y 個月") lived here too until direct request ("我希望不要寫倒
// 數多久，請直接呈現日期") replaced every countdown display with the raw redemptionDate value —
// removed since nothing computed from it anymore.

// REDEMPTION_UNCONFIRMED_NOTE (贖回相關「待查證」文案) removed entirely 2026-09-14 — mops-ts
// dropped the preferredStock domain's redemption tables (unofficial MOPS ajax endpoint, no
// official replacement found in their 2026-09-13 sourcing audit), so redemptionDate/
// redemptionConditions come back null for every symbol going forward; the whole 贖回條款/贖回
// 日期 UI this note explained was removed from both consuming pages rather than left permanently
// showing "待查證" for everyone (git history of usePreferredStockList.ts, deleted 2026-10-15, has the full removal note).

// 負凸性提示 — analysis-ts no longer pre-thresholds this server-side (see premiumRate's own
// comment), so the >2% cutoff is now this app's own call to make, per analysis-ts's explicit
// note that the threshold decision moved to the frontend. Unchanged from the previous
// server-side behavior — just relocated, not a new judgment.
const NEGATIVE_CONVEXITY_PREMIUM_THRESHOLD_PCT = 2

export function hasNegativeConvexityWarning(stock: Pick<PreferredStockEntry, 'premiumRatePct'>): boolean {
  return stock.premiumRatePct !== null && stock.premiumRatePct > NEGATIVE_CONVEXITY_PREMIUM_THRESHOLD_PCT
}
