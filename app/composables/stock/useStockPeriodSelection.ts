export type StockQuarter = 1 | 2 | 3 | 4

// Page-local shell state for 會計模式's year/quarter picker (StockPeriodSelector.vue) — per
// direct request ("會計模式要有地方可以選擇年分與季度"; an earlier instruction said 專家模式,
// corrected right after). Nothing reads this yet: StockFinancialStatementsCard.vue's three
// statements have no real bff-ts/analysis-ts endpoint that takes a specific year+quarter
// parameter, so this only exists so the control has somewhere to hold its selection before
// that wiring is designed — same "shell first" pattern as useDashboardExperienceMode.ts and
// useStockExperienceMode.ts.
function currentQuarter(): StockQuarter {
  const month = new Date().getMonth() + 1
  if (month <= 3) return 1
  if (month <= 6) return 2
  if (month <= 9) return 3
  return 4
}

// The quarter just reported/completed, not the one currently in progress — e.g. in September
// (Q3 in progress), Q2 is the most recent one a company would actually have filed by now.
function mostRecentlyReportedQuarter(): { year: number; quarter: StockQuarter } {
  const now = new Date()
  const quarter = currentQuarter()
  if (quarter === 1) return { year: now.getFullYear() - 1, quarter: 4 }
  return { year: now.getFullYear(), quarter: (quarter - 1) as StockQuarter }
}

export function useStockPeriodSelection() {
  const defaults = mostRecentlyReportedQuarter()
  const year = useState('stock-period-year', () => defaults.year)
  const quarter = useState<StockQuarter>('stock-period-quarter', () => defaults.quarter)
  return { year, quarter }
}
