import { ElMessage } from 'element-plus'
import type { ImportedTrade } from '~/utils/broker-trade-csv'

// 持股管理的資料層：bff-ts 的 /holdings 與 /transactions，加上算市值與預估股利需要的市場資料。
// 彙總本身在 app/utils/holdings-summary.ts，這裡只負責「拿到」與「改」。
//
// **持股是交易紀錄的唯讀投影**（bff-ts 4467c44，2026-10-05 使用者決定）：沒有 POST／PATCH /holdings，
// 新增或修改持股就是新增或修改交易，股數與成本由 bff-ts 以先進先出重算（2026-10-05 使用者決定比照券商，取代原本的移動平均）。前端**不**自己推算——那會讓
// 成本法有兩份而漂移——每次寫入之後重新 GET /holdings。
//
// **狀態是 useState，持股側欄三頁（總覽、績效、自訂欄位）共用一份**：切頁不重抓（2026-10-05 跟 bff-ts 量過，
// 這是效益最大的一項；合併成一支「帶市場資料的持股」端點反而省不到時間——瓶頸在上游本身，不在請求數）。
// 頁面用 ensureLoaded()：同一個使用者已經載入過就不再打 API；明確的重新整理與寫入之後用 load()。
//
// 換人的保護：loadedFor 記著是誰的資料，ensureLoaded 遇到不同的 uid 會先 clear() 再載入，所以前一個人的持股
// 不會在下一個人的畫面上閃現。登出時頁面的 watcher 也會 clear()。
// 沒有 session 旗標擋住重新註冊，所以「同步 watcher 必須放在 app.vue」那個陷阱在這裡不適用。
//
// HTTP 照 useUserWatchlist.ts 的形狀，刻意不同的一處：**authHeader() 放在 try 裡面**。它包著
// getIdToken() 的逾時，會丟錯；放在 try 外面（useStocks.addStock 的寫法）會變成未處理的 rejection。
export interface Holding {
  symbol: string
  quantity: number
  // 其中成本不明的股數（bff-ts a742fff）。成本不明的股數先賣。
  costUnknownQuantity: number
  // Decimal 以字串送來。**只算成本已知的股數**；全部成本不明時是 null
  averageCost: string | null
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
  // 匯入的列才有（bff-ts f3388fd）；手動輸入三個都是 null。期初部位是 source "opening"；
  // 自動入帳的除權配股是 source "stock-dividend"——那是 bff-ts 即時算的虛擬列，id 不是 UUID，不能改也不能刪。
  source: string | null
  externalRef: string | null
  importId: string | null
  // 取得成本不明的買進（bff-ts a742fff）：庫存照算、已實現損益不計入、報酬率當成以市值轉入
  costUnknown: boolean
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
  // 只有買進可以是成本不明；成本不明時 price 送 0、不帶費稅（bff-ts 規定）
  costUnknown: boolean
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

export interface RealizedResult {
  from: string | null
  to: string | null
  // 只有區間內至少有一筆賣出的代號。excluded* ＝ 賣到成本不明股數、因此不計入損益的部分
  symbols: { symbol: string; realizedProfitLoss: string; excludedSellCount: number; excludedShares: number }[]
  // 各列四捨五入後的加總，所以畫面上的列一定加得起來
  totalRealizedProfitLoss: string
  excludedSellCount: number
  excludedShares: number
}

export interface PerformanceResult {
  from: string
  to: string
  // 期間時間加權報酬（小數字串，6 位）；整段沒有持股時是 null
  twr: string | null
  // 每個加權指數交易日的累積報酬；第一次有持股之前是 null（不是 0——那會被讀成「那段時間持平」）
  series: { date: string; cumulative: string | null }[]
  // 沒成交、沿用前一個收盤價的天數。刻意不顯示（使用者 2026-10-05：「不用特別寫出來」）——逐檔列出
  // 讀起來像錯誤清單。2026-10-05 量到的大多是上櫃日線停在 9/24 的資料延遲，不是真的沒成交（已回報上游）。
  missingPrices: { symbol: string; dates: number }[]
  // ---- 2026-10-07 加的實際績效指標（bff-ts c4c5b5a／ddb5023；欄位意義見 bff-ts holdings.types.ts 的
  // PortfolioPerformanceReport）。全部是 6 位小數字串或 null；null 的原因由 utils/holdings-metrics.ts 分開命名。
  // 資金加權報酬，跟 twr 同一個尺度（整段期間）
  mwr: string | null
  // 期間不滿 365 天時兩個都是 null
  annualized: { twr: string | null; mwr: string | null }
  // 金額是元的整數字串；turnover、costRatio 是整段期間的值、不年化，沒有曝險時是 null
  trading: { buyAmount: string; sellAmount: string; fees: string; taxes: string; averageMarketValue: string | null; turnover: string | null; costRatio: string | null }
  // sampleDays 少於 120 時三個值都是 null
  benchmarkComparison: { sampleDays: number; upCapture: string | null; downCapture: string | null; omega: string | null }
  // 全部年化；sampleDays 少於 120、或 riskFree 是 null 時全部是 null；calmar 期間不滿一年也是 null
  riskAdjusted: {
    sampleDays: number
    sharpe: string | null
    sortino: string | null
    calmar: string | null
    m2: string | null
    beta: string | null
    jensenAlpha: string | null
    trackingError: string | null
    informationRatio: string | null
  }
  // 五大銀行一年期定存；sourcePeriod ≠ period 表示那個月還沒有資料、沿用較早的月份
  riskFree: { source: string; latestPeriod: string | null; rates: { period: string; ratePct: number; sourcePeriod: string }[] } | null
}

export type PerformanceOutcome = { ok: true; result: PerformanceResult } | { ok: false; message: string }

// 自訂欄位（GET/PUT /users/me/holding-columns，整份取代；規格 2026-10-05 已送 bff-ts）。公式只存不算，
// 計算在 app/utils/holdings-formula.ts。
export interface HoldingColumn {
  id: string
  label: string
  formula: string
  format: 'number' | 'percent' | 'money'
  decimals: number
}

export type SaveColumnsResult = { ok: true } | { ok: false; reason: 'quota' | 'failed'; message: string | null }

export interface RiskDrawdown {
  // ≤ 0 的小數；期間內沒跌過是 "0.000000"
  depth: string
  peakDate: string | null
  troughDate: string | null
  // 回到前高的那一天；期間結束時還沒回到是 null
  recoveryDate: string | null
}

// 2026-10-07 加的分佈型風險：下行標準差（年化、門檻 0）、潰瘍指數、單日 95% VaR／ES（報酬，通常 ≤ 0）。
// 樣本少於 100 個交易日時 VaR／ES 是 null。
export interface RiskDistribution {
  downsideDeviation: string | null
  ulcerIndex: string | null
  valueAtRisk95: string | null
  expectedShortfall95: string | null
}

export interface RiskReport {
  from: string
  to: string
  tradingDays: number
  weightsAsOf: string | null
  // 現在持股的總市值（元，整數字串）；VaR／ES 的金額就是拿它乘的
  marketValue: string | null
  portfolio: { annualizedVolatility: string | null; beta: string | null; correlation: string | null; maxDrawdown: RiskDrawdown | null; valueAtRisk95Amount: string | null; expectedShortfall95Amount: string | null } & RiskDistribution
  benchmark: { annualizedVolatility: string | null; maxDrawdown: RiskDrawdown | null } & RiskDistribution
  // 只看現在的市值權重，所以除非沒有持股都有值。effectiveHoldings ＝ 1 ÷ HHI
  concentration: { hhi: string; effectiveHoldings: string; topThreeWeight: string } | null
  // Σ wᵢσᵢ ÷ σₚ（≥ 1）；樣本少於 120 個交易日是 null
  diversificationRatio: string | null
  // partial ＝ 期間中才有股價（例如中途上市），firstPriceDate 之前沒有參與。riskContribution 是佔組合變異數的
  // 比例（加總約 1）；樣本少於 120 天、或這一檔沒參與時是 null
  holdings: { symbol: string; weight: string | null; coverage: 'full' | 'partial' | 'none'; firstPriceDate: string | null; riskContribution: string | null }[]
}

export type RiskOutcome = { ok: true; result: RiskReport } | { ok: false; message: string }

export interface HoldingMarket {
  price: string | null
  priceDate: string | null
  dividendPerShare: string | number | null
  // 交易所公布的殖利率（%，screener 的 dividendYield.EOD）；ETF 沒有這個欄位
  dividendYield: number | null
  yieldDate: string | null
}

interface ScreenerValue { value: string | null; knowledgeDate: string | null }
interface ScreenerValuesResponse { results: { symbol: string; values: Record<string, ScreenerValue | undefined> }[] }
interface PreferredStockRow { symbol: string; dividendRate: number | null }
// GET /market/etf-distributions?symbol=（analysis-ts cb2aa41e、bff-ts 61a75a8）。非 ETF 回 200、found false。
// trailing12 在 found false 時是 null；有紀錄但近一年沒配是 0——兩者意思不同。
interface EtfDistributions {
  found: boolean
  trailing12MonthDistributionPerUnit: number | null
  trailing12MonthWindow: { start: string; end: string } | null
}

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

