import type { CompanyIndexEntry } from '~/composables/stock/useCompanyIndex'

// el-autocomplete has no built-in empty-state slot — its own popper only ever opens when the
// suggestions array is non-empty (see its source: `suggestionVisible` is
// `suggestions.length > 0 || loading`), so there's no way to show a "沒有符合結果" row via a
// real empty list. This sentinel is a non-selectable row injected into that same array instead,
// filtered back out before it could ever navigate anywhere (see handleSelect below) — not a
// fabricated company entry, just enough shape to render its own message in the dropdown.
export const NO_MATCH_SENTINEL = '__no_match__'
// 搜尋紀錄最後一列「清除搜尋紀錄」（2026-11-20）：也是下拉裡的一列，方向鍵＋Enter 選得到；做成下拉外面的按鈕的話，下拉是掛在 body 尾端的
// 浮層，鍵盤 Tab 走不到它
export const CLEAR_HISTORY_SENTINEL = '__clear_history__'

export interface NoMatchSuggestion {
  code: typeof NO_MATCH_SENTINEL | typeof CLEAR_HISTORY_SENTINEL
  name: string
}

// value：el-autocomplete 選了一列時寫回輸入框的字（它讀 item.value，2026-11-14）。少了這個鍵它寫回 undefined：主控台出現 Vue 的
// 「Invalid event arguments」，點「找不到」那一列還會把打的字清掉。公司那幾列寫什麼都一樣（每個呼叫端選了之後都自己改 keyword），
// 「找不到」那一列寫回原本打的字
export type StockSuggestion = (CompanyIndexEntry | NoMatchSuggestion) & { value: string }

// Narrowing the union properly rather than asserting past it（2026-09-23）. The sentinel row has no
// `kind`, so every read of that field — the ETF/特別股 tags in both search dropdowns — and every
// call into routeFor() was a genuine type hole, not Element Plus noise: `item.kind` on a
// StockSuggestion really can be undefined at runtime, on exactly the row that must never navigate.
// The guard is the same check handleSelect already made by hand, given a name and a return type so
// the compiler can use it too.
export function isCompanyEntry(suggestion: StockSuggestion): suggestion is StockSuggestion & CompanyIndexEntry {
  return suggestion.code !== NO_MATCH_SENTINEL && suggestion.code !== CLEAR_HISTORY_SENTINEL
}

// 用全市場的 useCompanyIndex() 比對（2026-09-11 取代 20 家的假清單，當時回報「searchbar有些證券代碼找不到」）。
// history：頁首、首頁與手機搜尋層開（useStockSearchHistory）。加入觀察清單、持股表單這些挑股票的框不開：選了是加進去，不是去看那一檔
export function useStockSearch(options: { history?: boolean } = {}) {
  const { data: companies } = useCompanyIndex()
  const router = useRouter()
  const recent = options.history ? useStockSearchHistory() : null

  const keyword = ref('')

  const searchUniverse = (query: string): CompanyIndexEntry[] => searchStocks(companies.value, query)

  function fetchSuggestions(query: string, callback: (results: StockSuggestion[]) => void) {
    // 還沒打字時是搜尋紀錄：el-autocomplete 一聚焦就用空字串問一次，所以電腦版聚焦就打開這份清單（沒有紀錄就不開）
    if (recent && !query.trim()) {
      const items = recent.history.value
      callback(items.length ? [...items.map(entry => ({ ...entry, value: entry.code })), { code: CLEAR_HISTORY_SENTINEL, name: '清除搜尋紀錄', value: '' }] : [])
      return
    }
    const matches = searchUniverse(query)
    if (matches.length === 0 && query.trim()) {
      callback([{ code: NO_MATCH_SENTINEL, name: '找不到符合的股票代號或名稱', value: query }])
      return
    }
    callback(matches.map(entry => ({ ...entry, value: entry.code })))
  }

  // ETF/preferred-stock matches don't resolve under /stock/{code} — see CompanyIndexEntry's own
  // `kind` comment for why each of the 3 routes here is the real, correct destination rather
  // than a single hardcoded path.
  function routeFor(entry: CompanyIndexEntry): string {
    if (entry.kind === 'preferred') return preferredStockPath(entry.code)
    if (entry.kind === 'etf') return etfPath(entry.code)
    return `/stock/${entry.code}`
  }

  function goToStock(entry: CompanyIndexEntry) {
    recent?.remember(entry)
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
    if (suggestion.code === CLEAR_HISTORY_SENTINEL) recent?.clear()
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

  return { keyword, fetchSuggestions, handleSelect, handleEnter, firstMatch, isCompanyEntry, routeFor, history: recent?.history, rememberSearch: recent?.remember, clearHistory: recent?.clear }
}
