import type { Stock } from '~/composables/stock/useStocks'
import type { StockSummary } from '~/composables/stock/useStockSummary'
import type { DailyPriceHistoryEntry } from '~/composables/stock/useDailyPriceHistory'

// Real bug fixed 2026-09-14 (mock-data survey following the 2330 summary-card discrepancy report)
// — watchlist.vue/DashboardWatchlistExDividendCard.vue used to render useStocks().watchlist
// directly, which only ever held Stock objects sourced from MOCK_STOCK_UNIVERSE (see that file's
// own comment). This composable resolves the REAL per-symbol quote for every code currently in
// the watchlist, via the same GET /stocks/{symbol} endpoint stock/[code].vue now uses (see
// useStockSummary.ts's own comment) — one request per symbol, run in parallel. There is no
// batch/list quote endpoint yet (analysis-ts has this requested, unresolved as of this date), and
// a watchlist is small by nature (a handful to a few dozen symbols a user actually tracks), so
// N parallel single-symbol requests is the practical choice here, not a compromise made only for
// lack of a better option elsewhere.
//
// A symbol whose fetch fails (or whose summary has no `price` section) is DROPPED from the
// resolved list entirely rather than shown with fabricated/zeroed numbers — matches stock/
// [code].vue's own "no price = not usable" rule. `droppedCount` lets a caller show a small
// "N 檔股票暫時無法載入" note instead of silently shrinking the table with no explanation.
//
// change/changePercent/volume fetched separately per symbol, same day, same root cause as the
// "打2330出404" bug — bff-ts's real quote endpoint never had these 3 fields (see
// useStockSummary.ts's own comment), so they're derived here from the last 2 entries of each
// symbol's real daily OHLCV history instead (same derivation stock/[code].vue's own priceChange
// uses) — one extra parallel request per symbol, run alongside the quote requests, not after.
export function useWatchlistStocks(codes: Ref<string[]>) {
  const config = useRuntimeConfig()
  const { data: companies } = useCompanyIndex()

  const data = ref<Stock[]>([])
  const droppedCount = ref(0)
  const pending = ref(false)

  function deriveChange(entries: DailyPriceHistoryEntry[] | undefined): { amount: number; percent: number; volume: number } | null {
    if (!entries || entries.length < 2) return null
    const latest = entries[entries.length - 1]!
    const previous = entries[entries.length - 2]!
    if (previous.close === 0) return null
    const amount = latest.close - previous.close
    return { amount, percent: (amount / previous.close) * 100, volume: latest.volume }
  }

  async function load() {
    const targetCodes = codes.value
    if (targetCodes.length === 0) {
      data.value = []
      droppedCount.value = 0
      return
    }
    pending.value = true
    const [summaryResults, historyResults] = await Promise.all([
      Promise.allSettled(
        targetCodes.map(code => $fetch<StockSummary>(`/stocks/${code}`, { baseURL: config.public.apiBase, retry: 0 }))
      ),
      Promise.allSettled(
        targetCodes.map(code =>
          $fetch<{ symbol: string; entries: DailyPriceHistoryEntry[] }>(`/stocks/${code}/daily-price-history`, {
            baseURL: config.public.apiBase,
            retry: 0,
            query: { limit: 2 }
          })
        )
      )
    ])
    // "Latest wins" guard — same reasoning as every other composable here (useMetricsHistory.ts/
    // useMetricHistory.ts's own load()): a slow batch for a codes list the caller has since moved
    // on from must not overwrite newer state.
    if (codes.value !== targetCodes) return

    const resolved: Stock[] = []
    let dropped = 0
    summaryResults.forEach((result, index) => {
      const code = targetCodes[index]!
      const summary = result.status === 'fulfilled' ? result.value : null
      const price = summary?.price
      if (!price) {
        dropped += 1
        return
      }
      const valuation = summary?.valuation ?? null
      const historyResult = historyResults[index]
      const change = deriveChange(historyResult?.status === 'fulfilled' ? historyResult.value.entries : undefined)
      resolved.push({
        code,
        name: companies.value.find(company => company.code === code)?.name ?? code,
        price: price.close,
        change: change?.amount ?? null,
        changePercent: change?.percent ?? null,
        per: valuation?.peRatio ?? null,
        pbr: valuation?.pbRatio ?? null,
        dividendYield: valuation?.dividendYield ?? null,
        volume: change?.volume ?? null,
        marketCapB: null
      })
    })
    data.value = resolved
    droppedCount.value = dropped
    pending.value = false
  }

  watch(codes, load, { immediate: true, deep: true })

  return { data, pending, droppedCount }
}
