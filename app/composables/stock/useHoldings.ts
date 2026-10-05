import { h } from 'vue'
import { ElMessage } from 'element-plus'

// 持股管理的資料層：bff-ts 的 /holdings（2026-08-30 就做好了，2026-10-05 才接上），加上算市值與預估
// 股利需要的市場資料。彙總本身在 app/utils/holdings-summary.ts，這裡只負責「拿到」與「改」。
//
// **狀態是頁面區域的 ref，不是 useState。** 每次進頁面重新載入、沒有 session 旗標，所以
// 「同步 watcher 必須放在 app.vue」那個陷阱（頁面卸載時 watcher 被停掉、session 旗標又擋住重新註冊）
// 在這裡不存在；也不會讓前一個人的持股殘留給同一個分頁的下一個登入者。
//
// HTTP 照 useUserWatchlist.ts 的形狀，刻意不同的一處：**authHeader() 放在 try 裡面**。它包著
// getIdToken() 的逾時，會丟錯；放在 try 外面（useStocks.addStock 的寫法）會變成未處理的 rejection。
export interface Holding {
  id: string
  symbol: string
  quantity: number
  // Decimal(18,4) 以字串送來；送出時是 number。
  averageCost: string
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface HoldingInput {
  quantity: number
  averageCost: number
  note: string | null
}

export type SaveResult =
  | { ok: true; holding: Holding }
  // 已經持有這一檔：頁面要切成編輯那一列，不是報錯
  | { ok: false; reason: 'duplicate'; existing: Holding }
  | { ok: false; reason: 'unknown' | 'gone' | 'failed'; message: string | null }

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

