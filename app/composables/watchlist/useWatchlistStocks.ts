import type { CompanyIndexEntry } from '~/composables/stock/useCompanyIndex'
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'
import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'

// 觀察清單每一列的資料（2026-10-06 重寫，「設計觀察清單頁面」）。
//
// 原本每檔打兩支（GET /stocks/{code} ＋ daily-price-history），10 檔＝20 個請求，而且只認普通股。
// 現在整份清單兩個請求：
//   - 一次 POST /screener/values（持股頁 loadQuotes 同一支，≤200 檔）：股價、前一日收盤，加上表格上
//     每一個型錄欄位（固定的本益比等與使用者自己加的）。估值用交易所公布的 exchange*，不是
//     /stocks/{code} 的 live*——後者是 analysis-ts 自算、虧損公司是負的本益比（1101 = -21.49，交易所
//     為空值；業務中台 2026-10-06 確認兩者不同指標）。排行與產業頁也都用 exchange*。
//   - 一次 GET /stocks/ex-dividend-notices（≤100 檔，經 /api/cached 快取一小時）。2026-10-06 起這支也回「已除息、
//     還沒發放」的那幾筆（status realized），所以「除息／發放」欄寫得出發放日了。2026-10-20 起現金或配股有一個還沒發就留著：
//     現金看 paymentDate（只配股的是 null）、配股看 stockDividendDistributionDate，取還沒到的較早那天——
//     共用的 useExDividendNotices 會把 realized 濾掉（它的呼叫端問的是下一次除息），這裡刻意不用它。
//
// 漲跌用 stock.previousClose（業務中台 527c68c）——前一個「真的有成交」的交易日收盤，是原始收盤價不是
// 除息參考價，所以除息當天的漲跌含配息的那一跌（跟券商 App 的「漲跌」不同，那是對參考價）。
//
// ETF 與特別股也收（同日使用者決定）。實測 2026-10-06：0056／00878／2881A 的 stock.price 與
// previousClose 都有值；估值欄位是 null（交易所不對它們公布），畫面照實顯示。
//
// 沒有股價的那一檔**不丟掉**，照樣列出、數字欄是空的：使用者自己加進來的東西不能在畫面上消失，
// 那會像是沒存到（舊版的 droppedCount 就是這個問題的補丁）。
//
// 每一列的 `values` 跟篩選器結果列同一個形狀（field id → 儲存格），表格直接共用 SharedMetricTable。
// 「漲跌」與「下次除權息」不是型錄欄位，用 WATCHLIST_CHANGE／WATCHLIST_EX_DIVIDEND 這兩個假欄位放進去，
// 值分別是漲跌幅與除權息日——排序就照這兩個值排。

export type WatchlistKind = CompanyIndexEntry['kind']

export const WATCHLIST_CHANGE = 'watchlist.change'
export const WATCHLIST_EX_DIVIDEND = 'watchlist.exDividend'

// 表格上的欄位裡，要送去 /screener/values 的型錄欄位（/watchlist 與分享頁共用）。假欄位（watchlist.*）是這裡自己算的；
// stock.* 與類股（sector.code，2026-10-22）是 業務中台 自己填的，不在型錄裡也要送。
// 型錄裡已經不存在的欄位（指標改名，業務中台 提醒存的是 JSON、不跟型錄連動）先濾掉：一個未知欄位會讓整個請求 400、
// 整張表都沒有數字。那一欄照樣顯示，值是空的。
export function watchlistCatalogFields(columns: { field: string }[], categories: MetricCategory[]): string[] {
  return columns
    .map(column => column.field)
    .filter(field => !field.startsWith('watchlist.'))
    .filter(field => field.startsWith('stock.') || field === SECTOR_FIELD_ID || !categories.length || !!locateFieldInSchema(categories, field))
}

export interface WatchlistRow {
  code: string
  name: string
  kind: WatchlistKind
  values: Record<string, ScreenerFieldValue | null>
  change: number | null
  changePercent: number | null
  // 最近一個還沒到的事件：還沒除息的那一筆看除息日，已除息未發放的那一筆看發放日，取日期較早的。
  nextDividendEvent: DividendEvent | null
}

export interface DividendEvent {
  // stock＝配股發放（2026-10-20 起才有日期），金額是 null：現金那一部分另有自己的發放日
  kind: 'ex' | 'pay' | 'stock'
  date: string
  exType: ExDividendNotice['exType']
  // `distributionPerUnit ?? cashDividend`：ETF 的金額在前者（見 useExDividendNotices 的型別註解）
  amount: number | null
}

function nextEventOf(notices: ExDividendNotice[], today: string): DividendEvent | null {
  return notices
    // 除息日／除權日合成站內的 exDate＋exType（business-shapes.ts）
    .map(withExType)
    .flatMap((notice): DividendEvent[] => {
      const amount = notice.distributionPerUnit ?? notice.cashDividend
      // 還沒除息看除息日；已除息看還沒到的發放日，現金與配股各自一筆（權息可能不同天）
      const events: (DividendEvent | null)[] = notice.status === 'realized'
        ? [
            notice.paymentDate ? { kind: 'pay', date: notice.paymentDate, exType: notice.exType, amount } : null,
            notice.stockDividendDistributionDate ? { kind: 'stock', date: notice.stockDividendDistributionDate, exType: notice.exType, amount: null } : null
          ]
        : [notice.exDate ? { kind: 'ex', date: notice.exDate, exType: notice.exType, amount } : null]
      return events.filter((event): event is DividendEvent => !!event && event.date >= today)
    })
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}


