import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { EquityCompositionPeriod, StockEquityCompositionResponse } from '#shared/types/stock-equity-composition'

// GET /api/stock/:code/equity-composition — 歸屬母公司權益的六項組成，每個會計年度一期。
//
// 為什麼是年度而不是逐季：股本和資本公積季與季之間幾乎不動，22 根季柱子裡有 20 根跟鄰居長得一樣，
// 堆疊圖看不出趨勢只看出雜訊。年度 Q4 快照＋最新一期＝6 根柱子，剛好跟 statements.get.ts 一樣是
// 六個快取呼叫（冷的時候六次，暖的時候零次）。
//
// 上游深度：balanceSheet 回得到 110Q1（2026-09-27 抽 5 檔實測）。這比記錄在案的「全市場 111Q1 財務
// 資料地板」深一年——那個地板是量在 metrics 上的，TTM 要湊四季所以晚一年起跑，原始報表沒有這個限制。
const YEARS = 5

// 上游整張表的數字都是字串（"259323701"）。不轉就會變成字串相接，而字串相接出來的和照樣是個數字、
// 照樣能跟 equity 相減，只是差了 30 個數量級——沒有任何一步會丟錯。所以在這裡一次轉乾淨。
const num = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toPeriod = (statement: FinancialStatementResponse | null): EquityCompositionPeriod | null => {
  const rows = statement?.statement
  // 沒有非控制權益的公司，上游的 equity_attributable_to_owners_of_parent 是 null，只填 equity
  // （5904 115Q2 就是這樣：五項加總 7,251,619 正好等於 equity）。退回 equity 是安全的，因為下面
  // 會把恆等式不成立的期別整個丟掉——真的有非控制權益卻退回總權益的話，差額就是 NCI，殘差不會是 0。
  const equity = num(rows?.equity_attributable_to_owners_of_parent) || num(rows?.equity)
  if (!rows || !equity) return null
  const { fiscalYear, fiscalQuarter } = statement
  if (fiscalYear === null || fiscalQuarter === null) return null

  const issuedCapital = num(rows.issued_capital)
  const capitalReserve = num(rows.capital_reserve)
  const retainedEarnings = num(rows.retained_earnings)
  const otherEquity = num(rows.other_equity_interest)
  const treasuryShares = num(rows.treasury_shares)
  return {
    fiscalYear,
    fiscalQuarter,
    label: `${fiscalYear}${fiscalQuarter === 4 ? '' : ` Q${fiscalQuarter}`}`,
    issuedCapital,
    capitalReserve,
    retainedEarnings,
    otherEquity,
    treasuryShares,
    equity,
    residual: issuedCapital + capitalReserve + retainedEarnings + otherEquity - treasuryShares - equity
  }
}

export default defineEventHandler(async (event): Promise<StockEquityCompositionResponse> => {
  const code = requireListedSymbol(event)

  // 沒帶 year/season 就是 bff-ts 自己的「最新一期」，跟 statements.get.ts 用同一個約定。年度清單從它
  // 往回數，所以剛換季的時候不需要改任何常數。
  const latest = toPeriod(await settle(cachedFinancialStatement(code, 'balanceSheet', null, null)))
  if (!latest) return { symbol: code, periods: [] }

  // 最新一期本身是 Q4 的話就不必再抓一次同一期，年度清單從它開始往回數。
  const latestIsAnnual = latest.fiscalQuarter === 4
  const firstAnnualYear = latestIsAnnual ? latest.fiscalYear : latest.fiscalYear - 1
  const annualYears = Array.from({ length: latestIsAnnual ? YEARS - 1 : YEARS }, (_, index) => firstAnnualYear - index)
  const annuals = await Promise.all(annualYears.map(year => settle(cachedFinancialStatement(code, 'balanceSheet', year, 4))))

  // 只回恆等式真的成立的期別（容差 1 元）。這張圖的全部價值就是「這幾塊加起來精確等於淨值」，
  // 一根加不起來的柱子比沒有柱子糟——它看起來跟其他柱子一樣可信。均勻抽樣 205 家零筆超出，所以
  // 這個過濾平常不會丟掉任何東西；它擋的是上游欄位缺漏或結構特殊的那幾家。
  const periods = [...annuals.map(toPeriod), latestIsAnnual ? null : latest]
    .filter((period): period is EquityCompositionPeriod => period !== null && Math.abs(period.residual) <= 1)
    .sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
  return { symbol: code, periods }
})
