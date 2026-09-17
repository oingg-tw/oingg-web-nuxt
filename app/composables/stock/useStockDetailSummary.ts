import type { Stock } from '~/composables/stock/useStocks'

// Extracted 2026-09-17 out of stock/[code].vue's own top-of-file logic (unchanged, just moved),
// per direct request ("整頁滑動的概念完全捨棄...只有Header部分會長相一樣") — 股利怎麼來/財務報表
// moved out to their own real routes (dividend-source.vue/financial-statements.vue), each needing
// the exact same StockSummaryCard header stock/[code].vue itself renders, so this is the shared
// slice both the main page and those new pages call instead of stock/[code].vue duplicating its
// own fetch/computed logic twice more. See stock/[code].vue's own git history for this logic's
// original comments (real bugs fixed: dividendYield mismatch 2026-09-14, /api/stocks 404 2026-09-14,
// change/volume 404 2026-09-14) — none of that reasoning changed, only its location.
export function useStockDetailSummary(code: Ref<string>) {
  const { data: summary, pending: summaryPending } = useStockSummary(code)
  const { data: profile, pending: profilePending } = useCompanyProfile(code)
  const { data: priceHistory } = useDailyPriceHistory(code, ref(2))

  const priceChange = computed<{ amount: number; percent: number; volume: number } | null>(() => {
    const entries = priceHistory.value
    if (!entries || entries.length < 2) return null
    const latest = entries[entries.length - 1]!
    const previous = entries[entries.length - 2]!
    if (previous.close === 0) return null
    const amount = latest.close - previous.close
    return { amount, percent: (amount / previous.close) * 100, volume: latest.volume }
  })

  const stock = computed<Stock | undefined>(() => {
    const price = summary.value?.price
    if (!price) return undefined
    const valuation = summary.value?.valuation ?? null
    return {
      code: code.value,
      name: profile.value?.name ?? code.value,
      price: price.close,
      change: priceChange.value?.amount ?? null,
      changePercent: priceChange.value?.percent ?? null,
      per: valuation?.peRatio ?? null,
      pbr: valuation?.pbRatio ?? null,
      dividendYield: valuation?.dividendYield ?? null,
      volume: priceChange.value?.volume ?? null,
      marketCapB: null
    }
  })

  const stockShortName = computed(() => profile.value?.shortName ?? stock.value?.name ?? code.value)
  const stockPending = computed(() => !stock.value && (summaryPending.value || profilePending.value))

  const { watchlistCodes, addStock, removeStock } = useStocks()
  const isFavorite = computed(() => !!stock.value && watchlistCodes.value.includes(stock.value.code))

  function toggleFavorite() {
    if (!stock.value) return
    if (isFavorite.value) {
      removeStock(stock.value.code)
    } else {
      addStock(stock.value.code)
    }
  }

  return { summary, profile, stock, stockShortName, stockPending, isFavorite, toggleFavorite }
}
