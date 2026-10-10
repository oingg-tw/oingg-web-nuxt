// Wire shape of bff-ts's GET /stocks/:symbol/financial-statement — shared by
// useFinancialStatement.ts (re-exported there) and server/utils/stock-data.ts. Since 2026-10-10
// （analysis-ts 2c／業務中台 0ae2627）the period is a WESTERN integer fiscalYear plus integer fiscalQuarter
// （was the 民國 string year/season）; both are null on found:false. Omitting them on the request
// returns the latest filing.

export type StatementType = 'balanceSheet' | 'incomeStatement' | 'cashFlowStatement'

export interface FinancialStatementResponse {
  symbol: string
  statementType: StatementType
  fiscalYear: number | null
  fiscalQuarter: number | null
  fiscalPeriodEndDate: string | null
  found: boolean
  // Values are bigint-precise strings (新台幣千元 for the statement lines; EPS in 元).
  statement: Record<string, string | null> | null
}

// server/api/stock/[code]/statements.get.ts — the latest filing of each statement plus the same
// season one year earlier, for the 財務報表 page's server-rendered 當期／去年同期／增減% tables.
export interface StockStatementsResponse {
  symbol: string
  // Western calendar year/season of the latest filing found (null when nothing was found at all).
  latest: { year: number; season: number } | null
  statements: Record<StatementType, { current: FinancialStatementResponse | null; prior: FinancialStatementResponse | null }>
}
