// Whether screener result-table column headers show their period suffix
// ("名稱（期間）", see formatFieldLabel in useFilterSchema.ts) or just the bare name — one
// global toggle, not per-tab. Its own control lives in screener.vue, outside any
// SharedPresetFolder/column-preset tab, since flipping it affects every tab's table the same
// way — living inside one tab's folder body would wrongly imply it only applied there.
export function useScreenerShowPeriod() {
  return useState('screener-show-column-period', () => true)
}
