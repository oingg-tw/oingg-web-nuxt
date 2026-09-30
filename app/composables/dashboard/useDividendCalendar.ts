export type DividendCalendarExType = '息' | '權' | '權息'

// Same field shape as useExDividendNotices.ts's own ExDividendNotice (see that file's own
// comment for what each field means / the subscription-group caveats), plus `symbol`/
// `companyName` — this endpoint returns a FLAT market-wide array, not grouped by symbol, so each
// entry needs its own identity fields. `companyName` is null for ETFs (confirmed live by bff-ts
// 2026-09-10 — analysis-ts's company-name lookup table doesn't cover funds) — not an error, show
// the symbol alone when it's null.
export interface DividendCalendarEvent {
  symbol: string
  companyName: string | null
  // 2026-09-22（「配息月曆可以查以前的歷史嗎」）— this endpoint used to be forward-looking ONLY,
  // fed by the 除權息預告表, so an entry vanished the moment its ex-date passed（measured before
  // the change: 2026-08 returned 0 rows, 2026-09 returned 109, 2026-10 returned 17）. analysis-ts
  // now merges the realised 分派公告 in behind the same `month` param（cf1b752e, bff-ts beeb0cb）.
  //
  // `status` is what keeps the two sources apart, and it matters on the CURRENT month too, not
  // just history: 2026-09 measured 97 realized + 10 announced. Enum-guarded on bff-ts's side.
  //
  // `paymentDate`/`fiscalYear` exist only on realised rows — an announced entry has no發放日 yet
  // by definition（2026-10: all 17 rows null on both）. Even among realised rows they're not
  // total（2026-08: 241/268 and 251/268）, so both stay optional at the render site.
  // 'ETF' | 'COMMON'（2026-09-30）。**判斷是不是 ETF 一律用這個欄位。**
  // 舊的判斷方式（companyName === null）已經失效：2026-09-10 bff-ts 說 ETF 沒有名稱是對的，
  // 現在 396/396 都有，那個條件永遠是 false。
  securityType: 'ETF' | 'COMMON' | null
  status: 'announced' | 'realized'
  paymentDate: string | null
  fiscalYear: number | null
  exDate: string
  exType: DividendCalendarExType
  stockDividendRatio: number | null
  subscriptionRatio: number | null
  subscriptionPricePerShare: number | null
  cashDividend: number | null
  // ETF 的每受益權單位分配金額（2026-09-30 接上）。**跟 cashDividend 是兩個欄位**：後者是個股的
  // 每股現金股利，而組成與基準日只有 ETF 有，所以上游分開放（他們 2026-09-23 的設計）。
  // 渲染取 `distributionPerUnit ?? cashDividend`——twse 的預告表也收了部分 ETF，同一組（除息日,
  // 代號）兩邊都有時才會兩個欄位都有值。
  //
  // 這個欄位曾經「上游有、我們沒有」長達一週：analysis-ts 09-23 就 join 好了，bff-ts 的欄位對映
  // 漏接，所以我們看到的 ETF 列全部沒有金額。實測才抓到（analysis 19 個欄位 vs bff 15 個）。
  distributionPerUnit: number | null
  recordDate: string | null
  // 配息組成的百分比，發行商的**預估**不是最終結算。五項**加起來不一定是 100**，缺的部分是
  // 「未揭露」——不可以併進 otherIncomePct，也不可以反推（實測 00404A 只加到 31.67）。
  // null 與 0 不同：0 是「揭露了而且是零」（96 筆 ETF 有 90 筆的 incomeEqualizationPct 是 0），
  // null 是「未揭露」，所以任何 falsy 判斷都會把前者說成後者。
  //
  // 金額還沒公布的列（distributionPerUnit 是 null），上游 2026-09-30 起一律把 composition 也回
  // null：來源在預告列放的是**上一次**的組成（00939 的 10-05 跟 09-01 逐字相同），不是這次的。
  composition: {
    dividendIncomePct: number | null
    interestIncomePct: number | null
    incomeEqualizationPct: number | null
    realizedCapitalGainPct: number | null
    otherIncomePct: number | null
  } | null
  sharesOffered: number | null
  sharesEmpOwner: number | null
  sharesholderOwner: number | null
  stockHoldingRatio: number | null
}

// GET /stocks/ex-dividend-calendar?month=YYYY-MM — bff-ts's own forwarding route onto
// analysis-ts's endpoint (confirmed live 2026-09-10, commit 41efef7 on bff-ts's side after a
// real routing-order bug: this path was initially shadowed by the existing `/stocks/:symbol`
// catch-all, same class of fix as bff-ts's own preferred-stocks/ex-dividend-notices precedent).
// Replaces useDividendCalendarMock.ts now that this is live — DashboardDividendCalendarCard.vue
// was deliberately built against this exact DividendCalendarEvent shape so swapping the
// composable needed no template/logic changes.
//
// A month with nothing scheduled returns a real empty array (not an error) — bff-ts confirmed
// this live. An invalid/missing `month` 400s with a descriptive message; every call site here
// always builds a valid "YYYY-MM" string, so that should never actually trigger in practice.
export function useDividendCalendar(month: Ref<string>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, DividendCalendarEvent[] | null>>('dividend-calendar-cache', () => ({}))
  const events = ref<DividendCalendarEvent[]>([])
  const pending = ref(false)

  async function load() {
    const key = month.value
    if (key in cache.value) {
      events.value = cache.value[key] ?? []
      return
    }
    pending.value = true
    try {
      const result = await $fetch<{ entries: DividendCalendarEvent[] }>('/stocks/ex-dividend-calendar', {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { month: key }
      })
      cache.value[key] = result.entries
      // "Latest wins" — a slower response for a month the caller has since navigated away from
      // must not overwrite the newer state, same guard as useMetricHistory.ts's own load().
      if (month.value === key) events.value = result.entries
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dividend-calendar] GET ${config.public.apiBase}/stocks/ex-dividend-calendar?month=${key} unavailable (${reason})`)
      }
      cache.value[key] = null
      if (month.value === key) events.value = []
    } finally {
      if (month.value === key) pending.value = false
    }
  }

  watch(month, load, { immediate: true })

  return { events, pending }
}
