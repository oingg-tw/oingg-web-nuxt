import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { CashFlowCompositionPeriod, StockCashFlowCompositionResponse } from '#shared/types/stock-cash-flow-composition'
// GET /api/stock/:code/cash-flow-composition — 現金流量的組成，逐季＋年度（2026-10-17）。同 balance-composition.get.ts 一次讀 35 季
//（cachedStatementHistory，2026-11-20 起）；上游回 found:false 的季別略過。年度由 annualCashFlow 把同一年四季加總。
// 40 季（2026-11-19 是 35，使用者：「要讓每個選項預設都有12358年喔」；2026-11-24 跟著全站改成 40 季）：圖預設看年度，年度要四季齊全。
// 上游一次最多回 40 季（43 季回錯誤，2026-11-24 量到），最新一季是 Q3 時只湊得出 9 個完整年度，2026-11-25 全站改成近 1／3／5／10 年後
// 近10年就灰了：最舊那一年不滿四季時，從它的前一季往前補讀缺的那幾季，只拿來加總年度；單季照舊 40 季，跟其他頁從同一年開始
const QUARTERS = STOCK_CHART_HISTORY_LIMIT

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
  // 讀不到補的那一段就照舊少一年，不讓整頁失敗
  const oldest = quarters[0]
  const missing = oldest ? oldest.fiscalQuarter - 1 : 0
  const earlier = missing > 0
    ? ((await settle(cachedStatementHistory(code, 'cashFlowStatement', missing, { fiscalYear: oldest!.fiscalYear, fiscalQuarter: missing })))?.entries ?? []).map(toPeriod).filter(period => period !== null)
    : []
  const periods: CashFlowCompositionPeriod[] = [
    ...quarters,
    ...annualCashFlow([...earlier, ...quarters]).map(year => ({ fiscalYear: year.fiscalYear, fiscalQuarter: null, cashFlow: year.cashFlow }))
  ]
  return { symbol: code, periods }
})
