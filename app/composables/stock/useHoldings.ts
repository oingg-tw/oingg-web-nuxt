import { h } from 'vue'
import { ElMessage } from 'element-plus'
import type { ImportedTrade } from '~/utils/broker-trade-csv'

// 持股管理的資料層：bff-ts 的 /holdings 與 /transactions，加上算市值與預估股利需要的市場資料。
// 彙總本身在 app/utils/holdings-summary.ts，這裡只負責「拿到」與「改」。
//
// **持股是交易紀錄的唯讀投影**（bff-ts 4467c44，2026-10-05 使用者決定）：沒有 POST／PATCH /holdings，
// 新增或修改持股就是新增或修改交易，股數與移動平均成本由 bff-ts 重算。前端**不**自己推算——那會讓
// 成本法有兩份而漂移——每次寫入之後重新 GET /holdings。
//
// **狀態是頁面區域的 ref，不是 useState。** 每次進頁面重新載入、沒有 session 旗標，所以
// 「同步 watcher 必須放在 app.vue」那個陷阱在這裡不存在；也不會讓前一個人的持股殘留給同一個分頁的
// 下一個登入者。
//
// HTTP 照 useUserWatchlist.ts 的形狀，刻意不同的一處：**authHeader() 放在 try 裡面**。它包著
// getIdToken() 的逾時，會丟錯；放在 try 外面（useStocks.addStock 的寫法）會變成未處理的 rejection。
export interface Holding {
  symbol: string
  quantity: number
  // Decimal 以字串送來
  averageCost: string
  totalCost: string
  realizedProfitLoss: string
}

export interface Transaction {
  id: string
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: string
  fee: string
  tax: string
  tradeDate: string
  note: string | null
  // 匯入的列才有（bff-ts f3388fd）；手動輸入三個都是 null。期初部位是 source "opening"。
  source: string | null
  externalRef: string | null
  importId: string | null
}

export interface TransactionInput {
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  fee: number
  tax: number
  tradeDate: string
  note: string | null
}

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'oversold' | 'unknown' | 'gone' | 'failed'; message: string | null }

export interface ImportShortfall {
  symbol: string
  tradeDate: string
  externalRef: string
  // **那個時點**缺的股數；同一檔有多筆時，後面幾筆是在前一筆已夾成 0 的前提下算的——取最大值，不要相加
  shortBy: number
}

export interface OpeningPosition {
  symbol: string
  quantity: number
  averageCost: number
}

export interface ImportResult {
  // null ＝ 什麼都沒寫（dryRun，或整批都是匯過的重複列）——判斷「有沒有東西可以撤銷」只看這個
  importId: string | null
  inserted: number
  duplicates: number
  openingPositions: { symbol: string; status: 'created' | 'skipped' }[]
  holdings: Holding[]
}

export type ImportOutcome =
  | { kind: 'ok'; result: ImportResult }
  | { kind: 'shortfalls'; shortfalls: ImportShortfall[] }
  | { kind: 'failed'; message: string }

export interface HoldingMarket {
  price: string | null
  priceDate: string | null
  dividendPerShare: string | number | null
}

interface ScreenerValue { value: string | null; knowledgeDate: string | null }
interface ScreenerValuesResponse { results: { symbol: string; values: Record<string, ScreenerValue | undefined> }[] }
interface PreferredStockRow { symbol: string; dividendRate: number | null }
// server/api/etf/distributions-ttm.get.ts 的回應；不從 server 檔 import，免得把 Nitro 的自動匯入型別拖進 app。
interface EtfDistributionsTtm { from: string; to: string; perUnit: Record<string, number> }

// 長輩的閱讀速度：從看到提示到找到「復原」要時間。這是校準旋鈕，不是隨手的數字。
const UNDO_WINDOW_MS = 10_000
// ponytail: /screener/values 一次最多 200 檔；超過的不會有報價，頁面會照實算進「沒有報價」。
// 真的有人持有 200 檔以上再分批。
const SCREENER_VALUES_MAX = 200

// 賣超的判斷看 `error.code === "LEDGER_OVERSOLD"`（bff-ts 說那是唯一穩定的部分）。數字目前只在英文訊息裡：
// `Selling 500 shares of "2330" on 2026-10-05 would exceed the 300 you hold at that point`
// 抽出日期與當時股數換成中文；措辭變了就退回不帶數字的說法，不顯示英文。
const LEDGER_OVERSOLD = 'LEDGER_OVERSOLD'
const CLEAR_ALL_KEY = 'all'
const OVERSOLD_PATTERN = /on (\d{4}-\d{2}-\d{2}) would exceed the (\d+) you hold/

