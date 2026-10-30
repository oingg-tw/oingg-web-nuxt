import type { PreferredPageResponse } from '#shared/types/screener-detail'
import type { Stock } from '~/composables/stock/useStocks'

// 特別股個別頁四個面向共用的資料（2026-10-18）：一支 /api/preferred/:code，伺服器端讀，SSR 就有內容。頁面在最上層 await 一次，
// 結果整包交給 PreferredStockPage（同一個 key 不讓兄弟元件各自再抓，見 useAsyncData shared-key race）。
// composable 都在 await 之前呼叫：await 之後就沒有元件的作用範圍了
export async function usePreferredStock() {
  const route = useRoute()
  const code = computed(() => String(route.params.code).toUpperCase())
  const request = useFetch<PreferredPageResponse>(() => `/api/preferred/${code.value.toLowerCase()}`, { key: () => `preferred-page-${code.value}` })
  const { data, pending, error, refresh } = request
  const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 400)
  watchLoadFailure('preferred-page', () => (error.value && !notFound.value ? error.value : null), () => refresh())

  const entry = computed(() => data.value?.stock ?? null)
  const quote = computed(() => data.value?.quote ?? null)
  const price = computed(() => quote.value?.price ?? entry.value?.latestClosePrice ?? null)
  const priceDate = computed(() => quote.value?.tradeDate ?? entry.value?.latestPriceDate ?? null)
  const stock = computed<Stock | null>(() => (entry.value
    ? { code: entry.value.symbol, name: entry.value.companyName, price: price.value, change: quote.value?.change ?? null, changePercent: quote.value?.changePercent ?? null }
    : null))
  const shortName = computed(() => entry.value?.companyName ?? code.value)

  await request
  return { code, data, pending, error, notFound, entry, price, priceDate, stock, shortName }
}

export type PreferredStock = Awaited<ReturnType<typeof usePreferredStock>>
