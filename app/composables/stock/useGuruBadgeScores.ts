import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

interface ScreenerValuesResponse {
  count: number
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

interface GuruBadgeScoresCacheEntry {
  values: Record<string, ScreenerFieldValue | null>
  units: Record<string, string | null>
}

const REQUEST_TIMEOUT_MS = 15_000

// Same POST /screener/values per-symbol lookup useStockHealthCheck.ts already established for
// the dashboard's 個股健檢 card, parameterized by an arbitrary field list instead of a fixed
// HEALTH_CHECK_FIELDS constant — StockGuruBadgeCard.vue calls this with only the guru badges
// that have a real fieldId (see guru-badges.ts), so the categories with no real methodology yet
// never fire a request for a field that doesn't exist.
//
// Also returns each field's real `unit` from the response's own `columns` array (bff-ts shipped
// this live 2026-09-09 — every field now returns its real unit like "%"/"元"/"分" instead of
// null) — lets StockGuruBadgeCard.vue drop its own hardcoded UNIT_BY_BADGE_ID fallback dictionary
// that existed only because units used to come back null for every field (see
// project_screener_backend_outage memory).
// Real bug found live 2026-09-11 (reported: "從個股瀏覽切換到其他功能再跳轉回來，資料比如metrics
// 會被清空 而且沒有重新抓取") — this cache used to be keyed by `symbol` ALONE, but
// StockGuruBadgeCategoryCard.vue creates one independent call to this composable PER category
// tab (市場評價/股東回饋/獲利品質/...), each requesting a DIFFERENT subset of fieldIds for the
// SAME symbol. On first mount this went unnoticed: every category's own `cache.value[symbol] in
// cache` check ran before any of the 7 sibling requests had resolved (all `false`), so each one
// fired its own real fetch and set its own component-local `data`/`units` correctly regardless of
// what the shared cache object ended up holding — but whichever category's fetch resolved LAST
// won the shared `cache.value[symbol]` key, silently overwriting it with only THAT category's
// narrow field subset. On a later remount (navigate away and back — `cache` is a `useState`, so
// it survives the SPA round trip) every category's `load()` now hits that single stale, wrong-
// subset cache entry immediately, with no new network request at all: most of the fields it
// actually needs simply aren't in there, so scores.value comes back with the requested fieldIds
// mostly `undefined` → every badge chip reads as 尚無資料. Keying the cache by symbol AND the
// exact field-ID set (not the raw array — order/reference differs across otherwise-identical
// requests, e.g. Set iteration in StockGuruBadgeCategoryCard.vue's own fieldIds computed) fixes
// this at the root: each category's differently-scoped request now gets (and correctly reuses)
// its own cache slot instead of colliding with its siblings'.
function cacheKey(symbol: string, fieldIds: string[]): string {
  return `${symbol}::${[...fieldIds].sort().join(',')}`
}

export function useGuruBadgeScores(symbol: Ref<string | undefined>, fieldIds: string[]) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, GuruBadgeScoresCacheEntry | null>>('guru-badge-scores-cache', () => ({}))
  const data = ref<Record<string, ScreenerFieldValue | null> | null>(null)
  const units = ref<Record<string, string | null>>({})
  const pending = ref(false)

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol || !fieldIds.length) {
      data.value = null
      units.value = {}
      return
    }
    const key = cacheKey(targetSymbol, fieldIds)
    if (key in cache.value) {
      data.value = cache.value[key]?.values ?? null
      units.value = cache.value[key]?.units ?? {}
      return
    }
    pending.value = true
    try {
      const response = await $fetch<ScreenerValuesResponse>('/screener/values', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { symbols: [targetSymbol], columns: fieldIds.map(field => ({ field })) },
        timeout: REQUEST_TIMEOUT_MS
      })
      const values = response.results[0]?.values ?? null
      const fieldUnits = Object.fromEntries(response.columns.map(column => [column.field, column.unit]))
      cache.value[key] = { values: values ?? {}, units: fieldUnits }
      data.value = values
      units.value = fieldUnits
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[guru-badge-scores] POST ${config.public.apiBase}/screener/values unavailable (${reason})`)
      }
      cache.value[key] = null
      data.value = null
      units.value = {}
    } finally {
      pending.value = false
    }
  }

  watch(symbol, load, { immediate: true })

  return { data, units, pending }
}