export function oversoldMessage(raw: string | null): string {
  const match = raw ? OVERSOLD_PATTERN.exec(raw) : null
  if (!match) return '這筆賣出會超過當時持有的股數。'
  return `這筆賣出會超過當時持有的股數：${match[1]} 當時持有 ${groupThousands(match[2]!)} 股。`
}

export function useHoldings() {
  const config = useRuntimeConfig()
  const authHeader = useAuthHeader()

  const holdings = ref<Holding[]>([])
  const pending = ref(false)
  const loadFailed = ref(false)
  const market = ref<Record<string, HoldingMarket>>({})
  const quotesFailed = ref(false)
  const etfWindow = ref<{ from: string; to: string } | null>(null)

  // 每股股利的三個來源，彼此不重疊（批次的 dividendPerShare.TTM 對 ETF 與特別股是 null），所以合併時
  // 不需要知道一檔是什麼型別。
  let etfPerUnit: Record<string, number> = {}
  let preferredDividend: Record<string, number> = {}
  let referenceLoaded = false

  async function request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
    const headers = await authHeader()
    if (!headers) throw Object.assign(new Error('not signed in'), { statusCode: 401 })
    return await $fetch<T>(path, {
      baseURL: config.public.apiBase,
      method: options.method ?? 'GET',
      headers,
      query: options.query,
      body: options.body as Record<string, unknown> | undefined,
      timeout: BFF_REQUEST_TIMEOUT_MS,
      ...(options.method ? {} : { cache: 'no-store' as const })
    })
  }

  // 公開資料：不帶身分、同一頁只抓一次。
  async function loadReferenceData() {
    if (referenceLoaded) return
    const [etf, preferred] = await Promise.allSettled([
      $fetch<EtfDistributionsTtm>('/api/etf/distributions-ttm', { timeout: BFF_REQUEST_TIMEOUT_MS }),
      $fetch<{ entries: PreferredStockRow[] }>('/stocks/preferred-stocks', { baseURL: config.public.apiBase, timeout: BFF_REQUEST_TIMEOUT_MS })
    ])
    if (etf.status === 'fulfilled') {
      etfPerUnit = etf.value.perUnit
      etfWindow.value = { from: etf.value.from, to: etf.value.to }
    } else {
      devWarn('holdings', 'GET /api/etf/distributions-ttm unavailable', etf.reason)
    }
    if (preferred.status === 'fulfilled') {
      // 讀 bff 的**原始** dividendRate（每股元、發行條件所訂）。usePreferredStockList.ts 把 UI 的
      // dividendRate 對應成 nominalDividendRatePct（百分比）——拿那個來乘股數會錯 10 倍以上。
      preferredDividend = Object.fromEntries(
        preferred.value.entries.filter(row => row.dividendRate !== null).map(row => [row.symbol, row.dividendRate!])
      )
    } else {
      devWarn('holdings', 'GET /stocks/preferred-stocks unavailable', preferred.reason)
    }
    referenceLoaded = etf.status === 'fulfilled' && preferred.status === 'fulfilled'
  }

  async function loadQuotes(symbols: string[]) {
    const missing = symbols.filter(symbol => !market.value[symbol])
    if (missing.length === 0) return
    try {
      const response = await $fetch<ScreenerValuesResponse>('/screener/values', {
        baseURL: config.public.apiBase,
        method: 'POST',
        // 只送 stock.price 會 400（bff-ts 先把這個特殊欄位剝掉，剩下零個型錄欄位），所以一定要配一個
        // 型錄欄位——而 dividendPerShare.TTM 剛好就是普通股的每股股利。
        body: { symbols: missing.slice(0, SCREENER_VALUES_MAX), columns: [{ field: 'stock.price' }, { field: 'dividendPerShare.TTM' }] },
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      const next = { ...market.value }
      for (const row of response.results) {
        const price = row.values['stock.price']
        next[row.symbol] = {
          price: price?.value ?? null,
          priceDate: price?.knowledgeDate ?? null,
          dividendPerShare: etfPerUnit[row.symbol] ?? preferredDividend[row.symbol] ?? row.values['dividendPerShare.TTM']?.value ?? null
        }
      }
      market.value = next
      quotesFailed.value = false
    } catch (error) {
      quotesFailed.value = true
      devWarn('holdings', 'POST /screener/values unavailable', error)
    }
  }

  // 等待刪除中的代號（復原視窗還開著）。重新載入時要把它們濾掉，否則剛刪的那一列會在
  // 復原提示還在的時候又冒回來。
  const pendingDeletes = new Map<string, () => void>()

  async function load() {
    pending.value = true
    loadFailed.value = false
    try {
      const response = await request<{ holdings: Holding[] }>('/holdings')
      // undefined（問不到）與 []（真的沒有）分開：前者是 loadFailed，後者是一份可以直接套用的答案。
      holdings.value = pendingDeletes.has(CLEAR_ALL_KEY)
        ? []
        : (response.holdings ?? []).filter(holding => !pendingDeletes.has(`holding:${holding.symbol}`))
      await loadReferenceData()
      await loadQuotes(holdings.value.map(holding => holding.symbol))
    } catch (error) {
      loadFailed.value = true
      devWarn('holdings', 'GET /holdings unavailable', error)
    } finally {
      pending.value = false
    }
  }

  function clear() {
    holdings.value = []
    transactions.value = {}
    market.value = {}
    loadFailed.value = false
  }

  // ---- 交易紀錄 ----

  // 依代號分開存，只在使用者打開那一檔的紀錄時才抓。
  const transactions = ref<Record<string, Transaction[] | 'failed'>>({})

  async function loadTransactions(symbol: string) {
    try {
      const response = await request<{ transactions: Transaction[] }>('/transactions', { query: { symbol } })
      transactions.value = { ...transactions.value, [symbol]: response.transactions ?? [] }
    } catch (error) {
      transactions.value = { ...transactions.value, [symbol]: 'failed' }
      devWarn('holdings', `GET /transactions?symbol=${symbol} unavailable`, error)
    }
  }

  // 一次動到很多檔（匯入、撤銷匯入）之後：已經打開過的那幾檔紀錄全部重抓。
  async function reloadLoadedTransactions() {
    await Promise.all(Object.keys(transactions.value).map(loadTransactions))
  }

  // 寫入之後的唯一真相來源是伺服器重算的結果：重新抓持股，以及（有打開的話）那一檔的紀錄。
  async function refreshAfterWrite(symbol: string) {
    await Promise.all([load(), symbol in transactions.value ? loadTransactions(symbol) : null])
  }

  // 新增與編輯**不做樂觀更新**：對話框本來就有等待狀態，而股數與均價只有伺服器算得出來。
  async function saveTransaction(id: string | null, input: TransactionInput): Promise<SaveResult> {
    const note = input.note?.trim() ?? ''
    const body = {
      action: input.action,
      quantity: input.quantity,
      // 欄位是 Decimal(18,4)：送出前就四捨五入，不讓資料庫替我們決定怎麼截。
      price: Math.round(input.price * 1e4) / 1e4,
      fee: Math.round(input.fee * 1e4) / 1e4,
      tax: input.action === 'SELL' ? Math.round(input.tax * 1e4) / 1e4 : 0,
      tradeDate: input.tradeDate,
      note: note === '' ? null : note
    }
    try {
      if (id) await request(`/transactions/${id}`, { method: 'PATCH', body })
      else await request('/transactions', { method: 'POST', body: { symbol: input.symbol, ...body } })
      await refreshAfterWrite(input.symbol)
      return { ok: true }
    } catch (error) {
      const status = bffErrorStatus(error)
      const message = describeBffError(error)
      if (bffErrorCode(error) === LEDGER_OVERSOLD) return { ok: false, reason: 'oversold', message }
      if (status === 404 && !id) return { ok: false, reason: 'unknown', message }
      if (status === 404) {
        await refreshAfterWrite(input.symbol)
        return { ok: false, reason: 'gone', message: null }
      }
      return { ok: false, reason: 'failed', message }
    }
  }

  // ---- 可復原的刪除 ----
  //
  // **DELETE 延到提示關閉才送**，而不是先刪、按復原時再重建。重建一整檔的交易在網路失敗時會**永久
  // 弄丟**紀錄；延後送出只會往安全的方向失敗：最壞的情況是那些紀錄還在。
  //
  // ponytail: 在復原視窗內直接關掉分頁＝取消刪除（安全的方向）。如果有人回報「刪掉的又回來了」，
  // 再加一個 pagehide 時用預先取好的 header 送 keepalive DELETE。
  function deferDelete(key: string, label: string, hide: () => () => void, send: () => Promise<string | null>, symbol: string) {
    const restore = hide()
    let undone = false
    const instance = undoToast(`已刪除 ${label}`, () => {
      undone = true
      restore()
    }, async () => {
      // 逾時、Esc、或離開頁面時的 flush 都走到這裡——只有一條送出 DELETE 的路
      pendingDeletes.delete(key)
      if (undone) return
      const failure = await send()
      if (failure === null) {
        await refreshAfterWrite(symbol)
      } else {
        restore()
        showErrorMessage(`刪除 ${label} 失敗：${failure}紀錄仍保留。`)
      }
    })
    pendingDeletes.set(key, () => instance.close())
  }

  // 「已刪除…／復原」提示：刪除與匯入共用。按鈕掛載時取得焦點——觸發它的那顆按鈕（刪除鈕跟著那一列消失、
  // 匯入對話框關了）已經不在，焦點若不移到這裡，鍵盤使用者會被丟回頁首、找不到復原。
  function undoToast(text: string, onUndo: () => void, onClose: () => void) {
    const instance = ElMessage({
      type: 'info',
      duration: UNDO_WINDOW_MS,
      showClose: false,
      message: h('span', { class: 'app-undo-toast' }, [
        h('span', text),
        h('button', {
          type: 'button',
          class: 'app-undo-toast__action',
          onVnodeMounted: (vnode: { el: unknown }) => (vnode.el as HTMLElement | null)?.focus(),
          onClick: () => {
            onUndo()
            instance.close()
          }
        }, '復原')
      ]),
      onClose
    })
    return instance
  }

  // null ＝ 成功；字串 ＝ 給使用者看的失敗原因。
  async function sendDelete(path: string): Promise<string | null> {
    try {
      await request(path, { method: 'DELETE' })
      return null
    } catch (error) {
      // 404：已經不在了——對刪除來說那就是想要的結果。
      if (bffErrorStatus(error) === 404) return null
      if (bffErrorCode(error) === LEDGER_OVERSOLD) return `刪掉這筆買進會讓之後的賣出超過當時持有的股數，`
      devWarn('holdings', `DELETE ${path} failed`, error)
      return '暫時無法連線，'
    }
  }

  // 刪除一檔持股＝刪除那個代號底下的所有交易（DELETE /holdings/:symbol）。
  function removeHolding(holding: Holding, label: string) {
    deferDelete(`holding:${holding.symbol}`, `${label} 的所有交易紀錄`, () => {
      const index = holdings.value.findIndex(item => item.symbol === holding.symbol)
      holdings.value = holdings.value.filter(item => item.symbol !== holding.symbol)
      return () => {
        const next = [...holdings.value]
        next.splice(Math.min(index, next.length), 0, holding)
        holdings.value = next
      }
    }, () => sendDelete(`/holdings/${encodeURIComponent(holding.symbol)}`), holding.symbol)
  }

  // 刪除一筆交易。伺服器會重跑整段：刪掉一筆買進可能讓之後的賣出變成賣超，那時回 400、紀錄保留。
  function removeTransaction(transaction: Transaction, label: string) {
    deferDelete(`transaction:${transaction.id}`, label, () => {
      const list = transactions.value[transaction.symbol]
      if (!Array.isArray(list)) return () => {}
      transactions.value = { ...transactions.value, [transaction.symbol]: list.filter(item => item.id !== transaction.id) }
      return () => {
        transactions.value = { ...transactions.value, [transaction.symbol]: list }
      }
    }, () => sendDelete(`/transactions/${transaction.id}`), transaction.symbol)
  }

  // ---- 匯入券商成交明細（POST /transactions/import，bff-ts f3388fd） ----
  //
  // 一次全寫或全不寫；以 (source, externalRef) 去重，所以重匯有重疊期間的檔案是安全的。dryRun 跑同一套
  // 驗證但不寫入，預覽畫面的持股就是它算的——前端不另寫一份 replay。
  async function importTrades(source: string, trades: ImportedTrade[], openingPositions: OpeningPosition[], dryRun: boolean): Promise<ImportOutcome> {
    try {
      const result = await request<ImportResult>('/transactions/import', {
        method: 'POST',
        body: {
          source,
          dryRun,
          openingPositions,
          transactions: trades.map(({ externalRef, tradeDate, symbol, action, quantity, price, fee, tax }) => ({ externalRef, tradeDate, symbol, action, quantity, price, fee, tax }))
        }
      })
      if (!dryRun) {
        await Promise.all([load(), reloadLoadedTransactions()])
        if (result.importId) announceImport(result.importId, result.inserted)
      }
      return { kind: 'ok', result }
    } catch (error) {
      // 422 的 shortfalls 在回應主體最上層，不在 error.details（正式環境會把 details 整個拿掉）
      const data = (error as { data?: { shortfalls?: ImportShortfall[] } }).data
      if (bffErrorStatus(error) === 422 && Array.isArray(data?.shortfalls)) return { kind: 'shortfalls', shortfalls: data.shortfalls }
      return { kind: 'failed', message: describeBffError(error) ?? '暫時無法連線，請稍後再試' }
    }
  }

  // ponytail: 撤銷只在匯入後的提示裡（10 秒）。之後要撤銷就得逐檔刪除；有人需要再在交易紀錄依 importId 加一顆鈕。
  function announceImport(importId: string, inserted: number) {
    undoToast(`已匯入 ${groupThousands(inserted)} 筆交易`, async () => {
      try {
        const response = await request<{ deleted: number }>(`/transactions/import/${importId}`, { method: 'DELETE' })
        ElMessage.success(`已撤銷這次匯入（${groupThousands(response.deleted)} 筆）`)
      } catch (error) {
        showErrorMessage(bffErrorStatus(error) === 422
          ? '無法撤銷：撤銷會讓之後手動記的賣出超過持有股數，所以一筆都沒有刪除。請先刪掉那幾筆手動交易。'
          : '撤銷失敗，這次匯入的交易仍保留')
      }
      await Promise.all([load(), reloadLoadedTransactions()])
    }, () => {})
  }

  // 清除全部持股與交易紀錄（使用者 2026-10-05 要求「一個按鈕清除所有持股明細」）。跟其他刪除一樣是
  // 延後送出、可以復原，不跳確認視窗（使用者先前定的刪除規則）。
  //
  // 代號清單取自 GET /transactions，不是持股：已全部賣出的代號不在持股裡，但交易紀錄還在，只刪持股
  // 會留下它們。
  //
  // ponytail: 逐檔送 DELETE /holdings/:symbol，N 檔就是 N 個請求、不是一個資料庫交易，中途失敗會只清掉
  // 一部分（會照實回報幾檔失敗）。要一次全清且不可分割，請 bff-ts 開一支 DELETE /transactions。
  // 逐一送、不並發：bff-ts 有依用戶端的限流。
  function clearAll() {
    const savedHoldings = holdings.value
    const savedTransactions = transactions.value
    let undone = false
    holdings.value = []
    transactions.value = {}
    const instance = undoToast('已清除全部持股與交易紀錄', () => {
      undone = true
      holdings.value = savedHoldings
      transactions.value = savedTransactions
    }, async () => {
      pendingDeletes.delete(CLEAR_ALL_KEY)
      if (undone) return
      const failure = await sendClearAll()
      await load()
      if (failure) showErrorMessage(failure)
    })
    pendingDeletes.set(CLEAR_ALL_KEY, () => instance.close())
  }

  // null ＝ 全部清掉；字串 ＝ 給使用者看的失敗說明。
  async function sendClearAll(): Promise<string | null> {
    let symbols: string[]
    try {
      const response = await request<{ transactions: Transaction[] }>('/transactions')
      symbols = [...new Set((response.transactions ?? []).map(transaction => transaction.symbol))]
    } catch (error) {
      devWarn('holdings', 'GET /transactions unavailable', error)
      return '清除失敗：暫時無法連線，資料仍保留。'
    }
    let failed = 0
    for (const symbol of symbols) {
      if (await sendDelete(`/holdings/${encodeURIComponent(symbol)}`)) failed++
    }
    return failed ? `清除未完成：${symbols.length} 檔裡有 ${failed} 檔沒有清掉，請再按一次「清除全部」。` : null
  }

  // 離開頁面＝確定刪除：把所有還開著的復原提示關掉，各自的 onClose 會送出 DELETE。
  onBeforeUnmount(() => {
    for (const flush of pendingDeletes.values()) flush()
  })

  return {
    holdings, pending, loadFailed, market, quotesFailed, etfWindow, transactions,
    load, clear, loadTransactions, saveTransaction, removeHolding, removeTransaction, importTrades, clearAll
  }
}
