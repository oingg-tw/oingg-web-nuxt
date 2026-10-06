import type { CompanyIndexEntry } from '~/composables/stock/useCompanyIndex'
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'

// 觀察清單每一列的資料（2026-10-06 重寫，「設計觀察清單頁面」）。
//
// 原本每檔打兩支（GET /stocks/{code} ＋ daily-price-history），10 檔＝20 個請求，而且只認普通股。
// 現在：
//   - 股價與三個估值欄位：一次 POST /screener/values（持股頁 loadQuotes 同一支，≤200 檔）。估值用交易所
//     公布的 exchange*，不是 /stocks/{code} 的 live*——後者是 analysis-ts 自算、虧損公司是負的本益比
//     （1101 = -21.49，交易所為空值；bff-ts 2026-10-06 確認兩者不同指標）。排行與產業頁也都用 exchange*。
//   - 漲跌：同一次批次的 stock.previousClose（bff-ts 527c68c，2026-10-06）——前一個「真的有成交」的
//     交易日收盤，是原始收盤價不是除息參考價，所以除息當天的漲跌含配息的那一跌（跟券商 App 的「漲跌」
//     不同，那是對參考價）。原本每檔一支 daily-price-history 只為了算這個，拿掉之後整份清單一個請求。
//     成交量欄同時拿掉：批次端點沒有成交量，為一個預設關閉的欄位每檔多打一支不划算。
//   - 下次除息：一次 GET /stocks/ex-dividend-notices（≤100 檔，經 /api/bff 快取一小時）。
//
// ETF 與特別股也收（同日使用者決定）。實測 2026-10-06：0056／00878／2881A 的 stock.price 與
// daily-price-history 都有值；三個估值欄位是 null（交易所不對它們公布），畫面照實顯示「－」。
//
// 沒有股價的那一檔**不丟掉**，照樣列出、數字欄是「－」：使用者自己加進來的東西不能在畫面上消失，
// 那會像是沒存到（舊版的 droppedCount 就是這個問題的補丁）。

export type WatchlistKind = CompanyIndexEntry['kind']

export interface WatchlistRow {
  code: string
  name: string
  kind: WatchlistKind
  price: number | null
  priceDate: string | null
  change: number | null
  changePercent: number | null
  peRatio: number | null
  pbRatio: number | null
  dividendYield: number | null
  // 最近一個尚未到的除權息（上游只回未來的事件）。
  nextExDividend: ExDividendNotice | null
  // 使用者自己加的型錄欄位（2026-10-06「觀察清單的 table 要比照 screener，可以自己新增欄位」）：
  // field id → 原始字串值，格式化交給 formatScreenerValue，跟篩選器結果表同一套。
  extra: Record<string, string | null>
}

interface ScreenerValue { value: string | null; knowledgeDate: string | null }
interface ScreenerValuesResponse { results: { symbol: string; values: Record<string, ScreenerValue | undefined> }[] }

const QUOTE_FIELDS = ['stock.price', 'stock.previousClose', 'exchangePeRatio.EOD', 'exchangePbRatio.EOD', 'dividendYield.EOD']
// ponytail: /screener/values 一次 200 檔、ex-dividend-notices 一次 100 檔；超過的那幾檔數字是「－」。
// 觀察清單目前的額度遠低於此，真的有人超過再分批。
const QUOTE_MAX = 200
const NOTICE_MAX = 100

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function deriveChange(price: number | null, previous: number | null) {
  if (price === null || previous === null || previous === 0) return null
  const amount = price - previous
  return { amount, percent: (amount / previous) * 100 }
}

