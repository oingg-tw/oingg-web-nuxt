// 持股的金額計算：總市值、未實現損益、預估年度股利。
//
// 放在一個**零 import** 的純函式檔，是為了讓 scripts/check-holdings-summary.mjs 能直接 import 驗證
// （Node 24 會剝掉型別，scripts/check-market-phases.mjs 是前例）。所以這裡只能用 interface／type，
// 不能用 enum、namespace 或參數屬性——Node 只剝型別，不轉譯那些語法。
//
// 三條規則，每一條都是「不捏造數字」：
//   1. 字串自己轉。業務中台 的 averageCost（Decimal 18,4）與 /screener/values 的每一個值都以字串送來。
//   2. 價格 ≤ 0 當成沒有報價——同 server/utils/stock-data.ts 的 isRealClose：沒有成交的日子收盤是 0，
//      拿它去乘會算出一個市值 0、虧損 100% 的部位。
//   3. 缺值的列不進加總，而且會被計數，讓頁面說得出「N 檔未計入」。全部缺值時總計是 null，不是 0。

export interface HoldingFigures {
  quantity: number
  // 其中成本不明的股數（業務中台 a742fff）；省略＝0
  costUnknownQuantity?: number
  // **只算成本已知的股數**；全部成本不明時是 null
  averageCost: string | number | null
  price: string | number | null | undefined
  dividendPerShare: string | number | null | undefined
  // 這批持股領過的現金股利（業務中台 1074647，2026-10-23）：除息日計入、股數用除息前一天的持股，部位歸零後重新買進從 0 算。
  // 沒有（舊版或匯入預覽）當 0
  dividendsReceived?: string | number | null
}

export interface HoldingRowFigures {
  cost: number | null
  marketValue: number | null
  pnl: number | null
  pnlPct: number | null
  // 含息（2026-10-23，使用者 2026-10-05：「總覽要可以切換 含息 不含息 報酬率」）：未實現損益加上領過的現金股利
  pnlWithDividends: number | null
  pnlWithDividendsPct: number | null
  annualDividend: number | null
}

export interface HoldingsTotals {
  marketValue: number | null
  pnl: number | null
  pnlPct: number | null
  pnlWithDividends: number | null
  pnlWithDividendsPct: number | null
  annualDividend: number | null
  // 沒有報價、因此沒有算進總市值與損益的檔數
  unpricedCount: number
  // 沒有可用的每股股利、因此沒有算進預估股利的檔數
  dividendMissingCount: number
  // 有成本不明股數的檔數：市值照算，未實現損益只算成本已知的股數
  costUnknownCount: number
}

function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function holdingRowFigures(h: HoldingFigures): HoldingRowFigures {
  const averageCost = toAmount(h.averageCost)
  const rawPrice = toAmount(h.price)
  const price = rawPrice !== null && rawPrice > 0 ? rawPrice : null
  const dividendPerShare = toAmount(h.dividendPerShare)

  // 成本不明的股數（使用者 2026-10-05 選「成本不明」：庫存照算、損益不計入）只進市值，不進成本與損益
  const knownQuantity = h.quantity - (h.costUnknownQuantity ?? 0)
  const cost = averageCost === null || knownQuantity <= 0 ? null : knownQuantity * averageCost
  const marketValue = price === null ? null : h.quantity * price
  const pnl = price === null || cost === null ? null : knownQuantity * price - cost
  // 成本 0（配股或贈與取得，使用者可以填 0）時報酬率沒有定義，不是無限大
  const pnlPct = pnl === null || cost === null || cost === 0 ? null : (pnl / cost) * 100
  const annualDividend = dividendPerShare === null ? null : h.quantity * dividendPerShare
  // 含息只算成本已知的股數領到的那一份（照股數比例分），同未實現損益：成本不明的股數不進成本，它們的股利也不能拿來墊高報酬率
  // ponytail: 照現在的股數比例分攤，成本不明的那幾批如果是後來才取得，會略高估它們分到的股利；要精確得業務中台分批回報
  const dividends = toAmount(h.dividendsReceived) ?? 0
  const knownDividends = h.quantity > 0 ? dividends * Math.max(knownQuantity, 0) / h.quantity : 0
  const pnlWithDividends = pnl === null ? null : pnl + knownDividends
  const pnlWithDividendsPct = pnlWithDividends === null || cost === null || cost === 0 ? null : (pnlWithDividends / cost) * 100

  return { cost, marketValue, pnl, pnlPct, pnlWithDividends, pnlWithDividendsPct, annualDividend }
}

