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
// analysis-ts's own endpoint). Standard 3-factor DuPont decomposition — decomposedRoePct =
// netProfitMarginPct × assetTurnover × equityMultiplier — NOT the extended 5-factor version
// (splitting out tax burden/interest burden/operating margin); analysis-ts hasn't built that.
// This is a genuinely different response shape from useMetricHistory.ts's single-`value`
// series (a composite of 4 underlying metric_codes bundled into one entry, no `metricCode`
// field on the response at all), hence its own composable rather than reusing that one.
// Coverage is broader than metric-history's 2330-only backfill — bff-ts confirmed live even
// 2317 has real data (some quarters null with nullReason "insufficient_history", not the whole
// symbol empty). Unlike roe/roa (which also accept Q_ANN), this endpoint 400s on Q_ANN — only
// Q/TTM are valid here.
//
// allowedBases: ['Q', 'TTM'], defaulting to Q. This app's own StockDupontChart.vue only ever
// requests 'Q' (see that component's own comment for why — TTM silently drops one of the three
// factor lines, which reads as a bug rather than an intentional basis difference unless the UI
// explains it, and this app hasn't built that explanation yet).
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
