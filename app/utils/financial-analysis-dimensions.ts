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
// Order reshuffled 2026-09-10 per direct request ("市場評價要放在第一個。跟後端脫鉤。") — 市場評價
// moved to the front. Deliberately a pure frontend display decision, NOT derived from or kept in
// sync with analysis-ts's own schema/category order (they happen to have independently put
// 市場評價 first too in a same-day change to their own screener taxonomy, cross-session message —
// pure coincidence this order agrees with theirs, not something this array reads from them or
// should be re-synced to if theirs changes again).
// 財務韌性 → 安全韌性 2026-09-21（「財務韌性 改叫安全韌性」, then「跟他們說要全面改為安全韌性」）.
// Renamed HERE rather than at each use site because every display name in this app derives from
// this array — `FinancialAnalysisDimension` is `typeof FINANCIAL_ANALYSIS_DIMENSIONS[number]`, so
// changing the literal made TypeScript enumerate every consumer instead of leaving it to a grep.
//
// This is a FRONTEND display taxonomy, not a mirror of the backend's. analysis-ts renamed their
// own category the same day（8f7b4ddd）so the two now agree, but they are still independent:
// guru-badges.ts maps analysis-ts's stable category KEY（`resilience`）to whatever this array
// says, precisely so a backend copy tweak can't reach these strings. The one place the backend's
// literal string is still load-bearing is SCREENER_TEMPLATE_SLUGS in hub-slugs.ts, which is keyed
// by bff-ts's own PresetTemplate NAME — that template is a same-name coincidence, still called
// 財務韌性, and its key must NOT be renamed with this one.
export const FINANCIAL_ANALYSIS_DIMENSIONS = ['市場評價', '股東回饋', '獲利品質', '獲利能力', '成長動能', '安全韌性'] as const

export type FinancialAnalysisDimension = (typeof FINANCIAL_ANALYSIS_DIMENSIONS)[number]
