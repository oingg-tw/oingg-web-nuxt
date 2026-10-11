// Wire types moved to shared/types/metric-provenance.ts 2026-09-20 so server/utils/stock-data.ts's
// Nitro cache layer can share them (see that file's own comment); re-exported here so every
// existing import keeps working, same pattern as useStockBadges.ts.
export type { MetricProvenanceEntry, MetricProvenanceResponse } from '#shared/types/metric-provenance'
import type { MetricProvenanceResponse } from '#shared/types/metric-provenance'

// GET /stocks/:symbol/metric-provenance (業務中台 proxy of analysis-ts's own
// GET /companies/:symbol/metric-provenance, requested 2026-09-10 — see guru-badges.ts's own
// PROVENANCE_PILOT_METRIC_CODES comment for why only 3 metricCodes are wired up). Live via
// 業務中台 as of 2026-09-20 (confirmed: /stocks/2330/metric-provenance?metricCode=roe returns real
// entries) — the badge-page family (app/pages/stock/[code]/[slug].vue) is its first SSR consumer,
// via server/utils/stock-data.ts's cachedMetricProvenance rather than this composable directly.
type CachedProvenance = MetricProvenanceResponse | null

const inFlight = new Map<string, Promise<CachedProvenance>>()

export function useMetricProvenance(symbol: Ref<string | undefined>, metricCode: Ref<string | null>) {
  const cache = useState<Record<string, CachedProvenance>>('metric-provenance-cache', () => ({}))
  const data = ref<MetricProvenanceResponse | null>(null)
  const pending = ref(false)
// 讀取失敗（2026-10-11）：4xx 是這個請求的正常答案（例如欄位不能查），照舊快取成 null；其他失敗不寫快取、報給全站
// 讀取失敗彈窗，重試＝重新 load()。原本一律快取 null，失敗之後整個 session 都當成「沒有資料」，重試也沒用。
  const failure = shallowRef<unknown>(null)
  watchLoadFailure(() => `metric-provenance:${symbol.value ?? ''}:${metricCode.value ?? ''}`, () => failure.value, () => load())

  async function fetchProvenance(targetSymbol: string, targetMetricCode: string): Promise<CachedProvenance> {
    try {
      return await apiFetch<MetricProvenanceResponse>(`/stocks/${targetSymbol}/metric-provenance`, { query: { metricCode: targetMetricCode } })
    } catch (error) {
      devWarn('metric-provenance', `GET ${BUSINESS_BASE}/stocks/${targetSymbol}/metric-provenance?metricCode=${targetMetricCode} unavailable`, error)
      if (classifyApiError(error).kind === 'client') return null
      throw error
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
      try {
        cached = await request
      } catch (error) {
        if (symbol.value === targetSymbol && metricCode.value === targetMetricCode) {
          failure.value = error
          pending.value = false
          data.value = null
        }
        return
      }
      cache.value[key] = cached
    }
    failure.value = null
    if (symbol.value !== targetSymbol || metricCode.value !== targetMetricCode) return
    pending.value = false
    data.value = cached
  }

  watch([symbol, metricCode], load, { immediate: true })

  return { data, pending }
}
