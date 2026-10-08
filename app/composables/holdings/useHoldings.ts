import { ElMessage } from 'element-plus'
import type { ImportedTrade } from '~/utils/broker-trade-csv'
import type { Holding, HoldingColumn, ImportOutcome, ImportResult, ImportShortfall, OpeningPosition, SaveColumnsResult, SaveResult, Transaction, TransactionInput } from '~/composables/holdings/holdings-model'

// 持股管理的帳本：bff-ts 的 /holdings 與 /transactions（市場資料在 useHoldingsMarket、期間報表在 useHoldingsReports，2026-10-08 拆出）。
// 彙總本身在 app/utils/holdings-summary.ts，這裡只負責「拿到」與「改」。
// **持股是交易紀錄的唯讀投影**（bff-ts 4467c44，2026-10-05 使用者決定）：沒有 POST／PATCH /holdings，新增或修改持股就是新增或修改
// 交易，股數與成本由 bff-ts 以先進先出重算（比照券商，取代移動平均）。前端不自己推算——每次寫入之後重新 GET /holdings。
// **狀態是 useState，持股各頁共用一份**：切頁不重抓（2026-10-05 量過，瓶頸在上游不在請求數）。頁面用 ensureLoaded()：同一個使用者
// 載入過就不再打 API；明確的重新整理與寫入之後用 load()。換人的保護：loadedFor 記著是誰的資料，不同 uid 先 clear() 再載入。
const CLEAR_ALL_KEY = 'all'

