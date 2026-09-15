import type { GuruBadgeCategory } from '~/utils/guru-badges'

// Shared between StockGuruBadgeCategoryCard.vue (writes its own category's fraction as it
// resolves) and stock/[code].vue's own tab labels (reads it to show "2/3" beside each category
// name — reported live: "Tab 右邊要顯示徽章達成的數字 比如 2/3") — el-tabs here isn't `lazy`, so
// all 8 category cards are already mounted and fetching scores concurrently regardless of which
// tab is active; this just exposes each card's own already-computed categoryFraction to its
// sibling tab label instead of the label recomputing (and re-fetching) the same thing itself. A
// category with zero real badges never writes an entry here — the tab label falls back to no
// fraction at all, same "don't show a control with nothing behind it" rule this app applies
// elsewhere, rather than showing a permanent "0/0" or "資料不足" next to every unrelated tab.
export function useGuruBadgeCategoryFractions() {
  return useState<Partial<Record<GuruBadgeCategory, string>>>('guru-badge-category-fractions', () => ({}))
}
