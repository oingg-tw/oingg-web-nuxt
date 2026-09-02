import type { ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'

// Confirmed live with bff-ts 2026-09-02: GET /screener/ranking?field=&direction=&limit= — NOT
// /valuation/ranking (that path 404s; it's an internal analysis-ts route bff-ts calls behind
// the scenes, never exposed directly — conductor's mention of it was a business-side
// paraphrase, not the literal route). Params are field/direction (catalog-style full field
// names, not a short metric enum) rather than metric/order the way revenue-ranking/etf-ranking
// use — genuinely a different endpoint family (general screener ranking, not a market-specific
// one), so don't assume the same param names elsewhere. No stock.price field in the response —
// this endpoint only returns the ranked field's own value per symbol, nothing else. Guest-
// usable, no auth required.
export type ValuationRankingField = 'dividendYield.dividendYieldPct' | 'per.peRatio' | 'pbr.pbRatio'

// 殖利率 wants the highest first; 本益比/淨值比 want the lowest first — bff-ts's own
// recommendation, matches how each metric reads as "better" in the doc's neutral sense (higher
// income yield vs. lower price-to-fundamentals).
const DIRECTION: Record<ValuationRankingField, 'asc' | 'desc'> = {
  'dividendYield.dividendYieldPct': 'desc',
  'per.peRatio': 'asc',
  'pbr.pbRatio': 'asc'
}

export interface ValuationRanking {
  field: ValuationRankingField
  direction: 'asc' | 'desc'
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
}

function fallback(field: ValuationRankingField): ValuationRanking {
  return { field, direction: DIRECTION[field], columns: [], results: [] }
}

// Same per-field client-side cache pattern as useEtfRanking.ts (see its own comment) — a field
// already fetched this session is reused instead of refetched on every toggle switch.
export function useValuationRanking(field: Ref<ValuationRankingField>, limit = 20) {
  const config = useRuntimeConfig()
  const cache = useState<Partial<Record<ValuationRankingField, ValuationRanking>>>('valuation-ranking-cache', () => ({}))

  async function fetchField(targetField: ValuationRankingField): Promise<ValuationRanking> {
    try {
      return await $fetch<ValuationRanking>('/screener/ranking', {
        baseURL: config.public.apiBase,
        query: { field: targetField, direction: DIRECTION[targetField], limit }
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[valuation-ranking] GET ${config.public.apiBase}/screener/ranking unavailable (${reason})`)
      }
      return fallback(targetField)
    }
  }

  const asyncData = useAsyncData<ValuationRanking>(
    `valuation-ranking-${field.value}`,
    async () => {
      const targetField = field.value
      if (cache.value[targetField]) return cache.value[targetField]!
      const result = await fetchField(targetField)
      cache.value[targetField] = result
      return result
    },
    // lazy + server:false — same reasoning as every dashboard composable (see dashboard.vue's
    // own comment).
    { default: () => fallback(field.value), lazy: true, server: false }
  )

  watch(field, async targetField => {
    const cached = cache.value[targetField]
    if (cached) {
      asyncData.data.value = cached
      return
    }
    const result = await fetchField(targetField)
    cache.value[targetField] = result
    asyncData.data.value = result
  })

  return asyncData
}