export function useHoldings() {
  // 沒登入會丟 401：這裡的呼叫端都在 try 裡、而且只在登入後才被頁面叫到
  const request = useAuthedFetch()
  const currentUser = useCurrentUser()
  const holdings = useState<Holding[]>('holdings-list', () => [])
  const pending = useState('holdings-pending', () => false)
  const loadFailed = useState('holdings-load-failed', () => false)
  const loadedFor = useState<string | null>('holdings-loaded-for', () => null)
  const { market, quotesFailed, etfWindow, marketYield, loadQuotes, loadReferenceData, loadMarketYield } = useHoldingsMarket()
  const { fetchPerformance, fetchRisk, fetchRealized, clearPeriodCache } = useHoldingsReports()

  // 等待刪除中的代號（復原視窗還開著）。重新載入時要把它們濾掉，否則剛刪的那一列會在
  // 復原提示還在的時候又冒回來。
  const pendingDeletes = new Map<string, () => void>()

  async function load() {
    clearPeriodCache()
    pending.value = true
    loadFailed.value = false
    try {
      // 特別股清單跟持股無關，跟 GET /holdings 同時發出
      const [response] = await Promise.all([request<{ holdings: Holding[] }>('/holdings'), loadReferenceData(), loadMarketYield()])
      // undefined（問不到）與 []（真的沒有）分開：前者是 loadFailed，後者是一份可以直接套用的答案。
      holdings.value = pendingDeletes.has(CLEAR_ALL_KEY)
        ? []
        : (response.holdings ?? []).filter(holding => !pendingDeletes.has(`holding:${holding.symbol}`))
      loadedFor.value = currentUser.value?.uid ?? null
      await loadQuotes(holdings.value.map(holding => holding.symbol))
    } catch (error) {
      loadFailed.value = true
      devWarn('holdings', 'GET /holdings unavailable', error)
    } finally {
      pending.value = false
    }
  }

  function clear() {
    clearPeriodCache()
    holdings.value = []
    transactions.value = {}
    market.value = {}
    loadFailed.value = false
    loadedFor.value = null
  }

  // 頁面進入時用這個：同一個使用者已經載入過就不打 API（側欄切頁 0 個請求）；換了人先清空再載入。
  async function ensureLoaded() {
    const uid = currentUser.value?.uid ?? null
    if (loadedFor.value !== null && loadedFor.value === uid && !loadFailed.value) return
    if (loadedFor.value !== uid) clear()
    await load()
  }

  // ---- 交易紀錄 ----

  // 依代號分開存，只在使用者打開那一檔的紀錄時才抓。
  const transactions = useState<Record<string, Transaction[] | 'failed'>>('holdings-transactions', () => ({}))

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
    // 成本不明只限買進，而且 price／fee／tax 必須是 0（bff-ts 規定，非 0 回 400）
    const costUnknown = input.action === 'BUY' && input.costUnknown
    const body = {
      action: input.action,
      quantity: input.quantity,
      // 欄位是 Decimal(18,4)：送出前就四捨五入，不讓資料庫替我們決定怎麼截。
      price: costUnknown ? 0 : Math.round(input.price * 1e4) / 1e4,
      fee: costUnknown ? 0 : Math.round(input.fee * 1e4) / 1e4,
      tax: input.action === 'SELL' ? Math.round(input.tax * 1e4) / 1e4 : 0,
      tradeDate: input.tradeDate,
      note: note === '' ? null : note,
      costUnknown
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
          transactions: trades.map(({ externalRef, tradeDate, symbol, action, quantity, price, fee, tax, costUnknown }) => ({ externalRef, tradeDate, symbol, action, quantity, price, fee, tax, ...(costUnknown ? { costUnknown } : {}) }))
        }
      })
      if (!dryRun) {
        await Promise.all([load(), reloadLoadedTransactions()])
        if (result.importId) announceImport(result.importId, result.inserted)
      }
      return { kind: 'ok', result }
    } catch (error) {
      // shortfalls 在回應主體最上層（problem+json 的延伸欄位）
      const data = (error as { data?: { shortfalls?: ImportShortfall[] } }).data
      if (bffErrorCode(error) === LEDGER_SHORTFALL && Array.isArray(data?.shortfalls)) return { kind: 'shortfalls', shortfalls: data.shortfalls }
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
        showErrorMessage(bffErrorCode(error) === LEDGER_SHORTFALL
          ? '無法撤銷：撤銷會讓之後手動記的賣出超過持有股數，所以一筆都沒有刪除。請先刪掉那幾筆手動交易。'
          : '撤銷失敗，這次匯入的交易仍保留')
      }
      await Promise.all([load(), reloadLoadedTransactions()])
    }, () => {})
  }

  // 清除全部持股與交易紀錄（使用者 2026-10-05 要求「一個按鈕清除所有持股明細」）。跟其他刪除一樣是
  // 延後送出、可以復原，不跳確認視窗（使用者先前定的刪除規則）。
  //
  // 一個請求、一個資料庫交易：`DELETE /transactions?all=true`（bff-ts 99ba0ca）會刪掉這個使用者的每一筆
  // 交易，包括期初部位與匯入的列，所以已出清、只剩紀錄的代號也一起清掉。少了 `all=true` 會回 400——
  // 那是 bff-ts 的保險：`/transactions/` 帶尾斜線也會落到這條路由，空字串 id 不能清掉整本帳。
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
    try {
      await request('/transactions', { method: 'DELETE', query: { all: 'true' } })
      return null
    } catch (error) {
      devWarn('holdings', 'DELETE /transactions?all=true failed', error)
      return '清除失敗：暫時無法連線，資料仍保留。'
    }
  }

  // ---- 自訂欄位 ----

  // undefined ＝ 讀不到；null ＝ 這個帳號從來沒存過（套用預設範例）；[] ＝ 使用者把欄位全部刪了。三者不同。
  async function fetchColumns(): Promise<HoldingColumn[] | null | undefined> {
    try {
      const response = await request<{ holdingColumns: { columns: HoldingColumn[] | null } }>('/users/me/holding-columns')
      return response.holdingColumns?.columns ?? null
    } catch (error) {
      devWarn('holdings', 'GET /users/me/holding-columns unavailable', error)
      return undefined
    }
  }

  async function saveColumns(columns: HoldingColumn[]): Promise<SaveColumnsResult> {
    try {
      await request('/users/me/holding-columns', { method: 'PUT', body: { columns } })
      return { ok: true }
    } catch (error) {
      // 欄位數是訂閱方案的「廣度」分級：超過上限回 403 code quota_exceeded（bff-ts 38cf8dc）。看 code 不看狀態碼——
      // 403 也可能是別的原因；上限本身從 entitlement 讀，不從訊息解析。
      if (bffErrorCode(error) === 'quota_exceeded') return { ok: false, reason: 'quota', message: describeBffError(error) }
      devWarn('holdings', 'PUT /users/me/holding-columns failed', error)
      return { ok: false, reason: 'failed', message: describeBffError(error) }
    }
  }

  // 離開頁面＝確定刪除：把所有還開著的復原提示關掉，各自的 onClose 會送出 DELETE。
  onBeforeUnmount(() => {
    for (const flush of pendingDeletes.values()) flush()
  })

  return {
    holdings, pending, loadFailed, market, quotesFailed, etfWindow, transactions, marketYield,
    load, ensureLoaded, clear, loadQuotes, loadTransactions, saveTransaction, removeHolding, removeTransaction, importTrades, clearAll, fetchRealized, fetchPerformance, fetchRisk, fetchColumns, saveColumns
  }
}
