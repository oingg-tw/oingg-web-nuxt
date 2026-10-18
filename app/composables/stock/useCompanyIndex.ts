export interface CompanyIndexEntry {
  code: string
  name: string
  // Which page a match should navigate to (see useStockSearch.ts's goToStock) — a common stock
  // resolves to /stock/{code}, but ETF/preferred-stock symbols don't have a real detail page
  // under that route at all (GET /companies/profile 404s for both, confirmed live with
  // analysis-ts) and would 404/render nonsense there. Both route to their own per-symbol pages
  // under /preferred/{code}（2026-10-18）and /screener/etf/{code}（2026-10-15）.
  kind: 'common' | 'preferred' | 'etf'
}

interface SecuritiesResponse {
  count: number
  limit: number
  offset: number
  entries: { symbol: string; name: string | null; type: 'COMMON' | 'PREFERRED' | 'ETF' }[]
}

const KINDS: Record<string, CompanyIndexEntry['kind']> = { COMMON: 'common', PREFERRED: 'preferred', ETF: 'etf' }

// 搜尋列的全市場代號／名稱索引（2026-09-11，「searchbar有些證券代碼找不到」：之前只對一份約 20 檔的寫死清單比對）。這裡只回答
//「這個代號／名稱存不存在、對到哪裡」。
//
// 2026-10-16 起只打 GET /securities：普通股、特別股、ETF 合併的目錄（含興櫃），每筆只有 symbol／name／type。原本湊三個來源——
// /stocks 三頁、/stocks/preferred-stocks、POST /etf-screener 兩頁——共 6 個請求、原始約 416 KB，搜尋只用得到代號與名稱（使用者：
//「如果改成該api可以自選欄位抓呢?」，業務中台 d299743 回覆這支早就有）。本機實測原始 146 KB、經 Nitro 壓縮 24 KB。
// 每頁 5000，一個請求拿完（業務中台 DEV 1bc349b／analysis-ts dec67ab 起，2026-10-16 本機與 DEV 都是 2,726 筆）；存託憑證也在上游排除了
//（使用者：「有10檔無台灣財報的存託憑證 可以跟上游說排除掉嗎?」）。迴圈留著：哪天超過 5000 筆照樣分頁拿完
const PAGE_LIMIT = 5000

export function useCompanyIndex() {
  async function fetchSecurities(): Promise<CompanyIndexEntry[]> {
    const entries: CompanyIndexEntry[] = []
    let offset = 0
    let total = Infinity
    while (offset < total) {
      const response = await apiFetch<SecuritiesResponse>('/securities', { baseURL: BUSINESS_CACHED_BASE, query: { limit: PAGE_LIMIT, offset } })
      total = response.count
      if (!response.entries.length) break
      for (const entry of response.entries) {
        const kind = KINDS[entry.type]
        if (!kind) continue
        // name 型別上可能是 null（本機 0 筆）。用代號頂上：搜尋會對 name 呼叫 toLowerCase()，一筆 null 就讓整個搜尋壞掉
        entries.push({ code: entry.symbol, name: entry.name ?? entry.symbol, kind })
      }
      offset += response.entries.length
    }
    return entries
  }

  const result = useAsyncData<CompanyIndexEntry[]>(
    'company-index',
    fetchSecurities,
    // Whole-market list, effectively static within a session — same "fetch once, reuse
    // everywhere" treatment useFilterSchema.ts's own getCachedData gives the filter catalog.
    //
    // Client-only (server: false + lazy, the dashboard's own lazy-fetch pattern) since 2026-09-19:
    // every consumer is a client-side interaction — the search bar (useStockSearch), the watchlist
    // name lookups and the holdings pages. (useStocks only reads it through useNuxtData since
    // 2026-10-16, without triggering a download: app.vue calls it on every page.) Fetching it during SSR cost ~6 upstream requests per page render AND
    // serialized the whole ~3,000-entry index into every page's payload; nothing a crawler reads
    // ever came from it.
    //
    // dedupe 'defer'：同一頁好幾個元件同時叫（兩份頁首的搜尋、摘要卡…），預設的 'cancel' 會讓後來的取消進行中的那次再重抓，
    // DEV 的 Lighthouse 量到全目錄下載兩次（每頁約 400 KiB，2026-10-16）；defer 讓大家等同一次
    { server: false, lazy: true, dedupe: 'defer', default: () => [], getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] }
  )
  watchLoadFailure('company-index', () => result.error.value, () => result.refresh(), { scope: 'section' })
  return result
}

// 持股頁的「代號 → 公司」對照（2026-10-17：5 頁原本各自從目錄建一份）。目錄查不到的代號會逐檔打 GET /stocks/{code}/profile 補簡稱，
// 這是業務中台的建議（已下市的也查得到）。查不到的情況有兩種：
// - 已下市。
// - 轉上市的空窗：從轉板當天到隔天 14:50 證交所名單更新，上市、上櫃兩邊的目錄都查不到這家公司。8908 欣雄 2026-10-16 轉上市時發現，
//   上游說每次轉上市都會這樣。
// 本機實測，當時目錄缺的 7 檔 profile 都有簡稱。
// 每檔在一個 session 裡只問一次，問不到的也不重試，就照舊只顯示代號。補來的都當普通股：只有普通股有 profile（ETF／特別股是 404）。
export function useCompanyLookup(codes: () => string[]) {
  const { data, status } = useCompanyIndex()
  const profileNames = useState<Record<string, string | null>>('company-profile-names', () => ({}))
  watch([codes, status], ([list, state]) => {
    // 目錄還沒讀到（讀取中或失敗）時不補，否則每一檔都會被當成缺的
    if (state !== 'success') return
    const known = new Set(data.value.map(entry => entry.code))
    for (const code of list) {
      if (known.has(code) || code in profileNames.value) continue
      profileNames.value[code] = null
      apiFetch<{ shortName: string | null }>(`/stocks/${code}/profile`, { baseURL: BUSINESS_CACHED_BASE })
        .then((profile) => { profileNames.value[code] = profile.shortName })
        .catch(() => {})
    }
  }, { immediate: true })
  return computed(() => {
    const byCode = new Map(data.value.map(entry => [entry.code, entry]))
    for (const [code, name] of Object.entries(profileNames.value)) if (name && !byCode.has(code)) byCode.set(code, { code, name, kind: 'common' })
    return byCode
  })
}
