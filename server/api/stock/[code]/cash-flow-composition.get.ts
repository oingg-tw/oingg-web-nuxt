import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { CashFlowCompositionPeriod, StockCashFlowCompositionResponse } from '#shared/types/stock-cash-flow-composition'
// GET /api/stock/:code/cash-flow-composition — 現金流量的組成，逐季＋年度（2026-10-17）。同 balance-composition.get.ts 一次讀 35 季
//（cachedStatementHistory，2026-11-20 起）；上游回 found:false 的季別略過。年度由 annualCashFlow 把同一年四季加總。
// 35 季（2026-11-19，使用者：「要讓每個選項預設都有12358年喔」「底層用季計算也是同樣道理」）：圖預設看年度，年度要四季齊全；
// 最新一季是 Q3 時，32 季只湊得出 7 個完整年度，近8年是灰的。8 年 × 4 季＋當年已出的 3 季＝35
const QUARTERS = 35

const toPeriod = (statement: FinancialStatementResponse | null) => {
  if (!statement?.found || statement.fiscalYear === null || statement.fiscalQuarter === null) return null
  return { fiscalYear: statement.fiscalYear, fiscalQuarter: statement.fiscalQuarter, cashFlow: cashFlowCompositionOf(statement.statement) }
}

export default defineEventHandler(async (event): Promise<StockCashFlowCompositionResponse> => {
  const code = requireListedSymbol(event)
  // 讀不到（settle 回 null）回錯誤讓頁面交給全站讀取失敗提示；空陣列或全是 found:false 才是「沒有申報」。上游已經由舊到新
  const history = await settle(cachedStatementHistory(code, 'cashFlowStatement', QUARTERS))
  if (history === null) throw createError({ statusCode: 502, statusMessage: 'cash flow statement unavailable' })
  const quarters = history.entries.map(toPeriod).filter(period => period !== null)
  const periods: CashFlowCompositionPeriod[] = [
    ...quarters,
    ...annualCashFlow(quarters).map(year => ({ fiscalYear: year.fiscalYear, fiscalQuarter: null, cashFlow: year.cashFlow }))
  ]
  return { symbol: code, periods }
})
