// 持股管理的型別、錯誤代碼與訊息（2026-10-08 從 useHoldings 拆出）：useHoldings（帳本與自訂欄位）、useHoldingsMarket（市場資料）、
// useHoldingsReports（期間報表）三支共用。
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
  // 2026-10-07（bff-ts 9d691cd）：期間內賣出的統計。sellCount 0 時其他都是 null；金額是元的小數字串、可為負
  tradeStats: {
    sellCount: number
    winCount: number
    lossCount: number
    winRate: string | null
    averageWin: string | null
    averageLoss: string | null
    profitFactor: string | null
    averageHoldingDays: string | null
  }
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
  // 2026-10-07（bff-ts 9d691cd）：逐年／逐月報酬（頭尾可能不滿一整期，tradingDays 看得出來）
  periodReturns: {
    yearly: { period: string; portfolio: string | null; benchmark: string | null; tradingDays: number }[]
    monthly: { period: string; portfolio: string | null; benchmark: string | null; tradingDays: number }[]
  }
  // 實際帳本的跌幅：underwaterDays ＝ 期間內低於前高的交易日數，longestUnderwaterDays ＝ 最長連續那一段
  drawdown: { maxDrawdown: string; peakDate: string | null; troughDate: string | null; recoveryDate: string | null; underwaterDays: number; longestUnderwaterDays: number; currentDrawdown: string }
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
  // 2026-10-07（bff-ts 9d691cd）。上游失敗時整個是 null。effectiveSectors ＝ 1 ÷ 產業 HHI
  sectors: { effectiveSectors: string; groups: { sectorCode: string | null; sectorName: string | null; weight: string; symbols: string[] }[] } | null
  // 組合本益比／股價淨值比是調和平均；*Coverage ＝ 有這個數字的持股佔市值的比例（虧損公司與 ETF 沒有本益比）
  fundamentals: { dividendIncome: string | null; dividendYield: string | null; dividendCoverage: string | null; peRatio: string | null; peCoverage: string | null; pbRatio: string | null; pbCoverage: string | null } | null
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

// 賣超的判斷看 `error.code === "LEDGER_OVERSOLD"`（bff-ts 說那是唯一穩定的部分）。數字目前只在英文訊息裡：
// `Selling 500 shares of "2330" on 2026-10-05 would exceed the 300 you hold at that point`
// 抽出日期與當時股數換成中文；措辭變了就退回不帶數字的說法，不顯示英文。
export const LEDGER_OVERSOLD = 'ledger_oversold'
// 一律依 bff 的錯誤代碼判斷，不看狀態碼、不解析訊息文字（使用者 2026-10-08：「依錯誤代碼判斷」）。
// 匯入或撤銷匯入會讓之後的賣出超過持有股數（bff e1acb32）
export const LEDGER_SHORTFALL = 'ledger_shortfall'
// 期間早於股價歷史；最早可選的日期在 earliestPriceDate（bff aa12b78）。原本是用正規表達式從英文訊息裡抓日期
const RANGE_BEFORE_PRICE_HISTORY = 'range_before_price_history'

export function earliestPriceDateOf(error: unknown): string | null {
  if (bffErrorCode(error) !== RANGE_BEFORE_PRICE_HISTORY) return null
  const date = (error as { data?: { earliestPriceDate?: unknown } }).data?.earliestPriceDate
  return typeof date === 'string' ? date : null
}

const OVERSOLD_PATTERN = /on (\d{4}-\d{2}-\d{2}) would exceed the (\d+) you hold/

export function oversoldMessage(raw: string | null): string {
  const match = raw ? OVERSOLD_PATTERN.exec(raw) : null
  if (!match) return '這筆賣出會超過當時持有的股數。'
  return `這筆賣出會超過當時持有的股數：${match[1]} 當時持有 ${groupThousands(match[2]!)} 股。`
}
