// Shared category order for the 6 financial-analysis dimensions used by BOTH the guru badge
// system (guru-badges.ts's own GURU_BADGE_CATEGORIES) and the stock-detail card grouping
// (useStockCards.ts's own STOCK_CARD_CATEGORIES) — split out 2026-09-09 per direct request
// ("stock-guru-badge-card__grid 這邊的排序 以及 個股瀏覽排序也比照") after the same underlying
// problem that broke the screener's own category order (see MoleculeIndicatorPickerBody.vue's
// own sortedCategories comment): two independently hardcoded lists that happen to agree today
// but have no mechanism keeping them that way. GURU_BADGE_CATEGORIES previously documented this
// explicitly as a DELIBERATE non-sharing decision ("nothing requires the two lists to move in
// lockstep") — reversed here per direct instruction, since that's exactly the kind of drift risk
// this whole investigation was about.
//
// Each of the two consumers still appends its own extra, non-shared category on top of this
// (GURU_BADGE_CATEGORIES adds 營運周轉/大戶籌碼, STOCK_CARD_CATEGORIES adds 公司資訊) — this
// only owns the 6 they genuinely have in common, not a merged superset either one is forced to
// fully adopt.
export const FINANCIAL_ANALYSIS_DIMENSIONS = ['股東回饋', '獲利品質', '獲利能力', '成長動能', '財務韌性', '市場評價'] as const

export type FinancialAnalysisDimension = (typeof FINANCIAL_ANALYSIS_DIMENSIONS)[number]