export function summarizeHoldings(rows: HoldingFigures[]): HoldingsTotals {
  let marketValue = 0
  let pnl = 0
  let pnlWithDividends = 0
  let pricedCost = 0
  let annualDividend = 0
  let pricedCount = 0
  let dividendCount = 0
  let unpricedCount = 0
  let dividendMissingCount = 0
  let costUnknownCount = 0
  let valuedCount = 0

  for (const row of rows) {
    const figures = holdingRowFigures(row)
    if ((row.costUnknownQuantity ?? 0) > 0) costUnknownCount += 1
    if (figures.marketValue === null) {
      unpricedCount += 1
    } else {
      marketValue += figures.marketValue
      valuedCount += 1
      // 全部成本不明的列：市值照算，損益沒有可算的部分
      if (figures.pnl !== null && figures.cost !== null) {
        pnl += figures.pnl
        pnlWithDividends += figures.pnlWithDividends ?? figures.pnl
        pricedCost += figures.cost
        pricedCount += 1
      }
    }
    // 股利不看價格：一檔暫停交易的股票照樣會配息
    if (figures.annualDividend === null) {
      dividendMissingCount += 1
    } else {
      annualDividend += figures.annualDividend
      dividendCount += 1
    }
  }

  return {
    marketValue: valuedCount ? marketValue : null,
    pnl: pricedCount ? pnl : null,
    // 分母只用「有報價的那些列」的成本。用全部成本當分母，會讓沒報價的部位默默把報酬率壓低。
    pnlPct: pricedCount && pricedCost !== 0 ? (pnl / pricedCost) * 100 : null,
    pnlWithDividends: pricedCount ? pnlWithDividends : null,
    pnlWithDividendsPct: pricedCount && pricedCost !== 0 ? (pnlWithDividends / pricedCost) * 100 : null,
    annualDividend: dividendCount ? annualDividend : null,
    unpricedCount,
    dividendMissingCount,
    costUnknownCount
  }
}

// ---- 報酬與大盤、績效統計的口徑（2026-10-23，業務中台 ae4c135；使用者選兩邊都含息：「比較接近用戶的真實報酬」）----
// returnBasis "total"：持股的現金股利在除息日計入、大盤用加權報酬指數（/market/taiex-daily-price 的 totalReturnClose）；舊版沒有這個
// 欄位＝都不含息、價格型加權指數。還沒讀到時當成含息（現在的業務中台都是），表頭與註腳才不會從「加權指數」換成「加權報酬指數」
export const isTotalReturn = (outcome: { ok: true; result: { returnBasis?: string } } | { ok: false } | null | undefined): boolean => !outcome?.ok || outcome.result.returnBasis === 'total'
export const benchmarkName = (totalReturn: boolean): string => (totalReturn ? '加權報酬指數' : '加權指數')

// ---- 與大盤比較：把加權指數對齊到持股的累積報酬 ----
//
// 兩條線從**同一天**起算：持股第一次有值的那一天（期間中才開始投資的人，前面那段沒有報酬可比）。
// 指數的基準是那天的**前一個交易日**收盤——業務中台 的累積報酬也是從起點前最後一個收盤算起（它用 2330
// 驗過：2480 ÷ 1760 − 1，1760 是起點前一天的收盤）。回傳的累積值都是小數（0.1 ＝ 10%）。

export interface BenchmarkPoint {
  date: string
  portfolio: number | null
  benchmark: number | null
}

export interface BenchmarkComparison {
  // 持股第一次有值的日期；整段沒有持股時是 null
  start: string | null
  points: BenchmarkPoint[]
  // 指數在整段（從 start 到最後一天）的報酬；缺基準或缺最後一天的收盤時是 null
  benchmark: number | null
}

export function compareWithBenchmark(series: { tradeDate: string; cumulative: string | null }[], index: Map<string, number>): BenchmarkComparison {
  const first = series.findIndex(point => point.cumulative !== null)
  if (first === -1) return { start: null, points: [], benchmark: null }
  const start = series[first]!.tradeDate
  let baseDay: string | null = null
  for (const day of index.keys()) if (day < start && (baseDay === null || day > baseDay)) baseDay = day
  const base = baseDay === null ? null : index.get(baseDay)!
  const relative = (date: string) => {
    const close = index.get(date)
    return base && close !== undefined ? close / base - 1 : null
  }
  const points = series.slice(first).map(point => ({
    date: point.tradeDate,
    portfolio: point.cumulative === null ? null : Number(point.cumulative),
    benchmark: relative(point.tradeDate)
  }))
  return { start, points, benchmark: relative(series.at(-1)!.tradeDate) }
}

