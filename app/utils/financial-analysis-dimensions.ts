// 六個財務分析構面的共用順序（2026-09-09，「stock-guru-badge-card__grid 這邊的排序 以及 個股瀏覽排序也比照」）：guru-badges.ts 的
// GURU_BADGE_CATEGORIES 以它為基底再加自己的兩類。兩份各自寫死的清單今天一致、明天不一定——篩選器的分類順序就這樣壞過（見
// ScreenerIndicatorPickerBody 的 sortedCategories）；個股卡片分組已刪，目前只有徽章這一個消費者，仍留著當單一來源。
export const FINANCIAL_ANALYSIS_DIMENSIONS = ['市場評價', '股東回饋', '獲利品質', '獲利能力', '成長動能', '安全韌性'] as const

export type FinancialAnalysisDimension = (typeof FINANCIAL_ANALYSIS_DIMENSIONS)[number]