  const holdings = useState<Holding[]>('holdings-list', () => [])
  const pending = useState('holdings-pending', () => false)
  const loadFailed = useState('holdings-load-failed', () => false)
  // ponytail: 報價在這個分頁裡快取到整頁重新整理為止（已經有報價的代號不再問）。一天才變一次，
  // 有人反映「價格沒更新」再加 TTL。
  const market = useState<Record<string, HoldingMarket>>('holdings-market', () => ({}))
  const quotesFailed = useState('holdings-quotes-failed', () => false)
  const etfWindow = useState<{ from: string; to: string } | null>('holdings-etf-window', () => null)
  const loadedFor = useState<string | null>('holdings-loaded-for', () => null)
  // 期間型的結果（交易績效、風險）依「端點＋期間」快取在分頁裡：回到同一個期間不再發請求（使用者 2026-10-05
  // 反映兩支都超過一秒，主因在 bff-ts 那邊，這裡先把重複的請求省掉）。任何寫入之後 load() 會清掉它——
  // 帳本變了，舊的損益與報酬就不對了。
  const periodCache = useState<Record<string, unknown>>('holdings-period-cache', () => ({}))

  async function cachedPeriod<T extends { ok?: boolean } | object | null>(key: string, fetcher: () => Promise<T>, keep: (value: T) => boolean): Promise<T> {
    if (key in periodCache.value) return periodCache.value[key] as T
    const value = await fetcher()
    if (keep(value)) periodCache.value = { ...periodCache.value, [key]: value }
    return value
  }
  const currentUser = useCurrentUser()

