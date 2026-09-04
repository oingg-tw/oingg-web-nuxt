import type { Stock } from '~/composables/stock/useStocks'

// el-autocomplete has no built-in empty-state slot — its own popper only ever opens when the
// suggestions array is non-empty (see its source: `suggestionVisible` is
// `suggestions.length > 0 || loading`), so there's no way to show a "沒有符合結果" row via a
// real empty list. This sentinel is a non-selectable row injected into that same array instead,
// filtered back out before it could ever navigate anywhere (see handleSelect below) — not a
// fabricated Stock, just enough shape to render its own message in the dropdown.
export const NO_MATCH_SENTINEL = '__no_match__'

export interface NoMatchSuggestion {
  code: typeof NO_MATCH_SENTINEL
  name: string
}

export type StockSuggestion = Stock | NoMatchSuggestion

export function useStockSearch() {
  const { searchUniverse } = useStocks()
  const router = useRouter()

  const keyword = ref('')

  function fetchSuggestions(query: string, callback: (results: StockSuggestion[]) => void) {
    const matches = searchUniverse(query)
    if (matches.length === 0 && query.trim()) {
      callback([{ code: NO_MATCH_SENTINEL, name: '找不到符合的股票代號或名稱' }])
      return
    }
    callback(matches)
  }

  function goToStock(code: string) {
    keyword.value = ''
    router.push(`/stock/${code}`)
  }

  function handleSelect(item: StockSuggestion) {
    if (item.code === NO_MATCH_SENTINEL) return
    goToStock(item.code)
  }

  function handleEnter() {
    if (!keyword.value.trim()) return
    const matches = searchUniverse(keyword.value)
    if (matches.length > 0) {
      goToStock(matches[0]!.code)
    } else {
      // Covers pressing Enter directly (e.g. before the dropdown has even opened) — the
      // sentinel row above covers the same "no match" case while the dropdown is showing, but
      // this path has no dropdown to show it in.
      ElMessage.warning(`找不到符合「${keyword.value}」的股票`)
    }
  }

  return { keyword, fetchSuggestions, handleSelect, handleEnter }
}
