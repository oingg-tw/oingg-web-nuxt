export type ColumnPresetId = 'all' | 'contract-terms' | 'valuation' | 'call-risk'

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
  'redemption-date',
  'redemption-risk',
  'premium-rate',
  'convexity-warning'
]

// Backend persistence requested from bff-ts 2026-09-07 ("這邊的欄位偏好也要可以被bff儲存") —
// not wired yet (waiting on their reply for the endpoint contract/enum casing, same
// GET/PUT-with-Bearer-token shape as useUserStockDetailPreferences.ts), but pulling the state
// out into useState now (instead of a page-local ref) means the eventual sync composable can
// read/write it exactly the way useStockDetailPreferencesSync.ts does for
// useStockExperienceMode.ts/useStockCards.ts, without another refactor later.
export function usePreferredStocksColumnPreferences() {
  const activeColumnPresetId = useState<ColumnPresetId>('preferred-stocks-column-preset', () => 'all')
  const columnOrder = useState<ColumnId[]>('preferred-stocks-column-order', () => [...DEFAULT_COLUMN_ORDER])
  return { activeColumnPresetId, columnOrder }
}