// 不論表格上有哪些欄位都要抓的：股價（收盤日也從這裡來）與前一日收盤（算漲跌）
const ALWAYS_FIELDS = ['stock.price', 'stock.previousClose']
// ponytail: /screener/values 一次 200 檔、ex-dividend-notices 一次 100 檔；超過的那幾檔數字是空的。
// 觀察清單目前的額度遠低於此，真的有人超過再分批。
const QUOTE_MAX = 200
const NOTICE_MAX = 100

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const synthetic = (value: string | null): ScreenerFieldValue => ({ value, knowledgeDate: '', nullReason: null })

// fields：表格上的型錄欄位（固定的與使用者加的）。全部擠在同一次 /screener/values，多一欄不多一個請求。
export function useWatchlistStocks(codes: Ref<string[]>, fields: Ref<string[]>) {
  const { data: companies } = useCompanyIndex()

  type Quote = Pick<WatchlistRow, 'values' | 'change' | 'changePercent' | 'nextDividendEvent'>
  const quotes = ref<Record<string, Quote>>({})
  const pending = ref(false)
  const quotesFailed = ref(false)
  // 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08）。失敗那一批沒進快取，load() 會補抓
  watchLoadFailure('watchlist-quotes', () => quotesFailed.value, () => load(), { scope: 'section' })
  let loadedFields = ''

  async function load() {
    // 伺服器端不抓：SSR 不會等這個請求（不是 useAsyncData），抓了也只是白打一次。分享頁的清單在 SSR 就知道，名稱先畫、數字到瀏覽器再補
    if (import.meta.server) return
    // 欄位組合變了（加／刪欄）就每一檔都重抓：快取是照「代號」存的，不知道少了哪一欄。但**舊的值留在畫面上**
    // 直到新的回來——原本是先清空，加一欄整張表就全部變「—」約一秒（2026-10-06 截圖時看到的）。
    const requested = [...new Set([...ALWAYS_FIELDS, ...fields.value])]
    const fieldsKey = requested.join(',')
    const fieldsChanged = fieldsKey !== loadedFields
    loadedFields = fieldsKey
    // 欄位沒變就只抓還沒有的：移除、排序、改備註都不該重抓整份
    const missing = fieldsChanged ? [...codes.value] : codes.value.filter(code => !quotes.value[code])
    // 沒有要抓的就沒有失敗（失敗的那幾檔被移除時，旗標原本會一直留著）
    if (missing.length === 0) {
      quotesFailed.value = false
      return
    }
    pending.value = true
    const [screener, notices] = await Promise.all([
      fetchScreenerValues<ScreenerFieldValue>(missing.slice(0, QUOTE_MAX), requested).catch((error: unknown) => {
        devWarn('watchlist', 'POST /screener/values unavailable', error)
        return null
      }),
      apiFetch<{ notices: Record<string, ExDividendNotice[]> }>('/stocks/ex-dividend-notices', { baseURL: BUSINESS_CACHED_BASE, query: { symbols: missing.slice(0, NOTICE_MAX).join(',') } }).catch((error: unknown) => {
        devWarn('watchlist', 'GET /stocks/ex-dividend-notices unavailable', error)
        return null
      })
    ])
    pending.value = false
    quotesFailed.value = screener === null
    // 失敗的那一批不寫進快取，下一次 load 會再試；等待期間欄位又變了的話這一批也作廢
    if (screener === null || fieldsKey !== loadedFields) return

    const bySymbol = new Map(screener.results.map(row => [row.symbol, row.values]))
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const next = { ...quotes.value }
    for (const code of missing) {
      const raw = bySymbol.get(code) ?? {}
      const price = toNumber(raw['stock.price']?.value)
      const previous = toNumber(raw['stock.previousClose']?.value)
      const change = price !== null && previous !== null && previous !== 0 ? price - previous : null
      const changePercent = change !== null ? (change / previous!) * 100 : null
      const nextDividendEvent = nextEventOf(notices?.notices[code] ?? [], today)
      next[code] = {
        values: {
          ...Object.fromEntries(Object.entries(raw).map(([field, cell]) => [field, cell ?? null])),
          [WATCHLIST_CHANGE]: synthetic(changePercent === null ? null : String(changePercent)),
          [WATCHLIST_EX_DIVIDEND]: synthetic(nextDividendEvent?.date ?? null)
        },
        change,
        changePercent,
        nextDividendEvent
      }
    }
    quotes.value = next
  }

  watch([codes, fields], load, { immediate: true })

  const rows = computed<WatchlistRow[]>(() =>
    codes.value.map(code => {
      const company = companies.value.find(entry => entry.code === code)
      return {
        code,
        name: company?.name ?? code,
        kind: company?.kind ?? 'common',
        values: {},
        change: null,
        changePercent: null,
        nextDividendEvent: null,
        ...quotes.value[code]
      }
    })
  )

  // 最新的收盤日，給頁首「10/05 收盤」用
  const priceDate = computed(() =>
    rows.value.map(row => row.values['stock.price']?.knowledgeDate).filter((date): date is string => !!date).sort().at(-1) ?? null
  )

  return { rows, pending, quotesFailed, priceDate }
}
