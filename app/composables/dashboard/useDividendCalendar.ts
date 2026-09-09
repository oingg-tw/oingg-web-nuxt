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
