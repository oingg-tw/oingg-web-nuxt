import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'

// The wire types moved to shared/types/metrics-history.ts on 2026-09-19 so the Nitro cache layer
// (server/utils/stock-data.ts) can share them; re-exported here so every existing import keeps
// working. MetricsHistoryEntry.values: a metricCode with zero backfilled data for a period comes
// back as bare JSON `null` for that key (not an object, not a missing key) — confirmed by bff-ts
// 2026-09-10 after a real 500 (commit 91e2bca: their own normalization code read `.value` off it
// without a null check). Every read site here uses `?.value` optional chaining, which safely
// short-circuits to `undefined` on a null entry.
export type { MetricsHistoryPoint, MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'

// 期別只有 'Q'／'TTM'／'FY'：'Q_ANN'（單季×4 年化）2026-09-14 短暫存在過、同日被 analysis-ts 全面移除（054ae0b），用過它的指標
// 都退回 TTM（它們也沒有 Q）。'FY' 同日補進型別——chowderNumber／dividendGrowthRateNy 這類只有 FY 的指標早就在執行期傳 'FY' 成功，
// 只是型別沒列。
// 本地詞彙叫 timeframe（2026-09-14，「後端用語現在叫做 timeframe」），但 bff-ts 對外的 query 參數仍是 `basis`（Zod schema
// `basis: z.string()`，他們刻意維持對外契約），所以下面的 wire key 還是 `basis:`。

interface MetricsHistoryResponse {
  symbol: string
  metricCodes: string[]
  basis: MetricsHistoryTimeframe
  total: number
  hasMore: boolean
  entries: MetricsHistoryEntry[]
}

// bff-ts's GET /stocks/:symbol/metrics-history (confirmed live 2026-09-09, commit b5167a3) — a multi-metric shape:
// each entry carries a `values` object keyed by metricCode (not one bare `value`), since this
// endpoint fetches several metricCodes together in one request/response instead of one call
// per metric. Originally built for the growth-decomposition card family (EPS 成長分解/淨值成長
// 分解 — Q timeframe only, analysis-ts 400s "TTM" for that metric set). Timeframe parameterized
// 2026-09-09 once the dividend-quality card family needed the SAME multi-metric endpoint but for
// a TTM-only metric set (dividendPayoutRatio/dividendCoverageRatio/buybackYield — confirmed live
// these reject "Q") — each metricCode set here is timeframe-locked on analysis-ts's own side, so
// every call site still only ever passes one fixed timeframe, this composable just no longer
// hardcodes which one. limit defaults 20/max 40. Only 2330 has data as of this date for most of these
// metricCode sets (analysis-ts's own backfill note) — this composable doesn't special-case
// sparse data, the chart component's own empty/sparse-state handling covers it the same way
// every other early-backfill card here already does.
export type CachedHistory = { entries: MetricsHistoryEntry[]; total: number } | null

// The useState('metrics-history-cache') key for one symbol × metricCodes (in call order) ×
// timeframe × limit. Exported (2026-09-19) so useStockPageDigest can pre-warm this exact cache
// during SSR: a card whose own useMetricsHistory() call resolves to the same key then takes the
// synchronous cache-hit path in load() below and renders real content in the server HTML.
export function metricsHistoryCacheKey(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number): string {
  return `${targetSymbol}-${codes.join(',')}-${targetTimeframe}-${targetLimit}`
}

// Superset index（2026-09-19, the SEO build）: every series useStockPageDigest pre-warms is also
// listed here with its request parameters, so a card asking for a SUBSET of one of them（same
// symbol and timeframe, codes ⊆ cached codes, limit ≤ cached limit）can be served from it — the
// digest's five 20-quarter groups on 公司健檢 then cover every series card on that page in SSR
// with no request of their own. bff-ts returns the ascending LAST N periods, so the projection
// (pick the requested codes, keep the trailing `limit` entries) is exactly what the smaller
// request would have returned, and it's computed identically on the server and the client.
export interface MetricsHistorySupersetEntry {
  symbol: string
  timeframe: MetricsHistoryTimeframe
  codes: string[]
  limit: number
  // The 'metrics-history-cache' key holding the full series.
  key: string
}

export function useMetricsHistorySupersetIndex() {
  return useState<MetricsHistorySupersetEntry[]>('metrics-history-superset-index', () => [])
}

export function projectMetricsHistory(source: Exclude<CachedHistory, null>, codes: string[], limit: number): Exclude<CachedHistory, null> {
  const entries = source.entries.slice(-limit).map(entry => {
    const values: MetricsHistoryEntry['values'] = {}
    for (const code of codes) values[code] = entry.values[code] ?? null
    return { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, values }
  })
  return { entries, total: source.total }
}

// Cross-instance in-flight dedupe — each card's own
// distinct metricCodes+timeframe combination mainly guards against a fast lookback-window tab
// click re-firing the same in-flight request twice, not cross-card sharing (the key includes both
// the joined metricCodes string and timeframe, so different cards never collide).
const inFlight = new Map<string, Promise<CachedHistory>>()

// bff-ts caps this endpoint at 10 metricCodes per request ("metricCodes 最多 10 個") — a real
// 400 discovered live 2026-09-13 once StockHistoricalStatisticsTable.vue started requesting
// every available indicator by default (60+ codes) instead of a small fixed set every existing
// caller happened to stay under. Chunked transparently here (parallel requests, merged by
// period) so every caller — the existing small ones and this new large one — gets one combined
// result and never has to know the limit exists.
const MAX_METRIC_CODES_PER_REQUEST = 10

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function useMetricsHistory(symbol: Ref<string | undefined>, metricCodes: Ref<string[]>, timeframe: Ref<MetricsHistoryTimeframe>, limit: Ref<number>) {
  const cache = useState<Record<string, CachedHistory>>('metrics-history-cache', () => ({}))
  const supersetIndex = useMetricsHistorySupersetIndex()
  const data = ref<MetricsHistoryEntry[] | null>(null)
  const total = ref<number | null>(null)
  const pending = ref(false)

  const keyFor = metricsHistoryCacheKey

  // A pre-warmed series that contains this request（see MetricsHistorySupersetEntry）— projected
  // and written under this request's own key so the next load() is a plain cache hit.
  function projectFromSuperset(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number, key: string): CachedHistory | undefined {
    const superset = supersetIndex.value.find(entry =>
      entry.symbol === targetSymbol && entry.timeframe === targetTimeframe && entry.limit >= targetLimit && codes.every(code => entry.codes.includes(code))
    )
    if (!superset) return undefined
    const source = cache.value[superset.key]
    if (!source) return undefined
    const projected = projectMetricsHistory(source, codes, targetLimit)
    cache.value[key] = projected
    return projected
  }

  async function fetchOneChunk(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number): Promise<CachedHistory> {
    try {
      const result = await apiFetch<MetricsHistoryResponse>(`/stocks/${targetSymbol}/metrics-history`, {
        // Wire query key stays `basis` — see this file's own top comment.
        query: { metricCodes: codes.join(','), basis: targetTimeframe, limit: targetLimit }
      })
      return { entries: result.entries, total: result.total }
    } catch (error) {
      devWarn('metrics-history', `GET ${BFF_BASE}/stocks/${targetSymbol}/metrics-history unavailable`, error)
      return null
    }
  }

  // Merges each chunk's own entries by fiscalYear/fiscalQuarter — chunks share the same symbol/
  // timeframe/limit so their period sets line up, but merge by key rather than assuming identical
  // array order/length regardless (a chunk that 400s independently must not misalign the rest).
  async function fetchHistory(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number, key: string): Promise<CachedHistory> {
    try {
      const codeChunks = chunk(codes, MAX_METRIC_CODES_PER_REQUEST)
      const results = await Promise.all(codeChunks.map(codeChunk => fetchOneChunk(targetSymbol, codeChunk, targetTimeframe, targetLimit)))
      const successful = results.filter((result): result is Exclude<CachedHistory, null> => result !== null)
      if (successful.length === 0) return null
      const byPeriod = new Map<string, MetricsHistoryEntry>()
      for (const result of successful) {
        for (const entry of result.entries) {
          const periodKey = `${entry.fiscalYear}-${entry.fiscalQuarter}`
          const existing = byPeriod.get(periodKey)
          if (existing) Object.assign(existing.values, entry.values)
          else byPeriod.set(periodKey, { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, values: { ...entry.values } })
        }
      }
      const entries = [...byPeriod.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || (a.fiscalQuarter ?? 0) - (b.fiscalQuarter ?? 0))
      return { entries, total: Math.max(...successful.map(result => result.total)) }
    } finally {
      inFlight.delete(key)
    }
  }

  async function load() {
    const targetSymbol = symbol.value
    const codes = metricCodes.value
    if (!targetSymbol || codes.length === 0) {
      data.value = null
      total.value = null
      return
    }
    const targetTimeframe = timeframe.value
    const targetLimit = limit.value
    const key = keyFor(targetSymbol, codes, targetTimeframe, targetLimit)
    let cached: CachedHistory
    const projected = key in cache.value ? undefined : projectFromSuperset(targetSymbol, codes, targetTimeframe, targetLimit, key)
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else if (projected !== undefined) {
      cached = projected
    } else {
      pending.value = true
      // Client-only fetch on a cache miss — see useStockBadges.ts's own identical guard for why
      // (SSR takes the pending branch, never fires the request; a cache hit — e.g. one pre-warmed
      // by useStockPageDigest — still renders in SSR).
      if (import.meta.server) return
      let request = inFlight.get(key)
      if (!request) {
        request = fetchHistory(targetSymbol, codes, targetTimeframe, targetLimit, key)
        inFlight.set(key, request)
      }
      cached = await request
      cache.value[key] = cached
    }
    // "Latest wins" — a slower response for a
    // key the caller has since moved on from (fast tab click) must not overwrite newer state.
    const currentKey = symbol.value ? keyFor(symbol.value, metricCodes.value, timeframe.value, limit.value) : null
    if (currentKey !== key) return
    pending.value = false
    data.value = cached?.entries ?? null
    total.value = cached?.total ?? null
  }

  watch([symbol, metricCodes, timeframe, limit], load, { immediate: true })

  return { data, pending, total }
}
