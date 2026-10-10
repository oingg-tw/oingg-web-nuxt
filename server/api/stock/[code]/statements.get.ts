import type { FinancialStatementResponse, StatementType, StockStatementsResponse } from '#shared/types/financial-statement'

// GET /api/stock/:code/statements — the latest filing of each of the three statements plus the
// same season one year earlier, for the 財務報表 page's server-rendered 當期／去年同期／增減% tables
// (2026-09-19, the SEO build). Six cached upstream calls cold, zero warm. "Latest" is bff-ts's
// own answer to a request without year/season; the prior-year request reuses that filing's
// season so a company whose latest filing is Q1 compares against last year's Q1.
const STATEMENT_TYPES: StatementType[] = ['balanceSheet', 'incomeStatement', 'cashFlowStatement']

async function priorYear(code: string, statementType: StatementType, current: FinancialStatementResponse | null): Promise<FinancialStatementResponse | null> {
  if (!current?.found) return null
  const { fiscalYear, fiscalQuarter } = current
  if (fiscalYear === null || fiscalQuarter === null) return null
  return settle(cachedFinancialStatement(code, statementType, fiscalYear - 1, fiscalQuarter))
}

export default defineEventHandler(async (event): Promise<StockStatementsResponse> => {
  const code = requireListedSymbol(event)

  const currents = await Promise.all(STATEMENT_TYPES.map(type => settle(cachedFinancialStatement(code, type, null, null))))
  const priors = await Promise.all(STATEMENT_TYPES.map((type, index) => priorYear(code, type, currents[index] ?? null)))

  const statements = {} as StockStatementsResponse['statements']
  STATEMENT_TYPES.forEach((type, index) => {
    statements[type] = { current: currents[index] ?? null, prior: priors[index] ?? null }
  })
  const found = currents.find(statement => statement?.found)
  const latest = found?.fiscalYear && found.fiscalQuarter ? { year: found.fiscalYear, season: found.fiscalQuarter } : null
  return { symbol: code, latest, statements }
})
