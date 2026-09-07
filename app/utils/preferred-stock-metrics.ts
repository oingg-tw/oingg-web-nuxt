import type { PreferredStock } from '~/composables/preferred/usePreferredStockList'

// Shared by preferred-stocks/index.vue (list table) and preferred-stocks/[code].vue (detail
// view) so the two never quietly drift on how 溢價率/負凸性警示 are derived. A countdown
// helper (距贖回日 as "剩餘 X 年 Y 個月") lived here too until direct request ("我希望不要寫倒
// 數多久，請直接呈現日期") replaced every countdown display with the raw redemptionDate value —
// removed since nothing computed from it anymore.

// A null redemptionDate used to render as the flat assertion "無贖回條款" — per direct request
// ("不可以說無贖回條款...這個警示代表等待平台或是用戶自行查證"), that's not a claim this app
// can actually back: mops-ts's own source field is generic free text with no structural
// guarantee the absence of a parsed date means the clause genuinely doesn't exist (could just
// as easily be a data gap). Made concrete by direct follow-up ("公開資訊觀測站資料是人工上傳，
// 有作業風險，比如中鋼章程寫可贖回，但是觀測站上面沒有明寫") — MOPS's data is manually filed by
// each company, so a real charter-level redemption right can simply be missing from what got
// typed into the 觀測站 form, independent of any parsing limitation on this app's side. Both
// pages show a WarningFilled-flagged "待查證" instead of asserting an absence, carrying this
// same explanation as a tooltip/caption.
export const REDEMPTION_UNCONFIRMED_NOTE =
  '尚無明確資料可判斷是否具備贖回條款，非本站或用戶已確認為無。公開資訊觀測站資料由公司人工申報，可能有作業疏漏或未即時更新（例如公司章程已明定贖回權，觀測站卻未填寫），建議自行查證公開說明書或公告。'

// 溢價率 — 現價相對「發行價」的溢價幅度 = priceMinusIssuePrice ÷ issuePrice。Switched off the
// old callPrice-based derivation 2026-09-07 (callPrice was removed from PreferredStock entirely
// — always null, since redemptionConditions is free-format text with no reliable number to
// parse). analysis-ts confirmed live the same day that their own negativeConvexityWarning field
// is computed the same way ("現價相對發行價溢價 >2% 時為 true") — matching this derivation to
// theirs means the percentage shown here always agrees with their boolean, both keyed off real
// fields (priceMinusIssuePrice/issuePrice) this app already has.
export function premiumRate(stock: Pick<PreferredStock, 'issuePrice' | 'priceMinusIssuePrice'>): number | null {
  if (stock.issuePrice === null || stock.priceMinusIssuePrice === null || stock.issuePrice === 0) return null
  return (stock.priceMinusIssuePrice / stock.issuePrice) * 100
}

// 負凸性警示 — analysis-ts's own real field now (confirmed live 2026-09-07), not derived
// client-side: true when 現價相對發行價溢價 >2%. Kept as a thin wrapper (rather than every
// call site reading `stock.negativeConvexityWarning` directly) so both consuming pages stay in
// sync if the semantics ever change again.
export function hasNegativeConvexityWarning(stock: Pick<PreferredStock, 'negativeConvexityWarning'>): boolean {
  return stock.negativeConvexityWarning === true
}
