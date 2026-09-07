export type DupontBasis = 'Q' | 'TTM'

export interface DupontHistoryEntry {
  fiscalYear: number
  fiscalQuarter: number
  netProfitMarginPct: number | null
  assetTurnover: number | null
  // Always null when basis is 'TTM' — equity multiplier is a balance-sheet point-in-time
  // snapshot, there's no trailing-four-quarter variant of it (confirmed live 2026-09-07).
  equityMultiplier: number | null
  decomposedRoePct: number | null
  nullReason: string | null
  // Extended 5-factor breakdown (netProfitMarginPct split further into tax burden × interest
  // burden × EBIT margin), added by analysis-ts 2026-09-07 to this SAME response — no separate
  // endpoint/param needed. dupontExtendedRoePct = dupontTaxBurdenPct × dupontInterestBurdenPct
  // × dupontEbitMarginPct × assetTurnover × equityMultiplier, confirmed live to equal
  // decomposedRoePct (both derive the same ROE, just decomposed into 3 vs 5 factors).
  dupontTaxBurdenPct: number | null
  dupontInterestBurdenPct: number | null
  dupontEbitMarginPct: number | null
  dupontExtendedRoePct: number | null
  // Deliberately separate from `nullReason` above — the 5-factor completeness check is
  // stricter (needs pre-tax profit/finance costs the 3-factor calc doesn't) and can disagree
  // with it in edge cases (decomposedRoePct computable while dupontExtendedRoePct isn't, or
  // vice versa). StockDupontExtendedChart.vue gates on THIS field, never on `nullReason`.
  dupontExtendedRoeNullReason: string | null
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
}

interface DupontHistoryResponse {
  symbol: string
  basis: DupontBasis
  total: number
  hasMore: boolean
  entries: DupontHistoryEntry[]
}

// bff-ts's GET /stocks/:symbol/dupont-history (confirmed live 2026-09-07, proxying
// analysis-ts's own endpoint). One response now carries BOTH the standard 3-factor DuPont
// decomposition (decomposedRoePct = netProfitMarginPct × assetTurnover × equityMultiplier) AND
// the extended 5-factor breakdown (dupontExtendedRoePct, splitting netProfitMarginPct further
// into tax burden × interest burden × EBIT margin) — StockDupontChart.vue reads the 3-factor
// fields, StockDupontExtendedChart.vue reads the 5-factor ones, both from this one composable/
// endpoint rather than fetching twice. This is a genuinely different response shape from
// useMetricHistory.ts's single-`value` series (a composite of several underlying metric_codes
// bundled into one entry, no `metricCode` field on the response at all), hence its own
// composable rather than reusing that one. Coverage is broader than metric-history's
// 2330-only backfill — bff-ts confirmed live even
// 2317 has real data (some quarters null with nullReason "insufficient_history", not the whole
// symbol empty). Unlike roe/roa (which also accept Q_ANN), this endpoint 400s on Q_ANN — only
// Q/TTM are valid here.
//
// allowedBases: ['Q', 'TTM'], defaulting to Q. StockDupontChart.vue exposes a 單季/近四季
// toggle over this (added 2026-09-07) — switching to TTM drops the equityMultiplier line
// entirely rather than showing a flat null series, with an explanatory note, since there's no
// TTM variant of a balance-sheet snapshot to show.
//
// Client-only/own-cache, same reasoning as useMetricHistory.ts/useFinancialStatement.ts.
export function useDupontHistory(symbol: Ref<string | undefined>, basis: Ref<DupontBasis>, limit: Ref<number>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, { entries: DupontHistoryEntry[]; total: number } | null>>('dupont-history-cache', () => ({}))
  const data = ref<DupontHistoryEntry[] | null>(null)
  const total = ref<number | null>(null)
  const pending = ref(false)
  let inFlightKey: string | null = null

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      total.value = null
      return
    }
    const key = `${targetSymbol}-${basis.value}-${limit.value}`
    if (key in cache.value) {
      const cached = cache.value[key]
      data.value = cached?.entries ?? null
      total.value = cached?.total ?? null
      return
    }
    if (inFlightKey === key) return
    inFlightKey = key
    pending.value = true
    try {
      const result = await $fetch<DupontHistoryResponse>(`/stocks/${targetSymbol}/dupont-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { basis: basis.value, limit: limit.value }
      })
      cache.value[key] = { entries: result.entries, total: result.total }
      data.value = result.entries
      total.value = result.total
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dupont-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/dupont-history unavailable (${reason})`)
      }
      cache.value[key] = null
      data.value = null
      total.value = null
    } finally {
      inFlightKey = null
      pending.value = false
    }
  }

  watch([symbol, basis, limit], load, { immediate: true })

  return { data, pending, total }
}