  // 每股股利的三個來源，彼此不重疊（批次的 liveDividendPerShare.EOD 對 ETF 與特別股是 null），所以合併時
  // 不需要知道一檔是什麼型別。
  // 大盤殖利率（GET /macro/equity-risk-premium 的 supplySide.dividendYield）：交易所公布的個股殖利率、依市值加權、
  // 只含上市公司。一天才變一次，分頁內抓一次。
  const marketYield = useState<{ value: number; date: string | null } | null>('holdings-market-yield', () => null)

  // 特別股清單是全市場公開資料、很少變：分頁內抓一次，三頁共用
  const preferredDividend = useState<Record<string, number> | null>('holdings-preferred-dividend', () => null)

  async function request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
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

  // 公開資料：不帶身分、分頁內只抓一次。跟 GET /holdings 同時發出（它跟持股無關，不用等）。
  async function loadMarketYield() {
    if (marketYield.value) return
    try {
      const response = await $fetch<{ supplySide?: { dividendYield?: number | null; dividendYieldTradeDate?: string | null } }>('/macro/equity-risk-premium', { baseURL: config.public.apiBase, timeout: BFF_REQUEST_TIMEOUT_MS })
      const value = response.supplySide?.dividendYield
      if (typeof value === 'number') marketYield.value = { value, date: response.supplySide?.dividendYieldTradeDate ?? null }
    } catch (error) {
      devWarn('holdings', 'GET /macro/equity-risk-premium unavailable', error)
    }
  }

  async function loadReferenceData() {
    if (preferredDividend.value) return
    const [preferred] = await Promise.allSettled([
      $fetch<{ entries: PreferredStockRow[] }>('/stocks/preferred-stocks', { baseURL: config.public.apiBase, timeout: BFF_REQUEST_TIMEOUT_MS })
    ])
    if (preferred.status === 'fulfilled') {
      // 讀 bff 的**原始** dividendRate（每股元、發行條件所訂）。usePreferredStockList.ts 把 UI 的
      // dividendRate 對應成 nominalDividendRatePct（百分比）——拿那個來乘股數會錯 10 倍以上。
      preferredDividend.value = Object.fromEntries(
        preferred.value.entries.filter(row => row.dividendRate !== null).map(row => [row.symbol, row.dividendRate!])
      )
    } else {
      devWarn('holdings', 'GET /stocks/preferred-stocks unavailable', preferred.reason)
    }
  }

