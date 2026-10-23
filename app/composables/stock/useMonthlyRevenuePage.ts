import type { StockMonthlyRevenuePageResponse } from '#shared/types/stock-monthly-revenue-page'

// 月營收（/monthly-revenue）與月營收年增率（/monthly-revenue-growth）兩頁共用（2026-10-23，使用者：「monthly-revenue 現在比較像是
// 月營收年增率 而不是月營收 希望可以拆分為兩個頁面」）：同一支端點（Nitro 快取同一份）、同一串月份、同一組格式。各頁只畫自己的圖與表。
// 資料是公司每月申報（MOPS t187ap05_L），每月 10 日前公告；季報的營收成長年增率是另一頁（/revenue-growth）
//
// 所有 composable、computed、watch 都在 await 之前建好，最後才一起等：composable 裡一 await，Nuxt 與元件的實例就斷了（只有
// <script setup> 會自動接回），之後再呼叫 useFilterSchema 會 500（2026-10-23 量到）
export async function useMonthlyRevenuePage(code: Ref<string>) {
  const page = useFetch<StockMonthlyRevenuePageResponse>(() => `/api/stock/${code.value}/monthly-revenue`, {
    key: () => `stock-monthly-revenue-${code.value}`,
    watch: [code]
  })
  const schema = useFilterSchema()
  const { data } = page

  // 由舊到新。沒有資料與讀不到是兩回事，頁面說法不同——興櫃與剛上市的公司本來就沒有（上櫃有，2026-10-11 實測）
  const ascending = computed(() => data.value?.entries ?? [])
  const descending = computed(() => [...ascending.value].reverse())
  const latest = computed(() => descending.value[0] ?? null)
  const hasData = computed(() => ascending.value.length > 0)
  const readFailed = computed(() => data.value?.entries === null)
  // 讀不到時交給全站的讀取失敗彈窗（2026-10-08），畫面上不再各自出訊息
  watchLoadFailure(() => `stock-monthly-revenue:${code.value}`, () => readFailed.value, page.refresh)
  // 頁尾的資料來源：型錄裡月營收指標的來源（證交所／櫃買中心的月營收彙總表）
  const dataSources = computed(() => collectMetricSources(schema.data.value?.categories ?? [], ['revenueYoy3m']))

  await Promise.all([page, schema])
  if (page.error.value) throw createError({ statusCode: 503, statusMessage: '月營收資料暫時無法取得', fatal: true })

  return { data, ascending, descending, latest, hasData, readFailed, dataSources }
}

// 申報的千元換成億元。只在前端這一層換：analysis-ts 照約定原樣轉千元，換單位的那一層也要寫單位。
// null 要先擋：Number(null) 是 0，缺值會變成「0 元」而不是「尚無資料」（業務中台 f750e92 起營收欄位可能是 null）
const THOUSAND_TO_HUNDRED_MILLION = 100_000
export function monthlyRevenueHundredMillion(thousands: string | null): number | null {
  if (thousands === null) return null
  const parsed = Number(thousands)
  return Number.isFinite(parsed) ? parsed / THOUSAND_TO_HUNDRED_MILLION : null
}
// formatMoney（萬／億／兆＋4 位有效數字，2026-10-12）：原本固定 toFixed(1) 億元，月營收 300 萬的公司印成「0.0 億元」
export const monthlyRevenueAmountText = (hundredMillion: number | null): string => (hundredMillion === null ? '尚無資料' : formatMoney(hundredMillion * THOUSAND_TO_HUNDRED_MILLION * 1000))
export const monthlyRevenueRateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
