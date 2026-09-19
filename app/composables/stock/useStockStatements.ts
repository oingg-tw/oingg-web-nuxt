import type { FinancialStatementResponse, StatementType, StockStatementsResponse } from '#shared/types/financial-statement'
import { formatStatementAmount, statementChangePercent } from '~/utils/financial-statement-rows'
import { joinClauses } from '~/utils/stock-answers'

// Shared /api/stock/:code/statements fetch + the per-statement question/answer sentence builders
// — extracted 2026-09-20 out of financial-statements.vue when the latest filing's three tables
// split into their own URLs (/stock/:code/{balance-sheet,income-statement,cash-flow-statement},
// per direct request: "資產負債表/損益表/現金流量表各自讓他們是 /stock/2330/某某表"). All four
// pages (this trio plus financial-statements.vue itself, which still needs `.latest` to seed
// StockPeriodSelector — see seedStockPeriod's own comment) call this once at their own page
// top-level; the endpoint is Nitro-cached, so four independent calls hit the same server-side
// cache entry, not four separate upstream bff-ts round trips.
//
// Real 財報 conventions, not just "Q{n}": 資產負債表 is a snapshot AS OF the quarter-end date,
// while 損益表/現金流量表 are cumulative from the fiscal-year start（累計數）— a property of the
// filings themselves. Quarter-end days need no Date object (03/31, 06/30, 09/30, 12/31).
function quarterEnd(season: number): string {
  const month = season * 3
  const day = month === 6 || month === 9 ? 30 : 31
  return `${String(month).padStart(2, '0')}/${day}`
}

function periodLabel(year: number, season: number, statementType: StatementType): string {
  return statementType === 'balanceSheet' ? `${year}年${quarterEnd(season)}` : `${year}年01/01–${quarterEnd(season)}`
}

