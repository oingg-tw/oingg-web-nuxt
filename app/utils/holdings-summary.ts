// 持股的金額計算：總市值、未實現損益、預估年度股利。
//
// 放在一個**零 import** 的純函式檔，是為了讓 scripts/check-holdings-summary.mjs 能直接 import 驗證
// （Node 24 會剝掉型別，scripts/check-market-phases.mjs 是前例）。所以這裡只能用 interface／type，
// 不能用 enum、namespace 或參數屬性——Node 只剝型別，不轉譯那些語法。
//
// 三條規則，每一條都是「不捏造數字」：
//   1. 字串自己轉。bff-ts 的 averageCost（Decimal 18,4）與 /screener/values 的每一個值都以字串送來。
//   2. 價格 ≤ 0 當成沒有報價——同 server/utils/stock-data.ts 的 isRealClose：沒有成交的日子收盤是 0，
//      拿它去乘會算出一個市值 0、虧損 100% 的部位。
//   3. 缺值的列不進加總，而且會被計數，讓頁面說得出「N 檔未計入」。全部缺值時總計是 null，不是 0。

export interface HoldingFigures {
  quantity: number
  averageCost: string | number
  price: string | number | null | undefined
  dividendPerShare: string | number | null | undefined
}

export interface HoldingRowFigures {
  cost: number | null
  marketValue: number | null
  pnl: number | null
  pnlPct: number | null
  annualDividend: number | null
}

export interface HoldingsTotals {
  marketValue: number | null
  pnl: number | null
  pnlPct: number | null
  annualDividend: number | null
  // 沒有報價、因此沒有算進總市值與損益的檔數
  unpricedCount: number
  // 沒有可用的每股股利、因此沒有算進預估股利的檔數
  dividendMissingCount: number
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

  const cost = averageCost === null ? null : h.quantity * averageCost
  const marketValue = price === null ? null : h.quantity * price
  const pnl = marketValue === null || cost === null ? null : marketValue - cost
  // 成本 0（配股或贈與取得，使用者可以填 0）時報酬率沒有定義，不是無限大
  const pnlPct = pnl === null || cost === null || cost === 0 ? null : (pnl / cost) * 100
  const annualDividend = dividendPerShare === null ? null : h.quantity * dividendPerShare

  return { cost, marketValue, pnl, pnlPct, annualDividend }
}

export function summarizeHoldings(rows: HoldingFigures[]): HoldingsTotals {
  let marketValue = 0
  let pnl = 0
  let pricedCost = 0
  let annualDividend = 0
  let pricedCount = 0
  let dividendCount = 0
  let unpricedCount = 0
  let dividendMissingCount = 0

  for (const row of rows) {
    const figures = holdingRowFigures(row)
    // 成本恆有值：bff-ts 驗證 averageCost 為有限且 ≥ 0，所以缺的只會是價格。
    if (figures.marketValue === null || figures.pnl === null || figures.cost === null) {
      unpricedCount += 1
    } else {
      marketValue += figures.marketValue
      pnl += figures.pnl
      pricedCost += figures.cost
      pricedCount += 1
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
    marketValue: pricedCount ? marketValue : null,
    pnl: pricedCount ? pnl : null,
    // 分母只用「有報價的那些列」的成本。用全部成本當分母，會讓沒報價的部位默默把報酬率壓低。
    pnlPct: pricedCount && pricedCost !== 0 ? (pnl / pricedCost) * 100 : null,
    annualDividend: dividendCount ? annualDividend : null,
    unpricedCount,
    dividendMissingCount
  }
}

// ---- 與大盤比較：把加權指數對齊到持股的累積報酬 ----
//
// 兩條線從**同一天**起算：持股第一次有值的那一天（期間中才開始投資的人，前面那段沒有報酬可比）。
// 指數的基準是那天的**前一個交易日**收盤——bff-ts 的累積報酬也是從起點前最後一個收盤算起（它用 2330
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

export function compareWithBenchmark(series: { date: string; cumulative: string | null }[], index: Map<string, number>): BenchmarkComparison {
  const first = series.findIndex(point => point.cumulative !== null)
  if (first === -1) return { start: null, points: [], benchmark: null }
  const start = series[first]!.date
  let baseDay: string | null = null
  for (const day of index.keys()) if (day < start && (baseDay === null || day > baseDay)) baseDay = day
  const base = baseDay === null ? null : index.get(baseDay)!
  const relative = (date: string) => {
    const close = index.get(date)
    return base && close !== undefined ? close / base - 1 : null
  }
  const points = series.slice(first).map(point => ({
    date: point.date,
    portfolio: point.cumulative === null ? null : Number(point.cumulative),
    benchmark: relative(point.date)
  }))
  return { start, points, benchmark: relative(series.at(-1)!.date) }
}
