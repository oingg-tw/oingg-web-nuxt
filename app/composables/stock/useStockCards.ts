export interface StockCardDef {
  id: string
  label: string
  category: string
  required?: boolean
}

// Order here drives both the "顯示卡片" picker's group order AND stock/[code].vue's section
// order (2026-09-02, per docs/ui-ux/網格排版美學與實踐.md + docs/investment-knowledge/基本面財報觀察年限分析.md redesign)
// — valuation/financial trend data comes before company-profile background info, since that's
// the actual decision-priority order for a retirement/存股 investor (see that page's own
// top-of-file comment for the full reasoning).
export const STOCK_CARD_CATEGORIES = ['估值河流圖', '財務數據', '公司資訊'] as const

// No 'summary' entry here anymore — StockSummaryCard renders unconditionally on the stock
// detail page (never gated behind isVisible), and the picker itself now sits directly on top
// of it (see StockSummaryCard's #actions slot) instead of teleporting off to the sidebar, so
// a disabled "基本資訊（必要）" checkbox in the list below it was just redundant noise: its
// own position already says "this is the card you can't turn off."
//
// '策略評分' (six-axis radar) category removed entirely — its only card (StockRadarChart) was
// driven by literal `Math.round(30 + random()*60)` scores with no real per-stock analysis
// behind them, which read as a genuine評分 to users. Per explicit product direction: don't
// keep fake-looking-real data on this page even gated behind a toggle. Revisit only if/when a
// real per-stock scoring endpoint exists.
// 'share-capital' added 2026-09-04 as a shell only. See
// docs/investment-knowledge/基本面財報觀察年限分析.md's own "股權稀釋歷史" section for why this matters to
// a 存股 investor: EPS growth propped up by repeated share dilution isn't real growth, only a
// flat/buyback-shrinking share count is.
//
// Confirmed with analysis-ts (2026-09-04) — the real data exists but isn't wireable yet:
// mops-ts's 股本變化 IS mirrored (`export.capital_stock_history`), fields are
// symbol/effective_year/effective_month/paid_in_shares (actual share count, not thousands) plus
// four breakout flags (source_cash_increase/source_capital_reserve_transfer/
// source_retained_earnings_transfer/source_merger_increase — no 庫藏股 or 可轉債轉換 field exists).
// It's an EVENT series (one row per actual capital change), not a fixed quarterly/annual
// snapshot — a given year can have zero or several rows. But there's currently NO public API for
// it at all — it's only consumed internally by a per-share-metric helper
// (getPaidInSharesAsOf). Wiring this card up for real needs analysis-ts to stand up a new
// endpoint first (their own call, still pending), not just a schema lookup — don't build
// against this until that endpoint exists.
export const STOCK_CARD_DEFS: StockCardDef[] = [
  { id: 'profile', label: '公司詳細資料', category: '公司資訊' },
  { id: 'per-river', label: '本益比河流圖', category: '估值河流圖' },
  { id: 'pbr-river', label: '本淨比河流圖', category: '估值河流圖' },
  { id: 'eps', label: '四季 EPS', category: '財務數據' },
  { id: 'revenue', label: '月營收年增率', category: '財務數據' },
  { id: 'share-capital', label: '股本變化', category: '財務數據' }
]

// Local-only for now; the visible-card selection will move to a per-user DB record later.
export function useStockCards() {
  const visibleCardIds = useState<string[]>('stock-detail-visible-cards', () =>
    STOCK_CARD_DEFS.map(card => card.id)
  )

  // useState's factory only ever runs the first time this key is created — an existing
  // session (or, in dev, an HMR reload that keeps client state around across an edit) that
  // already had this key set before a new card was added to STOCK_CARD_DEFS would otherwise
  // never see that card in visibleCardIds at all, reading as "the user turned it off" even
  // though they never had the chance to. Backfill any def id missing from an already-created
  // list so a newly-added card still defaults to visible.
  for (const def of STOCK_CARD_DEFS) {
    if (!visibleCardIds.value.includes(def.id)) visibleCardIds.value.push(def.id)
  }

  function isVisible(id: string) {
    const def = STOCK_CARD_DEFS.find(card => card.id === id)
    return def?.required || visibleCardIds.value.includes(id)
  }

  return { cardDefs: STOCK_CARD_DEFS, categories: STOCK_CARD_CATEGORIES, visibleCardIds, isVisible }
}