  // ETF 的每單位配息。台股 ETF 的代號都以 00 開頭，所以用代號就知道要問哪幾檔，跟報價同時發出；不必等報價
  // 回來看普通股股利是不是 null（那樣會連「沒配息的普通股」一起問，也多串一段等待）。
  // 非 ETF 會回 found false。
  async function fetchEtfDividends(symbols: string[]): Promise<Map<string, EtfDistributions>> {
    const results = await Promise.allSettled(symbols.map(symbol =>
      $fetch<EtfDistributions>('/market/etf-distributions', { baseURL: config.public.apiBase, query: { symbol }, timeout: BFF_REQUEST_TIMEOUT_MS })
        .then(response => [symbol, response] as const)))
    const found = new Map<string, EtfDistributions>()
    for (const result of results) {
      if (result.status === 'rejected') devWarn('holdings', 'GET /market/etf-distributions unavailable', result.reason)
      else if (result.value[1].found) found.set(result.value[0], result.value[1])
    }
    return found
  }

  async function loadQuotes(symbols: string[]) {
    const missing = symbols.filter(symbol => !market.value[symbol])
    if (missing.length === 0) return
    try {
      const [response, etf] = await Promise.all([
        $fetch<ScreenerValuesResponse>('/screener/values', {
          baseURL: config.public.apiBase,
          method: 'POST',
          // 只送 stock.price 會 400（bff-ts 先把這個特殊欄位剝掉，剩下零個型錄欄位），所以一定要配一個
          // 型錄欄位——而 liveDividendPerShare.EOD 剛好就是普通股的每股股利。
          //
          // 用 liveDividendPerShare.EOD（analysis-ts 78fe0f9a）而不是 dividendPerShare.TTM：後者的窗口是「最新財報季末往前
          // 一年」，一年配一次、今年除息比去年晚一點的公司兩次除息都落在窗口外，變成 0（2026-10-05 實測 2364、3231，
          // 總覽因此默默少算）。新欄位是「最新交易日往前 12 個月內已除息」的現金股利、已換算配股後股數，所以
          // 「目前股數 × 值」就是預估股利。實測 3231 5.5、2364 1.82、2330 24（舊欄位 0、0、22）。
          // dividendYield.EOD：跟大盤殖利率同一個來源（交易所公布），才能放在一起比
          body: { symbols: missing.slice(0, SCREENER_VALUES_MAX), columns: [{ field: 'stock.price' }, { field: 'stock.previousClose' }, { field: 'liveDividendPerShare.EOD' }, { field: 'dividendYield.EOD' }] },
          timeout: BFF_REQUEST_TIMEOUT_MS
        }),
        fetchEtfDividends(missing.filter(symbol => symbol.startsWith('00')))
      ])
      const next = { ...market.value }
      for (const row of response.results) {
        // stock.price 只是「最新交易日那一天」的收盤，那天沒有值就是 null；持股只需要最近一筆價格（使用者
        // 2026-10-07：「我並不需要他每天都有成交價，有最新價格就可以了」，起因是 8416 實威 10-06 的 stock.price
        // 是 null、previousClose 169 在 09-24）。所以退回 previousClose，日期跟著它走，頁面會標出用了較舊價格的那幾檔。
        const latest = row.values['stock.price']
        const price = latest?.value == null && row.values['stock.previousClose']?.value != null ? row.values['stock.previousClose'] : latest
        // 三個來源彼此不重疊：ETF 近 12 個月配息、特別股發行條件股利、普通股近 12 個月已除息現金股利
        const etfDividend = etf.get(row.symbol)?.trailing12MonthDistributionPerUnit ?? null
        const yieldValue = row.values['dividendYield.EOD']
        next[row.symbol] = {
          price: price?.value ?? null,
          priceDate: price?.knowledgeDate ?? null,
          dividendPerShare: etfDividend ?? preferredDividend.value?.[row.symbol] ?? row.values['liveDividendPerShare.EOD']?.value ?? null,
          dividendYield: yieldValue?.value === null || yieldValue?.value === undefined ? null : Number(yieldValue.value),
          yieldDate: yieldValue?.knowledgeDate ?? null
        }
      }
      const window = [...etf.values()].find(item => item.trailing12MonthWindow)?.trailing12MonthWindow
      if (window) etfWindow.value = { from: window.start, to: window.end }
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
    periodCache.value = {}
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
    periodCache.value = {}
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

  // ---- 期間報酬率（GET /holdings/performance，bff-ts 0a8dcd9） ----
  //
  // 時間加權報酬、不含息。每日報酬是「流入算開盤前、流出算收盤後」：分母包含當天投入的錢，所以大筆加碼
  // 的隔天不會算出 −2041% 這種爆掉的單日報酬（bff-ts 對原規格的更正）。series 的日期就是加權指數的交易日，
  // 跟 /market/taiex-daily-price 逐日對得上。超過約 8 年（個股日線深度）回 400，訊息寫出最早可選的日期。
  async function fetchPerformance(from: string, to: string): Promise<PerformanceOutcome> {
    return cachedPeriod(`performance|${from}|${to}`, () => requestPerformance(from, to), outcome => outcome.ok)
  }

  async function requestPerformance(from: string, to: string): Promise<PerformanceOutcome> {
    try {
      return { ok: true, result: await request<PerformanceResult>('/holdings/performance', { query: { from, to } }) }
    } catch (error) {
      devWarn('holdings', 'GET /holdings/performance unavailable', error)
      // bff-ts 的訊息是英文：`... "from" must be on or after 2018-08-14`。抽日期換成中文。
      const earliest = bffErrorStatus(error) === 400 ? /on or after (\d{4}-\d{2}-\d{2})/.exec(describeBffError(error) ?? '')?.[1] : undefined
      return { ok: false, message: earliest ? `個股的歷史價格最早到 ${earliest}，請把開始日期設在那天之後` : '期間報酬率暫時無法載入' }
    }
  }

  // ---- 風險指標（GET /holdings/risk，bff-ts 23b7b09） ----
  //
  // 用「現在每一檔的市值比例」套用過去的股價回推（使用者在 bff-ts 那邊選的做法）。刻意沒有報酬與夏普比率：
  // 持股是事後選的，回推的報酬會偏高。數值都是 6 位小數字串；資料不足時是 null。
  async function fetchRisk(from: string, to: string): Promise<RiskOutcome> {
    return cachedPeriod(`risk|${from}|${to}`, () => requestRisk(from, to), outcome => outcome.ok)
  }

  async function requestRisk(from: string, to: string): Promise<RiskOutcome> {
    try {
      return { ok: true, result: await request<RiskReport>('/holdings/risk', { query: { from, to } }) }
    } catch (error) {
      devWarn('holdings', 'GET /holdings/risk unavailable', error)
      // 同 /holdings/performance：期間超過股價深度時，英文訊息裡帶著最早可選的日期
      const earliest = bffErrorStatus(error) === 400 ? /on or after (\d{4}-\d{2}-\d{2})/.exec(describeBffError(error) ?? '')?.[1] : undefined
      return { ok: false, message: earliest ? `個股的歷史價格最早到 ${earliest}，請把開始日期設在那天之後` : '風險指標暫時無法載入' }
    }
  }

  // ---- 已實現損益（GET /holdings/realized，bff-ts e516d1e） ----
  //
  // 區間只篩選**賣出日**；成本以整段帳本先進先出配對，所以區間開始前的買進照樣帶入成本。已出清的
  // 代號也會列出（GET /holdings 只有股數大於 0 的）。股利不計入。null ＝ 讀不到。
  async function fetchRealized(from: string | null, to: string | null): Promise<RealizedResult | null> {
    return cachedPeriod(`realized|${from}|${to}`, () => requestRealized(from, to), result => result !== null)
  }

  async function requestRealized(from: string | null, to: string | null): Promise<RealizedResult | null> {
    try {
      return await request<RealizedResult>('/holdings/realized', { query: { ...(from ? { from } : {}), ...(to ? { to } : {}) } })
    } catch (error) {
      devWarn('holdings', 'GET /holdings/realized unavailable', error)
      return null
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
    load, ensureLoaded, clear, loadTransactions, saveTransaction, removeHolding, removeTransaction, importTrades, clearAll, fetchRealized, fetchPerformance, fetchRisk, fetchColumns, saveColumns
  }
}
