import type { EtfPageResponse } from '#shared/types/screener-detail'
import type { Stock } from '~/composables/stock/useStocks'

// ETF 個別頁每個面向共用的資料（2026-10-18）：一支 /api/etf/:code（基本資料、配息、填息、每月成交），伺服器端讀，SSR 就有內容。
// 頁面在最上層 await 一次，結果整包交給 EtfPage（同 usePreferredStock）。composable 都在 await 之前呼叫
export async function useEtf() {
  const route = useRoute()
  const code = computed(() => String(route.params.code).toUpperCase())
  const request = useFetch<EtfPageResponse>(() => `/api/etf/${code.value.toLowerCase()}`, { key: () => `etf-page-${code.value}` })
  const { data, pending, error, refresh } = request
  const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 400)
  // 404 以外的讀取失敗交給全站彈窗、頁面停在載入中，不掉進「找不到這檔 ETF」
  watchLoadFailure('etf-page', () => (error.value && !notFound.value ? error.value : null), () => refresh())

  const etf = computed(() => data.value?.etf ?? null)
  const values = computed(() => etf.value?.values ?? {})
  const num = (field: string): number | null => (typeof values.value[field] === 'number' ? values.value[field] as number : null)
  const text = (field: string): string | null => (typeof values.value[field] === 'string' ? values.value[field] as string : null)
  const stock = computed<Stock | null>(() => (etf.value
    ? { code: etf.value.symbol, name: etf.value.shortName, price: data.value?.quote?.price ?? null, change: data.value?.quote?.change ?? null, changePercent: data.value?.quote?.changePercent ?? null }
    : null))
  const shortName = computed(() => etf.value?.shortName ?? code.value)
  const { isFavorite, toggleFavorite } = useWatchlistToggle(() => etf.value?.symbol, () => shortName.value)

  await request
  return { code, data, pending, error, notFound, etf, values, num, text, stock, shortName, isFavorite, toggleFavorite }
}

export type Etf = Awaited<ReturnType<typeof useEtf>>
