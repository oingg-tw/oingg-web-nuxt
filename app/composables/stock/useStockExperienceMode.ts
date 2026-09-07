export type StockExperienceMode = 'card' | 'accounting'

// Page-local, NOT shared with useDashboardExperienceMode.ts — this page's split is
// card-vs-accounting layout, not dashboard.vue's novice/pro content-depth split, so sharing
// its type would be the wrong direction. Originally a 簡易/專家/會計 three-way (novice/pro/
// accounting), collapsed to two per direct request ("個股瀏覽的介面選項 現在改名成 卡片 與
// 會計") — 簡易 and 專家 had never actually differentiated any content (both just showed the
// same card layout with a "開發中" toast), so they were the same option wearing two labels.
// Defaults to 'card' since that's what today's layout already shows.
export function useStockExperienceMode() {
  const mode = useState<StockExperienceMode>('stock-experience-mode', () => 'card')
  return { mode }
}
