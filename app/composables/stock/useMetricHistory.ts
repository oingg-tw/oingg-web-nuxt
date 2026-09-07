// 'bvps' (每股淨值, basis=Q) passes through bff-ts as of 2026-09-07 — analysis-ts always accepted
// it, bff-ts's validator was stricter than the upstream and got loosened on request so the PB
// river (StockValuationRiverChart.vue) doesn't have to back it out of price / pbRatio.
export type MetricCode = 'eps' | 'bvps' | 'peRatio' | 'pbRatio' | 'roe' | 'roa'
export type MetricBasis = 'TTM' | 'Q' | 'Q_ANN'

export interface MetricHistoryEntry {
  fiscalYear: number
  fiscalQuarter: number
  value: number | null
  // e.g. 'insufficient_history' — not enough trailing quarters yet to compute this point, not
  // an error. A null value here means a real gap in the chart (ECharts leaves it un-connected
  // by default), never something to interpolate or zero-fill.
  nullReason: string | null
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
}

interface MetricHistoryResponse {
  symbol: string
  basis: MetricBasis
  total: number
  hasMore: boolean
  entries: MetricHistoryEntry[]
}

// roe/roa live on their OWN endpoints (GET /stocks/:symbol/roe-history,
// GET /stocks/:symbol/roa-history — confirmed live 2026-09-07), not metric-history's own
// metricCode switch — eps/peRatio/pbRatio share one endpoint with metricCode as a query param,
// roe/roa are each a dedicated path with no metricCode param at all. Both response shapes are
// otherwise identical (single value per period + total/hasMore), so this composable still
// presents one unified interface — callers don't need to know which underlying endpoint a
// given metricCode maps to.
function endpointPathFor(symbol: string, metricCode: MetricCode): string {
  if (metricCode === 'roe') return `/stocks/${symbol}/roe-history`
  if (metricCode === 'roa') return `/stocks/${symbol}/roa-history`
  return `/stocks/${symbol}/metric-history`
}

// bff-ts's GET /stocks/:symbol/metric-history (confirmed live 2026-09-07, proxying
// analysis-ts's own endpoint — see StockMetricHistoryChart.vue's own comment for which
// metricCode/basis pairs are real). Symbol is a PATH param here, not a query param, matching
// this app's existing financial-statement/capital-stock-history convention — NOT
// /companies/metric-history?symbol=..., an earlier assumption corrected once bff-ts actually
// built the passthrough. Confirmed live: basis isn't fixed per metricCode the way this app
// happens to use it — eps accepts both TTM and Q, only peRatio/pbRatio are basis-locked (TTM-
// only / Q-only respectively) — an invalid pairing 400s with analysis-ts's own descriptive
// message rather than a swallowed 502, though every call site here only ever passes a valid,
// hardcoded pair so this should never actually trigger in practice. roe/roa (added 2026-09-07)
// both accept ['Q', 'Q_ANN', 'TTM'], defaulting to TTM.
//
// eps/peRatio/pbRatio (metric-history) are backfilled for 2330 only as of this date; roe/roa
// have broader coverage already (bff-ts confirmed live 2026-09-07 even 2317 has data, some
// quarters null with nullReason "insufficient_history" rather than the whole symbol being
// empty). Either way, a symbol with no backfill at all currently comes back with an empty
// `entries` array (not an error) — the chart component's own empty state covers that uniformly
// alongside a genuine fetch failure, since this app can't tell "not backfilled yet" apart from
// "temporarily unreachable" and shouldn't fabricate a distinction either.
//
// UPDATE 2026-09-07 (later same day): the market-wide 2022Q1 floor described below is gone for
// 2330 specifically — mops-ts fixed a Q4-annual-figure-stored-as-quarterly bug (also corrected
// 2024Q4/2025Q1~Q3 peRatio(TTM) values, e.g. 2024Q4 14.47→24.31 — any locally cached values from
// before this fix are stale) plus a stray "only keep 5 years" filter on capital-stock history.
// 2330's peRatio/pbRatio/eps/bvps now have real, non-null values across the FULL 近5年 window
// (110Q3~115Q2, all 20 quarters) — no more partial-span caveat for this symbol. Left the
// original note below for context on why other symbols may still hit this floor; don't assume
// it's lifted market-wide just because 2330's own instance of it is gone.
//
// Even for 2330, real values only start 2022 Q1 (pbRatio) / 2022 Q4 (eps, peRatio — TTM needs
// 3-4 trailing quarters first) — confirmed with mops-ts 2026-09-07 this is a genuine, MARKET-
// WIDE floor in their own quarterly_income_statement backfill (241 companies hit the same
// wall, not a 2330-specific gap): 2021 has real coverage for Q3 only, 2020 is almost entirely
// uncovered. They've logged extending it as tech debt with no committed timeline — don't
// expect this floor to move without them separately announcing a re-backfill. A "近5年" window
// (limit=20, reaching back to ~2021 Q3) will legitimately show real data for only part of its
// span for any symbol until then; this is accurate, not a bug in this composable or the chart.
//
// `total`/`hasMore` (added to all of metric-history/roe-history/roa-history/dupont-history
// 2026-09-07) report the FULL available period count regardless of `limit` — used to disable
// a "近10年" tab up front when total is less than 40, rather than letting the user click it and
// discover the extra 20 quarters never actually existed (there's no `offset` param yet, so
// "hasMore" alone can't be paged through — it's purely a signal for whether to offer a wider
// window at all).
//
// Client-only/own-cache, same reasoning as useFinancialStatement.ts: no SSR benefit, and this
// needs to re-fetch whenever the caller's lookback-window tab (limit) changes.
type CachedHistory = { entries: MetricHistoryEntry[]; total: number } | null

