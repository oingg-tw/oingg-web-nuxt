export type StockExperienceMode = 'CARD' | 'ACCOUNTING'

// Page-local, NOT shared with useDashboardExperienceMode.ts — this page's split is
// card-vs-accounting layout, not dashboard.vue's novice/pro content-depth split, so sharing
// its type would be the wrong direction. Originally a 簡易/專家/會計 three-way (novice/pro/
// accounting), collapsed to two per direct request ("個股瀏覽的介面選項 現在改名成 卡片 與
// 會計") — 簡易 and 專家 had never actually differentiated any content (both just showed the
// same card layout with a "開發中" toast), so they were the same option wearing two labels.
// Uppercase values (not 'card'/'accounting') to match bff-ts's own closed-set-field convention
// (theme.mode's LIGHT/DARK/SYSTEM, marketColorConvention's ASIA/WESTERN/ACCESSIBLE) ahead of
// wiring this up to their GET/PUT /users/me/stock-detail-preferences — this app already follows
// that casing as-is everywhere else (see ThemeMode in useAppTheme.ts) rather than translating
// case at the fetch boundary. Defaults to 'CARD' since that's what today's layout already shows.
export function useStockExperienceMode() {
  const mode = useState<StockExperienceMode>('stock-experience-mode', () => 'CARD')
  return { mode }
}
