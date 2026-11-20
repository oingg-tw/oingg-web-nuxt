// Wire shape of 業務中台's GET /stocks/:symbol/financial-statement — shared by
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
  // 新台幣千元（每股盈餘那兩個科目是元）；沒有這個科目是 null
  statement: Record<string, number | null> | null
}

// server/api/stock/[code]/statements.get.ts — the latest filing of each statement plus the same
// season one year earlier, for the 財務報表 page's server-rendered 當期／去年同期／增減% tables.
// GET /stocks/:symbol/financial-statement-history（2026-11-20）：同一張報表的最近 limit 季，由舊到新，每期同上；缺的季 found:false、季別連續，
// 一季都沒有是空陣列
export interface FinancialStatementHistoryResponse {
  symbol: string
  statementType: StatementType
  timeframe: string
  entries: FinancialStatementResponse[]
}

export interface StockStatementsResponse {
  symbol: string
  // Western calendar year/season of the latest filing found (null when nothing was found at all).
  latest: { year: number; season: number } | null
  statements: Record<StatementType, { current: FinancialStatementResponse | null; prior: FinancialStatementResponse | null }>
}
