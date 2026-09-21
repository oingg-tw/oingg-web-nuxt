// Wire types moved to shared/types/metric-provenance.ts 2026-09-20 so server/utils/stock-data.ts's
// Nitro cache layer can share them (see that file's own comment); re-exported here so every
// existing import keeps working, same pattern as useStockBadges.ts.
export type { MetricProvenanceEntry, MetricProvenanceResponse } from '#shared/types/metric-provenance'
import type { MetricProvenanceResponse } from '#shared/types/metric-provenance'

// GET /stocks/:symbol/metric-provenance (bff-ts proxy of analysis-ts's own
// GET /companies/:symbol/metric-provenance, requested 2026-09-10 — see guru-badges.ts's own
// PROVENANCE_PILOT_METRIC_CODES comment for why only 3 metricCodes are wired up). Live via
// bff-ts as of 2026-09-20 (confirmed: /stocks/2330/metric-provenance?metricCode=roe returns real
// entries) — the badge-page family (app/pages/stock/[code]/[slug].vue) is its first SSR consumer,
// via server/utils/stock-data.ts's cachedMetricProvenance rather than this composable directly.
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
      // Client-only fetch on a cache miss — see useStockBadges.ts's own identical guard for why.
      if (import.meta.server) return
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
