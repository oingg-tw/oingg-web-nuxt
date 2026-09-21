import type { StatementType } from '~/composables/stock/useFinancialStatement'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'

export interface StatementRowFocusRequest {
  statementType: StatementType
  rowKey: string
  // Increments on every call — a click on the exact same row twice in a row (e.g. re-opening
  // the same badge dialog and jumping again) must still re-trigger the scroll/highlight in
  // StockFinancialStatementsCard.vue's own watch(), and watch() doesn't fire on a value that's
  // structurally equal to the last one.
  requestId: number
}

let nextRequestId = 0

// Shared across the page (not page-local ref) for the same reason
// useStockPeriodSelection/useStockExperienceMode are — the future caller (a badge dialog) and
// the receiver (StockFinancialStatementsCard.vue) are unrelated components with no parent/child
// relationship to pass this through props.
//
// Real bug caught live 2026-09-10: `useState()` must be called from inside a composable/setup
// function, never at this file's own module top level — a module-scope call runs once at import
// time, outside any active Nuxt instance, and throws "composable called outside of a plugin,
// Nuxt hook, Nuxt middleware, or Vue setup function" the moment anything imports this file
// (confirmed live via a 500 on /stock/2330 the instant StockFinancialStatementsCard.vue started
// importing this module). Every function below calls `useState()` itself instead of closing
// over a module-level ref — useState's own key-based caching already makes repeated calls with
// the same key return the same shared state, so this doesn't lose the "shared across callers"
// property, it just defers the call to a moment where a Nuxt instance actually exists.
function statementRowFocusState() {
  return useState<StatementRowFocusRequest | null>('statement-row-focus-request', () => null)
}

export function useStatementRowFocus() {
  return { focusRequest: statementRowFocusState() }
}

// Frontend-only groundwork for the "trace a badge's number back to the original filing" feature
// (2026-09-10 plan: 數字可回溯到原始申報資料) — this part has no backend dependency (unlike the
// still-pending provenance API request to analysis-ts), so it's built now and wired to a real
// caller once that API ships. Bundles the pieces of state a "jump to this exact row" action needs
// to touch.
//
// Real bug fixed 2026-09-18 — this used to just set `mode.value = 'ACCOUNTING'`, back when 卡片/
// 表格/會計 were three branches of ONE shared page (stock/[code]/index.vue) switched by that ref.
// Once 會計模式 was promoted to its own route (financial-statements.vue, see that page's own git
// history: "卡片 表格 會計 做在sidebar上面"), flipping the ref alone no longer navigated anywhere —
// this caller (StockHistoricalStatisticsTable.vue, now living on metrics-history.vue, a DIFFERENT
// route) needs a real cross-page navigation instead. year/quarter/requestId are still plain shared
// useState, so they already survive the navigation on their own; only the "which page" part needed
// to change from a ref write to a route push.
export async function jumpToStatementRow(target: { statementType: StatementType; rowKey: string; year: number; quarter: StockQuarter }) {
  const { year, quarter } = useStockPeriodSelection()
  year.value = target.year
  quarter.value = target.quarter
  nextRequestId += 1
  statementRowFocusState().value = { statementType: target.statementType, rowKey: target.rowKey, requestId: nextRequestId }
  const route = useRoute()
  await navigateTo(`/stock/${route.params.code}/financial-statements`)
  // No page-level scrollTo here — StockFinancialStatementsCard.vue's own watcher already calls
  // scrollIntoView() on the matched row (this being sighted at all is proof the accounting
  // section itself is in view, since scrolling a descendant into view brings every necessary
  // ancestor along with it). Real bug caught live 2026-09-10: this used to also call
  // `window.scrollTo({ top: 0 })` after an `await nextTick()` here — that nextTick resolves on
  // a different tick than the row watcher's own internal nextTick (triggered synchronously
  // during the child's setup, before this one even runs), so whichever scroll happened to
  // finish last silently overrode the other. Observed live: the row-focus scroll fired first,
  // then this scroll-to-top undid it a moment later, landing the user back at the page top
  // instead of on the row they clicked. StockFinancialStatementsCard.vue's own watcher keeps a
  // scroll-to-top fallback for the one case this function's own scroll used to also cover — the
  // target row not existing in that statement's row list.
}
