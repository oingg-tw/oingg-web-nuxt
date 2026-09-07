export type MetricCode = 'eps' | 'peRatio' | 'pbRatio' | 'roe' | 'roa'
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
export function useMetricHistory(
  symbol: Ref<string | undefined>,
  metricCode: Ref<MetricCode>,
  basis: Ref<MetricBasis>,
  limit: Ref<number>
) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, { entries: MetricHistoryEntry[]; total: number } | null>>('metric-history-cache', () => ({}))
  const data = ref<MetricHistoryEntry[] | null>(null)
  const total = ref<number | null>(null)
  const pending = ref(false)
  // Same duplicate-in-flight guard as useFinancialStatement.ts — this composable is called
  // once per chart card, each with its own watch({immediate:true}), so a fast prop change
  // (e.g. tab click right after mount) can otherwise overlap two requests for what becomes
  // the same eventual key.
  let inFlightKey: string | null = null

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      total.value = null
      return
    }
    const key = `${targetSymbol}-${metricCode.value}-${basis.value}-${limit.value}`
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
      cache.value[key] = { entries: result.entries, total: result.total }
      data.value = result.entries
      total.value = result.total
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[metric-history] GET ${config.public.apiBase}${endpointPathFor(targetSymbol, metricCode.value)} unavailable (${reason})`)
      }
      cache.value[key] = null
      data.value = null
      total.value = null
    } finally {
      inFlightKey = null
      pending.value = false
    }
  }

  watch([symbol, metricCode, basis, limit], load, { immediate: true })

  return { data, pending, total }
}
