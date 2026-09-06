export type StockExperienceMode = 'novice' | 'pro' | 'accounting'

// Page-local, NOT shared with useDashboardExperienceMode.ts — conductor's 個股瀏覽.md §2.6
// originally argued for sharing the overview page's novice/pro state so a choice made there
// carries over here, but this page needs a third 會計模式 (accounting) that dashboard.vue has
// no equivalent concept for, per direct user request ("這一頁 改成 簡易 專家 會計 三模式"), so
// forcing dashboard.vue's shared two-value type to grow a third option it never uses would be
// the wrong direction. Shell only for now, same as dashboard's own mode toggle when it shipped:
// nothing downstream differentiates by mode yet beyond the existing novice "開發中" messaging —
// accounting-specific content (the professional/accounting-oriented view implied by "專業會計
// 版") is still to be designed. Defaults to 'pro' for the same reason
// useDashboardExperienceMode.ts does: that's what today's single layout already shows, so
// defaulting to anything else would silently change existing behavior.
export function useStockExperienceMode() {
  const mode = useState<StockExperienceMode>('stock-experience-mode', () => 'pro')
  return { mode }
}