  async function request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
    const headers = await authHeader()
    if (!headers) throw Object.assign(new Error('not signed in'), { statusCode: 401 })
    return await $fetch<T>(path, {
      baseURL: config.public.apiBase,
      method: options.method ?? 'GET',
      headers,
      body: options.body as Record<string, unknown> | undefined,
      timeout: BFF_REQUEST_TIMEOUT_MS,
      ...(options.method ? {} : { cache: 'no-store' as const })
    })
  }

  // 公開資料：不帶身分、同一頁只抓一次。
  async function loadReferenceData() {
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
  }

  async function loadQuotes(symbols: string[]) {
    if (symbols.length === 0) return
    try {
      const response = await $fetch<ScreenerValuesResponse>('/screener/values', {
        baseURL: config.public.apiBase,
        method: 'POST',
        // 只送 stock.price 會 400（bff-ts 先把這個特殊欄位剝掉，剩下零個型錄欄位），所以一定要配一個
        // 型錄欄位——而 dividendPerShare.TTM 剛好就是普通股的每股股利。
        body: { symbols: symbols.slice(0, SCREENER_VALUES_MAX), columns: [{ field: 'stock.price' }, { field: 'dividendPerShare.TTM' }] },
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

  // 等待刪除中的那幾筆（復原視窗還開著）。重新載入時要把它們濾掉，否則剛刪的那一列會在
  // 復原提示還在的時候又冒回來。
  const pendingDeletes = new Map<string, { holding: Holding; undo: () => void; flush: () => void }>()

  async function load() {
    pending.value = true
    loadFailed.value = false
    try {
      const response = await request<{ holdings: Holding[] }>('/holdings')
      // undefined（問不到）與 []（真的沒有）分開：前者是 loadFailed，後者是一份可以直接套用的答案。
      holdings.value = (response.holdings ?? []).filter(holding => !pendingDeletes.has(holding.id))
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
    market.value = {}
    loadFailed.value = false
  }

  function pendingDeleteFor(symbol: string) {
    for (const entry of pendingDeletes.values()) if (entry.holding.symbol === symbol) return entry
    return null
  }

  // 新增與編輯**不做樂觀更新**：對話框本來就有等待狀態，樂觀更新還得寫回滾。
  async function add(symbol: string, input: HoldingInput): Promise<SaveResult> {
    // 剛刪掉、復原提示還開著，又想加回同一檔：那是「其實不想刪」——取消那筆刪除、切成編輯。
    const waiting = pendingDeleteFor(symbol)
    if (waiting) {
      waiting.undo()
      return { ok: false, reason: 'duplicate', existing: waiting.holding }
    }
    const existing = holdings.value.find(holding => holding.symbol === symbol)
    if (existing) return { ok: false, reason: 'duplicate', existing }
    try {
      const response = await request<{ holding: Holding }>('/holdings', { method: 'POST', body: { symbol, ...normalized(input) } })
      holdings.value = [response.holding, ...holdings.value]
      await loadQuotes([symbol])
      return { ok: true, holding: response.holding }
    } catch (error) {
      const status = bffErrorStatus(error)
      if (status === 409) {
        // 別的分頁或裝置已經加過——重新載入後把那一列交給頁面去編輯
        await load()
        const found = holdings.value.find(holding => holding.symbol === symbol)
        if (found) return { ok: false, reason: 'duplicate', existing: found }
      }
      if (status === 404) return { ok: false, reason: 'unknown', message: describeBffError(error) }
      return { ok: false, reason: 'failed', message: describeBffError(error) }
    }
  }

  async function update(id: string, input: HoldingInput): Promise<SaveResult> {
    try {
      const response = await request<{ holding: Holding }>(`/holdings/${id}`, { method: 'PATCH', body: normalized(input) })
      holdings.value = holdings.value.map(holding => (holding.id === id ? response.holding : holding))
      return { ok: true, holding: response.holding }
    } catch (error) {
      if (bffErrorStatus(error) === 404) {
        await load()
        return { ok: false, reason: 'gone', message: null }
      }
      return { ok: false, reason: 'failed', message: describeBffError(error) }
    }
  }

  // **刪除後可復原：DELETE 延到提示關閉才送**，而不是先刪、按復原時再 POST 回去。
  //
  // 重新 POST 會在網路失敗、或代號守衛回 404 時**永久弄丟**那筆持股（連 createdAt 一起）。延後送出只會
  // 往安全的方向失敗：最壞的情況是那一列還在。
  //
  // ponytail: 在復原視窗內直接關掉分頁＝取消刪除（那一列留著，安全的方向）。如果有人回報「刪掉的又
  // 回來了」，再加一個 pagehide 時用預先取好的 header 送 keepalive DELETE。
  function remove(holding: Holding, label: string) {
    const index = holdings.value.findIndex(item => item.id === holding.id)
    holdings.value = holdings.value.filter(item => item.id !== holding.id)
    let undone = false
    const restore = () => {
      const next = [...holdings.value]
      next.splice(Math.min(index, next.length), 0, holding)
      holdings.value = next
    }
    const instance = ElMessage({
      type: 'info',
      duration: UNDO_WINDOW_MS,
      showClose: false,
      message: h('span', { class: 'app-undo-toast' }, [
        h('span', `已刪除 ${label}`),
        h('button', {
          type: 'button',
          class: 'app-undo-toast__action',
          // 刪除鈕跟著那一列消失了；焦點若不移到這裡，鍵盤使用者會被丟回頁首、找不到復原。
          onVnodeMounted: (vnode: { el: unknown }) => (vnode.el as HTMLElement | null)?.focus(),
          onClick: () => {
            undone = true
            restore()
            instance.close()
          }
        }, '復原')
      ]),
      // 逾時、Esc、或離開頁面時的 flush 都走到這裡——只有一條送出 DELETE 的路
      onClose: async () => {
        pendingDeletes.delete(holding.id)
        if (undone) return
        if (!(await sendDelete(holding.id))) {
          restore()
          showErrorMessage(`刪除 ${label} 失敗，這筆持股仍保留`)
        }
      }
    })
    pendingDeletes.set(holding.id, {
      holding,
      undo: () => {
        undone = true
        restore()
        instance.close()
      },
      flush: () => instance.close()
    })
  }

  async function sendDelete(id: string): Promise<boolean> {
    try {
      await request(`/holdings/${id}`, { method: 'DELETE' })
      return true
    } catch (error) {
      // 404：那一筆已經不在了——對刪除來說那就是想要的結果。
      if (bffErrorStatus(error) === 404) return true
      devWarn('holdings', `DELETE /holdings/${id} failed`, error)
      return false
    }
  }

  // 離開頁面＝確定刪除：把所有還開著的復原提示關掉，各自的 onClose 會送出 DELETE。
  onBeforeUnmount(() => {
    for (const entry of pendingDeletes.values()) entry.flush()
  })

  return { holdings, pending, loadFailed, market, quotesFailed, etfWindow, load, clear, add, update, remove }
}

// 欄位是 Decimal(18,4)：送出前就四捨五入到 4 位，不讓資料庫替我們決定怎麼截。空白備註存成 null。
function normalized(input: HoldingInput) {
  const note = input.note?.trim() ?? ''
  return {
    quantity: input.quantity,
    averageCost: Math.round(input.averageCost * 1e4) / 1e4,
    note: note === '' ? null : note
  }
}
