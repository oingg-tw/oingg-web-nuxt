// Pilot batch for the per-stock methodology page template（/stock/{code}/f-score, 2026-09-19）.
//
// The page exists for every listed symbol, but whether it is INDEXABLE (and listed in the stocks
// sitemap) is limited to a small, deterministic batch first: the ~200 four-digit codes below 1600.
// This is the "小批先看索引率再決定要不要程式化鋪開" control from the stock-page SEO plan — Google's
// scaled-content policy is about pages that add no value, and a per-metric page on 1,583 stocks is
// exactly the shape that gets judged as a set, so the set is kept small until Search Console shows
// how the first batch is treated. Everything else renders the same page with `noindex, follow`.
//
// Lives in shared/utils (auto-imported on both sides) because the sitemap Nitro handler and the
// page itself must agree on the same rule — two copies would drift.
export const F_SCORE_PILOT_MAX_CODE = 1600

export function isFScorePilotSymbol(symbol: string): boolean {
  return /^\d{4}$/.test(symbol) && Number(symbol) < F_SCORE_PILOT_MAX_CODE
}
