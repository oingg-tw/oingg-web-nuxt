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