// ---- 組合殖利率（市值加權） ----
//
// 使用者 2026-10-05 在 業務中台 問「殖利率跟大盤比呢」。口徑要跟大盤一樣（業務中台 指出）：個股用交易所每天公布的
// 殖利率（screener 的 dividendYield.EOD，單位 %），依市值加權——Σ(市值 × 殖利率) ÷ Σ(市值)。**不能**用預估
// 年股利（dividendPerShare.TTM）算，那是另一種定義，跟大盤比就不是同一把尺。
// 沒有殖利率的持股（ETF 沒有這個欄位、或沒報價）不進加權，回報涵蓋了多少比例的市值。
export interface WeightedYield {
  // 百分比（5.16 ＝ 5.16%）；沒有任何一檔有值時是 null
  value: number | null
  // 有殖利率的那幾檔占總市值的比例（0～1）
  coverage: number
}

// 今日漲跌（2026-10-15 使用者：「holdings 要加上今日漲跌幅」）：最近一個交易日的收盤對前一個有成交日的收盤，跟觀察清單的「漲跌」
// 同一個算法（stock.price 對 stock.previousClose）。那天沒成交、或沒有前一日收盤的那一檔沒有今日漲跌，不是 0。
export interface DayChangeInput {
  quantity: number
  price: string | number | null | undefined
  previousClose: string | number | null | undefined
  // 這筆收盤是哪一天。上市與上櫃更新時間不同（2026-10-15 twse-ts／tpex-ts 確認）：上櫃當天 18:00 前就有當天收盤，
  // 上市要到隔天 07:15 後（證交所 OpenAPI 隔天清晨才給前一交易日）。所以晚上的持股會一半是今天、一半是昨天
  date?: string | null
}

export interface DayChange {
  amount: number | null
  pct: number | null
}

function dayPrices(row: DayChangeInput): { price: number; previous: number } | null {
  const price = toAmount(row.price)
  const previous = toAmount(row.previousClose)
  return price !== null && price > 0 && previous !== null && previous > 0 ? { price, previous } : null
}

export function dayChange(row: DayChangeInput): DayChange {
  const prices = dayPrices(row)
  if (!prices) return { amount: null, pct: null }
  return { amount: row.quantity * (prices.price - prices.previous), pct: (prices.price / prices.previous - 1) * 100 }
}

// 整個組合：Σ 股數 × 漲跌 ÷ Σ 股數 × 前一日收盤。沒有今日漲跌的那幾檔分子分母都不算（不能當成沒漲沒跌），count 是算進去的檔數。
// 給了 date 就只算那一天的：不同天的漲跌加在一起、只標一個日期是錯的。收盤還停在更早一天的檔數在 staleCount
export function summarizeDayChange(rows: DayChangeInput[], date?: string | null): DayChange & { count: number; staleCount: number } {
  let amount = 0
  let base = 0
  let count = 0
  let staleCount = 0
  for (const row of rows) {
    const prices = dayPrices(row)
    if (!prices) continue
    if (date && row.date !== date) {
      staleCount += 1
      continue
    }
    amount += row.quantity * (prices.price - prices.previous)
    base += row.quantity * prices.previous
    count += 1
  }
  return count ? { amount, pct: base > 0 ? (amount / base) * 100 : null, count, staleCount } : { amount: null, pct: null, count: 0, staleCount }
}

export function weightedDividendYield(rows: { marketValue: number | null; yieldPct: number | null }[]): WeightedYield {
  let weighted = 0
  let covered = 0
  let total = 0
  for (const row of rows) {
    if (row.marketValue === null || row.marketValue <= 0) continue
    total += row.marketValue
    if (row.yieldPct === null || !Number.isFinite(row.yieldPct)) continue
    weighted += row.marketValue * row.yieldPct
    covered += row.marketValue
  }
  return { value: covered > 0 ? weighted / covered : null, coverage: total > 0 ? covered / total : 0 }
}

// ---- 產業占比（持股分析頁） ----
//
// 使用者 2026-10-05：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比」。產業用證交所類股（全市場目錄
// /api/hub/directory，個股總表同一份）。ETF 自成一類（台股 ETF 代號都以 00 開頭）；特別股歸到發行公司的產業
// （1312A → 1312）；目錄裡找不到的歸「其他」。
export function sectorOfSymbol(symbol: string, sectorBySymbol: Map<string, string>): string {
  if (symbol.startsWith('00')) return 'ETF'
  const issuer = /^\d{4}/.exec(symbol)?.[0]
  return (issuer && sectorBySymbol.get(issuer)) ?? '其他'
}

// 依標籤加總市值，由大到小。沒有市值（沒報價）的不計入。
export function groupByLabel(items: { label: string; value: number | null }[]): { label: string; value: number; count: number }[] {
  const groups = new Map<string, { label: string; value: number; count: number }>()
  for (const item of items) {
    if (item.value === null || item.value <= 0) continue
    const group = groups.get(item.label) ?? { label: item.label, value: 0, count: 0 }
    group.value += item.value
    group.count += 1
    groups.set(item.label, group)
  }
  return [...groups.values()].sort((a, b) => b.value - a.value)
}
