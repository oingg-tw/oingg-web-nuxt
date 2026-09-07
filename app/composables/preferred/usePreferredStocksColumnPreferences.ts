// Uppercase (not 'all'/'contract-terms'/...) to match bff-ts's GET/PUT
// /users/me/preferred-stocks-preferences (confirmed live 2026-09-07 — SCREAMING_SNAKE_CASE,
// the same casing every other closed-set field of theirs uses) rather than translating case at
// the fetch boundary — same reasoning as StockExperienceMode's own CARD/ACCOUNTING rename.
export type ColumnPresetId = 'ALL' | 'CONTRACT_TERMS' | 'VALUATION' | 'CALL_RISK'

// Column identifiers for preferred-stocks/index.vue's drag-reorderable table — kept here
// (rather than only inside the page) so a future sync composable (see this file's own
// pending backend-persistence note) and the page component read/write the exact same
// useState-backed refs, the same relationship useStockCards.ts/useStockExperienceMode.ts have
// with useStockDetailPreferencesSync.ts.
export type ColumnId =
  | 'dividend-type'
  | 'participation'
  | 'liquidation'
  | 'issue-price'
  | 'issue-date'
  | 'redemption-terms'
  | 'price'
  | 'dividend-rate'
  | 'current-yield'
  | 'ytw'
  | 'ytc'
  | 'redemption-date'
  | 'redemption-risk'
  | 'premium-rate'
  | 'convexity-warning'

const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  'dividend-type',
  'participation',
  'liquidation',
  'issue-price',
  'issue-date',
  'redemption-terms',
  'price',
  'dividend-rate',
  'current-yield',
  'ytw',
  'ytc',
  'redemption-date',
  'redemption-risk',
  'premium-rate',
  'convexity-warning'
]

// Backend-synced as of 2026-09-07 via usePreferredStocksPreferencesSync.ts (bff-ts's GET/PUT
// /users/me/preferred-stocks-preferences) — useState here is still the source of truth the UI
// reads/writes moment-to-moment (same as useStockCards.ts's own visibleCardIds), the sync
// composable just keeps a signed-in account's saved choice applied on top of it.
export function usePreferredStocksColumnPreferences() {
  const activeColumnPresetId = useState<ColumnPresetId>('preferred-stocks-column-preset', () => 'ALL')
  const columnOrder = useState<ColumnId[]>('preferred-stocks-column-order', () => [...DEFAULT_COLUMN_ORDER])
  return { activeColumnPresetId, columnOrder }
}

// A saved columnOrder could predate a column type added to this app later (or, in dev, an HMR
// reload) — without backfilling, a missing id would never render at all once its group becomes
// visible (columnOrder drives the v-for that switches each <el-table-column> on), silently
// hiding a whole column for an existing account rather than just reading as "moved to the end"
// the way useDashboardCards.ts's own visibility-list backfill does. Appended in DEFAULT_COLUMN_
// ORDER's own order, not the saved list's, so newly-added columns land in a stable, predictable
// spot rather than wherever object key iteration happens to put them.
export function backfillColumnOrder(order: ColumnId[]): ColumnId[] {
  const missing = DEFAULT_COLUMN_ORDER.filter(id => !order.includes(id))
  return missing.length ? [...order, ...missing] : order
}