export async function useStockStatements(code: Ref<string>, shortName: Ref<string>) {
  // Nuxt-instance-dependent calls (useState/useAsyncData) all happen BEFORE the single await
  // below — a useState() call after an await inside a plain (non-SFC-compiled) function loses
  // Nuxt's async context and throws; see useStockPageDigest.ts's own comment on the identical
  // constraint. That ruled out calling useStockPeriodSelection.ts's own exported
  // seedStockPeriod() (it does its own useState() calls) from seedFromStatements below, since
  // that runs both before AND after the await — these three refs are acquired here instead,
  // using the exact same keys, and seedFromStatements only ever WRITES to them.
  const periodSeed = useState<{ year: number; quarter: number } | null>('stock-period-seed', () => null)
  const periodYear = useState('stock-period-year', () => periodSeed.value?.year ?? new Date().getFullYear())
  const periodQuarter = useState('stock-period-quarter', () => periodSeed.value?.quarter ?? 1)

  const statementsData = useAsyncData<StockStatementsResponse | null>(
    () => `stock-statements-${code.value}`,
    async () => {
      const symbol = code.value
      if (!symbol) return null
      try {
        return await $fetch<StockStatementsResponse>(`/api/stock/${symbol}/statements`, { retry: 0, timeout: 15_000 })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[stock-statements] GET /api/stock/${symbol}/statements unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [code], default: () => null }
  )
  // Seed the shared period selection from the latest filing — before StockPeriodSelector and the
  // statement card read it (they mount after this setup, on financial-statements.vue only).
  // Registered before the await so a client-side navigation to another symbol re-seeds; called
  // explicitly after it for SSR (an immediate watcher runs once with null on the server and never
  // again — see useStockPageDigest.ts's own comment on the same pattern). Same dedup check
  // seedStockPeriod() itself does, just writing to the refs acquired above instead of calling it.
  function seedFromStatements(payload: StockStatementsResponse | null) {
    const latestPeriod = payload?.latest
    if (!latestPeriod) return
    const { year, season } = latestPeriod
    if (periodSeed.value?.year === year && periodSeed.value?.quarter === season) return
    periodSeed.value = { year, quarter: season }
    periodYear.value = year
    periodQuarter.value = season
  }
  watch(statementsData.data, seedFromStatements)
  await statementsData
  seedFromStatements(statementsData.data.value)

  const statements = computed(() => statementsData.data.value)
  const latest = computed(() => statements.value?.latest ?? null)

  function statementOf(statementType: StatementType): { current: FinancialStatementResponse | null; prior: FinancialStatementResponse | null } {
    return statements.value?.statements[statementType] ?? { current: null, prior: null }
  }

  function labelsOf(statementType: StatementType): { current: string; prior: string } {
    const period = latest.value
    if (!period) return { current: '當期', prior: '去年同期' }
    return { current: periodLabel(period.year, period.season, statementType), prior: periodLabel(period.year - 1, period.season, statementType) }
  }

  // One question per statement:「損益表：2026 年第 2 季累計營業收入 1,270,380,250 千元（去年同期 …，
  // 增減 36.05%）、本期淨利 …、基本每股盈餘 … 元。」— every number straight off the filing,
  // formatted deterministically.
  function line(statementType: StatementType, key: string, label: string, unit: string): string | null {
    const { current, prior } = statementOf(statementType)
    const now = current?.found ? current.statement?.[key] : null
    if (now === null || now === undefined) return null
    const then = prior?.found ? prior.statement?.[key] : null
    const change = then ? statementChangePercent(now, then) : '－'
    return `${label} ${formatStatementAmount(now)} ${unit}${then ? `（去年同期 ${formatStatementAmount(then)} ${unit}${change !== '－' ? `，增減 ${change}` : ''}）` : ''}`
  }

  const statementQuestions = computed<Record<StatementType, string>>(() => {
    const name = shortName.value
    const period = latest.value
    const cumulative = period ? `${period.year} 年第 ${period.season} 季累計` : '最新一季'
    const asOf = period ? `${period.year}年${quarterEnd(period.season)}` : '最新一季'
    return {
      incomeStatement: `${name} ${cumulative}的損益表：營收與淨利多少？`,
      balanceSheet: `${name} ${asOf}的資產負債表：資產、負債與權益多少？`,
      cashFlowStatement: `${name} ${cumulative}的現金流量表：營業現金流多少？`
    }
  })

  const statementAnswers = computed<Record<StatementType, string | null>>(() => {
    const period = latest.value
    if (!period) return { incomeStatement: null, balanceSheet: null, cashFlowStatement: null }
    return {
      incomeStatement: joinClauses([line('incomeStatement', 'revenue', '營業收入', '千元'), line('incomeStatement', 'gross_profit', '營業毛利', '千元'), line('incomeStatement', 'profit_loss', '本期淨利', '千元'), line('incomeStatement', 'basic_earnings_loss_per_share', '基本每股盈餘', '元')]),
      balanceSheet: joinClauses([line('balanceSheet', 'assets', '資產總計', '千元'), line('balanceSheet', 'liabilities', '負債總計', '千元'), line('balanceSheet', 'equity', '權益總計', '千元'), line('balanceSheet', 'cash_and_cash_equivalents', '現金及約當現金', '千元')]),
      cashFlowStatement: joinClauses([line('cashFlowStatement', 'cash_flows_from_used_in_operating_activities', '營業活動之淨現金流入（出）', '千元'), line('cashFlowStatement', 'net_cash_flows_from_used_in_investing_activities', '投資活動之淨現金流入（出）', '千元'), line('cashFlowStatement', 'cash_flows_from_used_in_financing_activities', '籌資活動之淨現金流入（出）', '千元'), line('cashFlowStatement', 'dividends_paid_financing', '發放現金股利', '千元')])
    }
  })

  // One headline figure per statement — used by financial-statements.vue's own summary table
  // (a single representative number per row, not the full multi-clause answer sentence the split
  // pages themselves show).
  const statementHeadlines = computed<Record<StatementType, string | null>>(() => ({
    balanceSheet: line('balanceSheet', 'assets', '資產總計', '千元'),
    incomeStatement: line('incomeStatement', 'profit_loss', '本期淨利', '千元'),
    cashFlowStatement: line('cashFlowStatement', 'cash_flows_from_used_in_operating_activities', '營業活動淨現金流入（出）', '千元')
  }))

  return { statementsData, statements, latest, statementOf, labelsOf, statementQuestions, statementAnswers, statementHeadlines }
}