// extraFields：使用者加的欄位。跟固定欄位擠在同一次 /screener/values，所以多加欄位不多一個請求。
export function useWatchlistStocks(codes: Ref<string[]>, extraFields: Ref<string[]>) {
  const config = useRuntimeConfig()
  const { data: companies } = useCompanyIndex()

  const quotes = ref<Record<string, Omit<WatchlistRow, 'code' | 'name' | 'kind'>>>({})
  const pending = ref(false)
  const quotesFailed = ref(false)

  async function load() {
    const targetCodes = codes.value
    // 只抓還沒有的：移除、排序、改備註都不該重抓整份
    // 欄位組合變了（加／刪自訂欄）就整份重抓：快取是照「代號」存的，不知道少了哪一欄
    const fields = [...new Set([...QUOTE_FIELDS, ...extraFields.value])]
    const fieldsKey = fields.join(',')
    if (fieldsKey !== loadedFields) {
      quotes.value = {}
      loadedFields = fieldsKey
    }
    const missing = targetCodes.filter(code => !quotes.value[code])
    if (missing.length === 0) return
    pending.value = true
    const [screener, notices] = await Promise.all([
      $fetch<ScreenerValuesResponse>('/screener/values', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { symbols: missing.slice(0, QUOTE_MAX), columns: fields.map(field => ({ field })) },
        timeout: BFF_REQUEST_TIMEOUT_MS
      }).catch((error: unknown) => {
        devWarn('watchlist', 'POST /screener/values unavailable', error)
        return null
      }),
      $fetch<{ notices: Record<string, ExDividendNotice[]> }>('/stocks/ex-dividend-notices', {
        baseURL: '/api/bff',
        retry: 0,
        query: { symbols: missing.slice(0, NOTICE_MAX).join(',') }
      }).catch((error: unknown) => {
        devWarn('watchlist', 'GET /stocks/ex-dividend-notices unavailable', error)
        return null
      })
    ])
    quotesFailed.value = screener === null

    const bySymbol = new Map(screener?.results.map(row => [row.symbol, row.values]) ?? [])
    const next = { ...quotes.value }
    missing.forEach(code => {
      const values = bySymbol.get(code)
      const price = toNumber(values?.['stock.price']?.value)
      const change = deriveChange(price, toNumber(values?.['stock.previousClose']?.value))
      const upcoming = [...(notices?.notices[code] ?? [])].sort((a, b) => a.exDate.localeCompare(b.exDate))
      next[code] = {
        price,
        priceDate: values?.['stock.price']?.knowledgeDate ?? null,
        change: change?.amount ?? null,
        changePercent: change?.percent ?? null,
        peRatio: toNumber(values?.['exchangePeRatio.EOD']?.value),
        pbRatio: toNumber(values?.['exchangePbRatio.EOD']?.value),
        dividendYield: toNumber(values?.['dividendYield.EOD']?.value),
        nextExDividend: upcoming[0] ?? null,
        extra: Object.fromEntries(extraFields.value.map(field => [field, values?.[field]?.value ?? null]))
      }
    })
    // 失敗的那一批不寫進快取，下一次 load 會再試
    // 失敗的那一批不寫進快取，下一次 load 會再試；欄位在等待期間又變了的話這一批也作廢
    if (screener !== null && fieldsKey === loadedFields) quotes.value = next
    pending.value = false
  }

  let loadedFields = ''
  watch([codes, extraFields], load, { immediate: true })

  const rows = computed<WatchlistRow[]>(() =>
    codes.value.map(code => {
      const company = companies.value.find(entry => entry.code === code)
      const quote = quotes.value[code]
      return {
        code,
        name: company?.name ?? code,
        kind: company?.kind ?? 'common',
        price: null,
        priceDate: null,
        change: null,
        changePercent: null,
        peRatio: null,
        pbRatio: null,
        dividendYield: null,
        nextExDividend: null,
        extra: {},
        ...quote
      }
    })
  )

  // 最新的收盤日，給頁首「（10/05 收盤）」用
  const priceDate = computed(() =>
    rows.value.map(row => row.priceDate).filter((date): date is string => !!date).sort().at(-1) ?? null
  )

  return { rows, pending, quotesFailed, priceDate }
}
