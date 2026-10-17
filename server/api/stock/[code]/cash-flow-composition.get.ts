import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { CashFlowCompositionPeriod, StockCashFlowCompositionResponse } from '#shared/types/stock-cash-flow-composition'
// GET /api/stock/:code/cash-flow-composition — 現金流量的組成，逐季＋年度（2026-10-17）。照 balance-composition.get.ts：32 季
// cachedFinancialStatement，跟現金流量表頁共用同一份快取；上游回 found:false 的季別略過。年度由 annualCashFlow 把同一年四季加總。
const QUARTERS = 32

const previousQuarter = (year: number, quarter: number): [number, number] => (quarter === 1 ? [year - 1, 4] : [year, quarter - 1])

const toPeriod = (statement: FinancialStatementResponse | null) => {
  if (!statement?.found || statement.fiscalYear === null || statement.fiscalQuarter === null) return null
  return { fiscalYear: statement.fiscalYear, fiscalQuarter: statement.fiscalQuarter, cashFlow: cashFlowCompositionOf(statement.statement) }
}

export default defineEventHandler(async (event): Promise<StockCashFlowCompositionResponse> => {
  const code = requireListedSymbol(event)
  // 讀不到（settle 回 null）回錯誤讓頁面交給全站讀取失敗提示；found:false 才是「沒有申報」
  const latestStatement = await settle(cachedFinancialStatement(code, 'cashFlowStatement', null, null))
  if (latestStatement === null) throw createError({ statusCode: 502, statusMessage: 'cash flow statement unavailable' })
  const latest = toPeriod(latestStatement)
  if (!latest) return { symbol: code, periods: [] }

  const earlier: [number, number][] = []
  let cursor: [number, number] = [latest.fiscalYear, latest.fiscalQuarter]
  for (let i = 1; i < QUARTERS; i += 1) {
    cursor = previousQuarter(...cursor)
    earlier.push(cursor)
  }
  const statements = await Promise.all(earlier.map(([year, quarter]) => settle(cachedFinancialStatement(code, 'cashFlowStatement', year, quarter))))
  const quarters = [latest, ...statements.map(toPeriod)]
    .filter(period => period !== null)
    .sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
  const periods: CashFlowCompositionPeriod[] = [
    ...quarters,
    ...annualCashFlow(quarters).map(year => ({ fiscalYear: year.fiscalYear, fiscalQuarter: null, cashFlow: year.cashFlow }))
  ]
  return { symbol: code, periods }
})
