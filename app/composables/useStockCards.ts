export interface StockCardDef {
  id: string
  label: string
  category: string
  required?: boolean
}

export const STOCK_CARD_CATEGORIES = ['基本資訊', '估值河流圖', '財務數據'] as const

export const STOCK_CARD_DEFS: StockCardDef[] = [
  { id: 'summary', label: '基本資訊', category: '基本資訊', required: true },
  { id: 'per-river', label: '本益比河流圖', category: '估值河流圖' },
  { id: 'pbr-river', label: '本淨比河流圖', category: '估值河流圖' },
  { id: 'eps', label: '四季 EPS', category: '財務數據' }
]

// Local-only for now; the visible-card selection will move to a per-user DB record later.
export function useStockCards() {
  const visibleCardIds = useState<string[]>('stock-detail-visible-cards', () =>
    STOCK_CARD_DEFS.map(card => card.id)
  )

  function isVisible(id: string) {
    const def = STOCK_CARD_DEFS.find(card => card.id === id)
    return def?.required || visibleCardIds.value.includes(id)
  }

  return { cardDefs: STOCK_CARD_DEFS, categories: STOCK_CARD_CATEGORIES, visibleCardIds, isVisible }
}
