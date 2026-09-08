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
// Field-ID format breaking change confirmed live with bff-ts 2026-09-08, TWICE the same day:
// (1) analysis-ts rebuilt its query layer on pitMetrics after the old filterCatalog mechanism
// was retired — the "<metricKey>.<fieldKey>" scheme is unchanged in SHAPE (still
// "<metric.key>.<field.key>" off GET /filters, see useFilterSchema.ts's own
// locateFieldInSchema), but the actual keys underneath it changed: metric keys became the bare
// metricCode (peRatio, not per; pbRatio, not pbr) and field keys became a basis/token code
// (TTM/Q/etc). (2) Same day, analysis-ts split that single "basis" concept into 4 precisely-
// named fields (periodType/lookbackRange/samplingInterval/snapshotCadence) — most tokens were
// unaffected (TTM/Q stayed TTM/Q), but the market-snapshot token renamed DAILY→EOD, affecting
// dividendYield here. Re-verified each string live via curl against GET /screener/ranking
// before each edit — don't assume a token is stable without checking GET /filters again.
export type ValuationRankingField = 'dividendYield.EOD' | 'peRatio.TTM' | 'pbRatio.Q'

// 殖利率 wants the highest first; 本益比/淨值比 want the lowest first — bff-ts's own
// recommendation, matches how each metric reads as "better" in the doc's neutral sense (higher
// income yield vs. lower price-to-fundamentals).
const DIRECTION: Record<ValuationRankingField, 'asc' | 'desc'> = {
  'dividendYield.EOD': 'desc',
  'peRatio.TTM': 'asc',
  'pbRatio.Q': 'asc'
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

  // useAsyncData's own `pending` only tracks ITS OWN execute cycle — this watch mutates
  // `asyncData.data` directly from outside that cycle, so `pending` never flips true for an
  // uncached field switch. Not currently reachable via ValuationRankingCard.vue (it passes a
  // static field ref per instance, so this watch never fires there — see that file's own
  // comment), but fixed here too for defensive correctness, matching the same gap found live
  // on RevenueRankingCard/useEtfRanking.ts, in case a future caller ever drives `field` from a
  // real toggle.
  const switching = ref(false)

  watch(field, async targetField => {
    const cached = cache.value[targetField]
    if (cached) {
      asyncData.data.value = cached
      return
    }
    switching.value = true
    try {
      const result = await fetchField(targetField)
      cache.value[targetField] = result
      asyncData.data.value = result
    } finally {
      switching.value = false
    }
  })

  return {
    ...asyncData,
    pending: computed(() => asyncData.pending.value || switching.value)
  }
}
