import type { StatementType } from '~/composables/stock/useFinancialStatement'

export interface MetricProvenanceEntry {
  role: string
  fiscalYear: number
  fiscalQuarter: number
  // No fixed type on the wire — bff-ts confirmed live 2026-09-10: most entries are
  // bigint-serialized strings (raw statement figures, e.g. "706561938"), but chowderNumber's
  // cash-dividend-yield "market snapshot" entry comes back as a plain float (0.92) instead.
  // Never assume string; formatProvenanceValue() in the consuming component checks the type.
  value: string | number
  type: 'statementField' | 'other'
  // Only present on `type: 'statementField'` — fieldKey exact-matches
  // GET /stocks/:symbol/financial-statement's own keys (analysis-ts's own guarantee, cross-
  // checked against that endpoint for every entry on their side), which is what lets
  // jumpToStatementRow() use it directly as a StockFinancialStatementsCard.vue row key with no
  // second lookup table.
  statementType?: StatementType
  fieldKey?: string
  // Only present on `type: 'other'` (market price snapshots, share-count filings, etc.) — no
  // jump-to-source destination exists for these, just a plain description.
  sourceDescription?: string
}

export interface MetricProvenanceResponse {
  symbol: string
  metricCode: string
  found: boolean
  fiscalYear: number | null
  fiscalQuarter: number | null
  value: number | null
  entries: MetricProvenanceEntry[]
  // Non-null only when the full computation isn't itemized (e.g. SUE's 20-quarter stddev
  // sample) — explains the gap instead of silently showing a partial list with no context.
  methodologyNote: string | null
}

// GET /stocks/:symbol/metric-provenance (bff-ts proxy of analysis-ts's own
// GET /companies/:symbol/metric-provenance, requested 2026-09-10 — see guru-badges.ts's own
// PROVENANCE_PILOT_METRIC_CODES comment for why only 3 metricCodes are wired up). Not live via
// bff-ts yet as of this file's own creation (still 404s — request sent, not yet actioned) — same
// "fails quiet, no dev-only content shown" contract as every other composable here once bff-ts
// ships it, nothing to change on this side.
type CachedProvenance = MetricProvenanceResponse | null

const inFlight = new Map<string, Promise<CachedProvenance>>()

export function useMetricProvenance(symbol: Ref<string | undefined>, metricCode: Ref<string | null>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedProvenance>>('metric-provenance-cache', () => ({}))
  const data = ref<MetricProvenanceResponse | null>(null)
  const pending = ref(false)

  async function fetchProvenance(targetSymbol: string, targetMetricCode: string): Promise<CachedProvenance> {
    try {
      return await $fetch<MetricProvenanceResponse>(`/stocks/${targetSymbol}/metric-provenance`, {
        baseURL: config.public.apiBase,
        query: { metricCode: targetMetricCode },
        retry: 0
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[metric-provenance] GET ${config.public.apiBase}/stocks/${targetSymbol}/metric-provenance?metricCode=${targetMetricCode} unavailable (${reason})`)
      }
      return null
    }
  }

  async function load() {
    const targetSymbol = symbol.value
    const targetMetricCode = metricCode.value
    if (!targetSymbol || !targetMetricCode) {
      data.value = null
      return
    }
    const key = `${targetSymbol}-${targetMetricCode}`
    let cached: CachedProvenance
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(key)
      if (!request) {
        request = fetchProvenance(targetSymbol, targetMetricCode).finally(() => inFlight.delete(key))
        inFlight.set(key, request)
      }
      cached = await request
      cache.value[key] = cached
    }
    if (symbol.value !== targetSymbol || metricCode.value !== targetMetricCode) return
    pending.value = false
    data.value = cached
  }

  watch([symbol, metricCode], load, { immediate: true })

  return { data, pending }
}
