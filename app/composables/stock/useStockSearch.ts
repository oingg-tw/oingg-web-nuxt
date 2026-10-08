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

// Narrowing the union properly rather than asserting past it（2026-09-23）. The sentinel row has no
// `kind`, so every read of that field — the ETF/特別股 tags in both search dropdowns — and every
// call into routeFor() was a genuine type hole, not Element Plus noise: `item.kind` on a
// StockSuggestion really can be undefined at runtime, on exactly the row that must never navigate.
// The guard is the same check handleSelect already made by hand, given a name and a return type so
// the compiler can use it too.
export function isCompanyEntry(suggestion: StockSuggestion): suggestion is CompanyIndexEntry {
  return suggestion.code !== NO_MATCH_SENTINEL
}

// 用全市場的 useCompanyIndex() 比對（2026-09-11 取代 20 家的假清單，當時回報「searchbar有些證券代碼找不到」）。
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
    // 2026-09-11（「按下enter以後，下拉選單才跑出來，而且不會自己消失」）：el-autocomplete 的建議 popper 只在自己的 select 或
    // 真正的 blur 時關閉，清掉 keyword 兩者都不觸發，Enter 導頁後下拉會一直浮在目的頁上。blur 真正聚焦中的輸入框就等同點到
    // 外面，呼叫端（AppHeaderMenu／LandingStockSearch）不用各自拿 template ref。
    ;(document.activeElement as HTMLElement | null)?.blur()
    router.push(routeFor(entry))
  }

  // Element Plus types el-autocomplete's own @select payload as `Record<string, any>`, so the
  // handler has to accept that and narrow — a signature of `(item: StockSuggestion)` is not
  // assignable to it however correct it is about what actually arrives.
  function handleSelect(item: Record<string, unknown>) {
    const suggestion = item as unknown as StockSuggestion
    if (!isCompanyEntry(suggestion)) return
    goToStock(suggestion)
  }

  // 直接按 Enter 時取下拉清單的第一筆（同一個 searchUniverse 排序，所以就是畫面上第一個選項）；沒有吻合就提示。
  // 頁首、首頁搜尋與觀察清單的加入欄位共用（2026-10-08 觀察清單也要「按 Enter 直接帶入第一個選項」）。
  // 下拉清單有反白項目時，el-autocomplete 自己的 Enter 會先觸發 @select，呼叫端在那裡清掉 keyword，這裡就不會重複處理。
  function firstMatch(): CompanyIndexEntry | null {
    if (!keyword.value.trim()) return null
    const match = searchUniverse(keyword.value)[0]
    // 下拉還沒打開就按 Enter 時沒有地方顯示「找不到」那一列，所以用提示
    if (!match) ElMessage.warning(`找不到符合「${keyword.value}」的股票`)
    return match ?? null
  }

  function handleEnter() {
    const match = firstMatch()
    if (match) goToStock(match)
  }

  return { keyword, fetchSuggestions, handleSelect, handleEnter, firstMatch, isCompanyEntry, routeFor }
}