// In-flight dedupe shared ACROSS composable instances, not per instance: since
// StockValuationRiverChart.vue (2026-09-07), three cards on the stock page all want eps/TTM at
// once (both rivers derive price from peRatio × eps, and the EPS card wants it outright) and
// both rivers want peRatio — with a per-instance guard each of them fired its own request
// before any could populate the shared cache (observed live: 6 requests for 3 distinct keys).
// Keyed by the same string as the cache; an entry only lives for the duration of one request,
// so holding this at module scope is safe on the server too (it never accumulates).
const inFlight = new Map<string, Promise<CachedHistory>>()

export function useMetricHistory(
  symbol: Ref<string | undefined>,
  metricCode: Ref<MetricCode>,
  basis: Ref<MetricBasis>,
  limit: Ref<number>
) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedHistory>>('metric-history-cache', () => ({}))
  const data = ref<MetricHistoryEntry[] | null>(null)
  const total = ref<number | null>(null)
  const pending = ref(false)

  async function fetchHistory(targetSymbol: string, key: string): Promise<CachedHistory> {
    try {
      const path = endpointPathFor(targetSymbol, metricCode.value)
      const query: Record<string, string | number> = { basis: basis.value, limit: limit.value }
      // Only metric-history's own endpoint takes metricCode — roe-history/roa-history have no
      // such param (the endpoint itself IS the metric).
      if (path.endsWith('/metric-history')) query.metricCode = metricCode.value
      const result = await $fetch<MetricHistoryResponse>(path, {
        baseURL: config.public.apiBase,
        retry: 0,
        query
      })
      return { entries: result.entries, total: result.total }
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[metric-history] GET ${config.public.apiBase}${endpointPathFor(targetSymbol, metricCode.value)} unavailable (${reason})`)
      }
      return null
    } finally {
      inFlight.delete(key)
    }
  }

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      total.value = null
      return
    }
    const key = `${targetSymbol}-${metricCode.value}-${basis.value}-${limit.value}`
    let cached: CachedHistory
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(key)
      if (!request) {
        request = fetchHistory(targetSymbol, key)
        inFlight.set(key, request)
      }
      cached = await request
      cache.value[key] = cached
    }
    // A slower response for a key the caller has since moved on from (fast tab click) must
    // not overwrite the newer state, nor clear `pending` while the newer request is still
    // out — "latest wins", same as the per-instance version had.
    const currentKey = symbol.value ? `${symbol.value}-${metricCode.value}-${basis.value}-${limit.value}` : null
    if (currentKey !== key) return
    pending.value = false
    data.value = cached?.entries ?? null
    total.value = cached?.total ?? null
  }

  watch([symbol, metricCode, basis, limit], load, { immediate: true })

  return { data, pending, total }
}
