export interface DashboardCardDef {
  id: string
  label: string
  category: string
}

export const DASHBOARD_CARD_CATEGORIES = ['排行', '警示'] as const

export const DASHBOARD_CARD_DEFS: DashboardCardDef[] = [
  { id: 'margin-short-ratio', label: '券資比排行前20', category: '排行' },
  { id: 'revenue-ranking', label: '月營收排行', category: '排行' },
  { id: 'volume-top20', label: '成交量前20', category: '排行' },
  { id: 'attention-stock', label: '今日注意股票', category: '警示' },
  { id: 'disposed-stocks', label: '處置股清單', category: '警示' }
]

// Local-only, same pattern and same caveat as useStockCards.ts: the visible-card selection
// lives in useState (per-device, resets on cleared storage), not a backend record. Worth
// revisiting once this or the stock-detail picker has enough real usage to justify the
// backend round-trip — see project_stock_card_persistence_deferred memory for that call.
export function useDashboardCards() {
  const visibleCardIds = useState<string[]>('dashboard-visible-cards', () =>
    DASHBOARD_CARD_DEFS.map(card => card.id)
  )

  // Backfill any def id missing from an already-created list (existing session, or an HMR
  // reload in dev) so a newly-added card defaults to visible instead of reading as "the user
  // turned it off" when they never had the chance to — same reasoning as useStockCards.ts.
  for (const def of DASHBOARD_CARD_DEFS) {
    if (!visibleCardIds.value.includes(def.id)) visibleCardIds.value.push(def.id)
  }

  function isVisible(id: string) {
    return visibleCardIds.value.includes(id)
  }

  return { cardDefs: DASHBOARD_CARD_DEFS, categories: DASHBOARD_CARD_CATEGORIES, visibleCardIds, isVisible }
}
