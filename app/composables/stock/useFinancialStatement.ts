export type StatementType = 'balanceSheet' | 'incomeStatement' | 'cashFlowStatement'

export interface FinancialStatementResponse {
  symbol: string
  statementType: StatementType
  year: string
  season: string
  reportDate: string
  found: boolean
  statement: Record<string, string | null> | null
}

// bff-ts's GET /stocks/:symbol/financial-statement (confirmed live 2026-09-06, backing
// StockFinancialStatementsCard.vue's 會計模式 three-statement tables) uses 民國年 (ROC year),
// confirmed against its own example: reportDate "2026-06-30" came back as year:"115"
// (1911 + 115 = 2026) — the picker itself (StockPeriodSelector.vue) stays in the western
// calendar users actually think in, so every request converts here instead.
function toRocYear(westernYear: number): number {
  return westernYear - 1911
}

// No useAsyncData here — this is 100% client-only, lazy, tab/period-driven (no SSR benefit,
// same reasoning useRevenueRanking.ts/useValuationRanking.ts give for server:false), and
// already needs its own cache + manual re-fetch-on-param-change, so useAsyncData's own
// machinery would just be redundant ceremony on top of that. `found:false` on the response
// means "no filing for this period" and is still a normal 200, not an error (per bff-ts's own
// contract) — cached and returned like any other successful result, not treated as a fetch
// failure.
export function useFinancialStatement(symbol: Ref<string | undefined>, statementType: Ref<StatementType>, year: Ref<number>, season: Ref<number>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, FinancialStatementResponse | null>>('financial-statement-cache', () => ({}))
  const data = ref<FinancialStatementResponse | null>(null)
  const pending = ref(false)
  // Guards against a duplicate in-flight request for the exact same key — observed live:
  // watch(..., { immediate: true }) combined with this composable being called twice per tab
  // (once for the current period, once for the prior-year comparison) produced two overlapping
  // fetches for the same key on mount, and whichever one's `finally` ran first left `pending`
  // stuck true after the other overwrote it back to true moments later.
  let inFlightKey: string | null = null

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      return
    }
    const key = `${targetSymbol}-${statementType.value}-${year.value}-${season.value}`
    if (key in cache.value) {
      data.value = cache.value[key]!
      return
    }
    if (inFlightKey === key) return
    inFlightKey = key
    pending.value = true
    try {
      const result = await $fetch<FinancialStatementResponse>(`/stocks/${targetSymbol}/financial-statement`, {
        baseURL: config.public.apiBase,
        // ofetch retries GET requests once by default on failure — against a genuinely
        // unreachable backend that just doubles the wait (and, observed live, the retry
        // attempt's own resolution timing left `pending` stuck true afterward). Fail fast
        // instead, same as this app's other backend calls expect to.
        retry: 0,
        query: { statementType: statementType.value, year: toRocYear(year.value), season: season.value }
      })
      cache.value[key] = result
      data.value = result
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[financial-statement] GET ${config.public.apiBase}/stocks/${targetSymbol}/financial-statement unavailable (${reason})`)
      }
      cache.value[key] = null
      data.value = null
    } finally {
      inFlightKey = null
      pending.value = false
    }
  }

  watch([symbol, statementType, year, season], load, { immediate: true })

  return { data, pending }
}
