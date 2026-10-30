import type { ReitPageResponse } from '#shared/types/screener-detail'
import type { Stock } from '~/composables/stock/useStocks'

// REITs 個別頁每個面向共用的資料（2026-10-30）：一支 /api/reit/:code，伺服器端讀，SSR 就有內容。頁面在最上層 await 一次，結果整包交給
// ReitPage（同一個 key 不讓兄弟元件各自再抓，見 useAsyncData shared-key race）。composable 都在 await 之前呼叫
export async function useReit() {
  const route = useRoute()
  const code = computed(() => String(route.params.code).toUpperCase())
  const request = useFetch<ReitPageResponse>(() => `/api/reit/${code.value.toLowerCase()}`, { key: () => `reit-page-${code.value}` })
  const { data, pending, error, refresh } = request
  const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 400)
  watchLoadFailure('reit-page', () => (error.value && !notFound.value ? error.value : null), () => refresh())

  const reit = computed(() => data.value?.reit ?? null)
  const quote = computed(() => data.value?.quote ?? null)
  // 摘要卡的收盤價與漲跌（同特別股）；日線讀不到就用基本資料的收盤價
  const stock = computed<Stock | null>(() => (reit.value
    ? { code: reit.value.symbol, name: reit.value.fundName ?? reit.value.companyName, price: quote.value?.price ?? reit.value.close, change: quote.value?.change ?? null, changePercent: quote.value?.changePercent ?? null }
    : null))
  const shortName = computed(() => reit.value?.companyName ?? code.value)

  await request
  return { code, data, pending, error, notFound, reit, stock, shortName }
}

export type ReitData = Awaited<ReturnType<typeof useReit>>
