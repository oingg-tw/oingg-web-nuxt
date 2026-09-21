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
  status: 'announced' | 'realized'
  paymentDate: string | null
  fiscalYear: number | null
  exDate: string
  exType: DividendCalendarExType
  stockDividendRatio: number | null
  subscriptionRatio: number | null
  subscriptionPricePerShare: number | null
  cashDividend: number | null
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
