// Whether screener result-table headers show their period suffix ("名稱（期間）", see
// formatFieldLabel in useFilterSchema.ts) AND each cell shows the real per-value asOfDate
// bff-ts added to /screener's response (2026-08-31 — see ScreenerFieldValue in
// useFilterSearch.ts) — one global toggle, not per-tab. Its own control lives in
// screener.vue, outside any SharedPresetFolder/column-preset tab, since flipping it affects
// every tab's table the same way — living inside one tab's folder body would wrongly imply
// it only applied there.
//
// Defaults to hidden: the per-cell asOfDate line is new information nothing showed before,
// not a stripped-down version of what was already there — matching the original ask
// ("多數呈現方式都會顯得擁腫", most ways of showing this look bloated) means opt-in, not
// opt-out.
export function useScreenerShowPeriod() {
  return useState('screener-show-column-period', () => false)
}
