import type { CompanyIndexEntry } from '~/composables/stock/useCompanyIndex'

// el-autocomplete has no built-in empty-state slot — its own popper only ever opens when the
// suggestions array is non-empty (see its source: `suggestionVisible` is
// `suggestions.length > 0 || loading`), so there's no way to show a "沒有符合結果" row via a
// real empty list. This sentinel is a non-selectable row injected into that same array instead,
// filtered back out before it could ever navigate anywhere (see handleSelect below) — not a
// fabricated company entry, just enough shape to render its own message in the dropdown.
export const NO_MATCH_SENTINEL = '__no_match__'

export interface NoMatchSuggestion {
  code: typeof NO_MATCH_SENTINEL
  name: string
}

export type StockSuggestion = CompanyIndexEntry | NoMatchSuggestion

// Switched from useStocks().searchUniverse (a ~20-company hardcoded mock list) to the real
// whole-market useCompanyIndex() 2026-09-11 — see that composable's own comment for the full
// story (reported live: "searchbar有些證券代碼找不到").
export function useStockSearch() {
  const { data: companies } = useCompanyIndex()
  const router = useRouter()

  const keyword = ref('')

  function searchUniverse(query: string): CompanyIndexEntry[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    // Real bug caught live while verifying preferred-stock search ("1101B" typed as "1101b"
    // returned nothing) — every common-stock code is pure digits, so this case-sensitivity gap
    // was invisible until preferred-stock codes (which end in a letter, e.g. "1101B") joined the
    // index. `needle` is already lowercased above; `company.code` wasn't, so a mixed-case code
    // could only ever match an exact-case query.
    return companies.value
      .filter(company => company.code.toLowerCase().startsWith(needle) || company.name.toLowerCase().includes(needle))
      .sort((a, b) => a.code.localeCompare(b.code))
  }

  function fetchSuggestions(query: string, callback: (results: StockSuggestion[]) => void) {
    const matches = searchUniverse(query)
    if (matches.length === 0 && query.trim()) {
      callback([{ code: NO_MATCH_SENTINEL, name: '找不到符合的股票代號或名稱' }])
      return
    }
    callback(matches)
  }

  // ETF/preferred-stock matches don't resolve under /stock/{code} — see CompanyIndexEntry's own
  // `kind` comment for why each of the 3 routes here is the real, correct destination rather
  // than a single hardcoded path.
  function routeFor(entry: CompanyIndexEntry): string {
    if (entry.kind === 'preferred') return `/preferred-stocks/${entry.code}`
    if (entry.kind === 'etf') return '/etf-zone'
    return `/stock/${entry.code}`
  }

  function goToStock(entry: CompanyIndexEntry) {
    keyword.value = ''
    // Real bug fixed 2026-09-11 (reported live: "按下enter以後，下拉選單才跑出來，而且不會自己
    // 消失") — el-autocomplete's own suggestion popper only auto-closes on its own `select`
    // event or a real blur; clearing `keyword` here doesn't trigger either, so after Enter
    // navigates away the dropdown (now showing whatever `fetchSuggestions('')` returned for the
    // just-cleared keyword) stayed floating open over the destination page indefinitely.
    // Blurring the actual focused input reproduces the same close-on-blur behavior a real click-
    // away would have triggered, without either caller (StockSearchBar.vue/LandingStockSearch.vue)
    // needing its own template ref into the autocomplete component just for this.
    ;(document.activeElement as HTMLElement | null)?.blur()
    router.push(routeFor(entry))
  }

  function handleSelect(item: StockSuggestion) {
    if (item.code === NO_MATCH_SENTINEL) return
    goToStock(item)
  }

  function handleEnter() {
    if (!keyword.value.trim()) return
    const matches = searchUniverse(keyword.value)
    if (matches.length > 0) {
      goToStock(matches[0]!)
    } else {
      // Covers pressing Enter directly (e.g. before the dropdown has even opened) — the
      // sentinel row above covers the same "no match" case while the dropdown is showing, but
      // this path has no dropdown to show it in.
      ElMessage.warning(`找不到符合「${keyword.value}」的股票`)
    }
  }

  return { keyword, fetchSuggestions, handleSelect, handleEnter }
}
