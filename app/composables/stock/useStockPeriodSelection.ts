export type StockQuarter = 1 | 2 | 3 | 4

// Shared state for 會計模式's year/quarter picker (StockPeriodSelector.vue) — per direct request
// ("會計模式要有地方可以選擇年分與季度"; an earlier instruction said 專家模式, corrected right
// after). No longer just a shell: StockFinancialStatementsCard.vue reads this to drive its own
// GET /stocks/:symbol/financial-statement calls, and useStatementRowFocus.ts's
// jumpToStatementRow() writes it directly (part of "trace a badge's number back to the original
// filing" — see that file's own comment) so a future badge-dialog link can jump straight to a
// specific period, not just switch into 會計模式 and leave the user to find it themselves.
//
// Seeded from the company's LATEST FILING when the page knows it（seedStockPeriod, called by
// financial-statements.vue from the server-rendered statements payload, 2026-09-19）rather than
// from the calendar: "the quarter a company would have filed by now" is a guess that is wrong for
// every late filer and, being `new Date()`-based, could differ between the server and the client
// across a month boundary. The calendar guess stays only as the fallback for a caller with no
// filing in hand.
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

function periodSeed() {
  return useState<{ year: number; quarter: StockQuarter } | null>('stock-period-seed', () => null)
}

// Called by a page BEFORE any component reads the selection（page setup runs before children）,
// so the picker and the statement card start on the filing that actually exists. A later call
// (another symbol) moves the selection with it.
export function seedStockPeriod(year: number, quarter: number) {
  if (!Number.isInteger(year) || quarter < 1 || quarter > 4) return
  const seed = periodSeed()
  const next = { year, quarter: quarter as StockQuarter }
  if (seed.value?.year === next.year && seed.value?.quarter === next.quarter) return
  seed.value = next
  useState('stock-period-year', () => next.year).value = next.year
  useState<StockQuarter>('stock-period-quarter', () => next.quarter).value = next.quarter
}

export function useStockPeriodSelection() {
  const seed = periodSeed()
  const defaults = seed.value ?? mostRecentlyReportedQuarter()
  const year = useState('stock-period-year', () => defaults.year)
  const quarter = useState<StockQuarter>('stock-period-quarter', () => defaults.quarter)
  return { year, quarter }
}
