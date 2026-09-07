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
// 'share-capital' added 2026-09-04, wired to a real endpoint the same day
// (GET /companies/capital-stock-history — see useCapitalStockHistory.ts). See
// docs/investment-knowledge/基本面財報觀察年限分析.md's own "股權稀釋歷史" section for why this matters to
// a 存股 investor: EPS growth propped up by repeated share dilution isn't real growth, only a
// flat/buyback-shrinking share count is.
//
// 'ex-dividend' added 2026-09-04 as a shell only — twse-ts's export.ex_dividend_notice is real
// (109 rows in prod) but has no public API yet (confirmed with analysis-ts, same situation
// 股本變化 was in before its own endpoint existed). See StockExDividendCardShell.vue.
//
// 'roe'/'roa'/'dupont' added 2026-09-07, wired to analysis-ts's real GET
// /stocks/:symbol/roe-history|roa-history|dupont-history (see StockMetricHistoryChart.vue and
// StockDupontChart.vue's own comments) — no shell phase needed, the backend endpoints already
// existed by the time these cards were added.
//
// 'dupont-extended' added same day once analysis-ts shipped the 5-factor breakdown — a
// separate card from 'dupont' (per direct request: keep both, don't replace), reading the same
// underlying endpoint via StockDupontExtendedChart.vue.
export const STOCK_CARD_DEFS: StockCardDef[] = [
  { id: 'profile', label: '公司詳細資料', category: '公司資訊' },
  { id: 'per-river', label: '本益比河流圖', category: '估值河流圖' },
  { id: 'pbr-river', label: '本淨比河流圖', category: '估值河流圖' },
  { id: 'eps', label: '四季 EPS', category: '財務數據' },
  { id: 'revenue', label: '月營收年增率', category: '財務數據' },
  { id: 'share-capital', label: '股本變化', category: '財務數據' },
  { id: 'ex-dividend', label: '下次除權息', category: '財務數據' },
  { id: 'roe', label: 'ROE 趨勢', category: '財務數據' },
  { id: 'roa', label: 'ROA 趨勢', category: '財務數據' },
  { id: 'dupont', label: '杜邦分析（三因子）', category: '財務數據' },
  { id: 'dupont-extended', label: '杜邦分析（五因子）', category: '財務數據' }
]

// Backend-synced as of 2026-09-07 via useStockDetailPreferencesSync.ts (bff-ts's GET/PUT
// /users/me/stock-detail-preferences) — useState here is still the source of truth the UI
// reads/writes moment-to-moment (same as useDashboardCards.ts's own visibleCardIds), the sync
// composable just keeps a signed-in account's saved choice applied on top of it.
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
