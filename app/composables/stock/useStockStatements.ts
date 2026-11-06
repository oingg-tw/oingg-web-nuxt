import type { FinancialStatementResponse, StatementType, StockStatementsResponse } from '#shared/types/financial-statement'
// Shared /api/stock/:code/statements fetch + the per-statement question/answer sentence builders
// — extracted 2026-09-20 out of financial-statements.vue when the latest filing's three tables
// split into their own URLs (/stock/:code/{balance-sheet,income-statement,cash-flow-statement},
// per direct request: "資產負債表/損益表/現金流量表各自讓他們是 /stock/2330/某某表"). All four
// pages (this trio plus financial-statements.vue itself, which still needs `.latest` to seed
// StockPeriodSelector) call this once at their own page
// top-level; the endpoint is Nitro-cached, so four independent calls hit the same server-side
// cache entry, not four separate upstream 業務中台 round trips.
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

// lazy（2026-10-23，換頁延遲）：瀏覽器裡換頁不等報表，呼叫端讀 pending 畫骨架；伺服器照樣等。單張報表頁（StockStatementPage）開；
// 財務報表總頁不開——它的期別選單靠這份資料決定預設期別，不等的話選單會先顯示舊期別再跳
export async function useStockStatements(code: Ref<string>, shortName: Ref<string>, options: { lazy?: boolean } = {}) {
  // Nuxt-instance-dependent calls (useState/useAsyncData) all happen BEFORE the single await
  // below — a useState() call after an await inside a plain (non-SFC-compiled) function loses
  // Nuxt's async context and throws; see useStockPageDigest.ts's own comment on the identical
  // constraint. That ruled out a seeding helper that does its own useState() calls (seedFromStatements
  // below runs both before AND after the await) — these three refs are acquired here instead,
  // using the exact same keys, and seedFromStatements only ever WRITES to them.
  const periodSeed = useState<{ year: number; quarter: number } | null>('stock-period-seed', () => null)
  const periodYear = useState('stock-period-year', () => periodSeed.value?.year ?? new Date().getFullYear())
  const periodQuarter = useState('stock-period-quarter', () => periodSeed.value?.quarter ?? 1)
  // 會計模式三表（StockFinancialStatementsCard → useFinancialStatement）讀的同一份快取、同一種 key。這支已經在伺服器端拿到最新一期與去年同期的
  // 三張表，寫進去之後瀏覽器接手時預設那一期不必再抓一次（2026-10-18），表格一出現就有數字。
  //（el-table 本身在伺服器端不會畫資料列，載入彈跳另外在 StockFinancialStatementsCard 處理）
  const statementCache = useState<Record<string, FinancialStatementResponse | null>>('financial-statement-cache', () => ({}))

  const statementsData = useAsyncData<StockStatementsResponse | null>(
    () => `stock-statements-${code.value}`,
    async () => {
      const symbol = code.value
      if (!symbol) return null
      return readOrNull($fetch<StockStatementsResponse>(`/api/stock/${symbol}/statements`, { retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS }), 'stock-statements')
    },
    { watch: [code], default: () => null, lazy: options.lazy ?? false }
  )
  // Seed the shared period selection from the latest filing — before StockPeriodSelector and the
  // statement card read it (they mount after this setup, on financial-statements.vue only).
  // Registered before the await so a client-side navigation to another symbol re-seeds; called
  // explicitly after it for SSR (an immediate watcher runs once with null on the server and never
  // again — see useStockPageDigest.ts's own comment on the same pattern). Dedup before writing.
  function seedFromStatements(payload: StockStatementsResponse | null) {
    const latestPeriod = payload?.latest
    if (!latestPeriod) return
    const { year, season } = latestPeriod
    for (const [statementType, pair] of Object.entries(payload.statements)) {
      if (pair.current) statementCache.value[`${code.value}-${statementType}-${year}-${season}`] = pair.current
      if (pair.prior) statementCache.value[`${code.value}-${statementType}-${year - 1}-${season}`] = pair.prior
    }
    if (periodSeed.value?.year === year && periodSeed.value?.quarter === season) return
    periodSeed.value = { year, quarter: season }
    periodYear.value = year
    periodQuarter.value = season
  }
  watch(statementsData.data, seedFromStatements)

  // 讀取失敗（2026-10-11）：請求出錯（4xx 由 readOrNull 變成 null，不算），或任一張報表的 current 是 null（伺服器逐張 settle 失敗；found:false 才是真的沒申報）
  const readFailed = computed(() => {
    if (!code.value || statementsData.status.value === 'pending') return false
    const payload = statementsData.data.value
    return !!statementsData.error.value || !!payload && Object.values(payload.statements).some(pair => pair.current === null)
  })
  // 必須在 await 之前（2026-10-12 修，同 useStockPageDigest）：await 之後沒有元件的作用範圍，監聽不會綁在頁面上、離開也不會清掉
  watchLoadFailure(() => `stock-statements:${code.value}`, () => statementsData.error.value ?? readFailed.value, () => statementsData.refresh())

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

  // One question per statement. 答句三個數字（2026-11-06，使用者：「卡片之前的文字描述過多了，會失焦」：原本四個科目各帶去年同期的金額，一段兩百多字，
  // 每一格都在下面的表裡）：「營業收入 1.27兆元（年增 36.05%）、本期淨利 7,068億元（年增 77.81%）、基本每股盈餘 27.25 元（年增 77.41%）。」
  function line(statementType: StatementType, key: string, label: string, unit: '千元' | '元' = '千元'): string | null {
    const { current, prior } = statementOf(statementType)
    const now = current?.found ? current.statement?.[key] : null
    if (now === null || now === undefined) return null
    const change = statementChangePercent(now, prior?.found ? prior.statement?.[key] : null)
    return `${label} ${unit === '元' ? `${formatStatementAmount(now)} 元` : formatMoney(now * 1000)}${change === '－' ? '' : `（年增 ${change}）`}`
  }
  // 現金流量寫流入或流出，不寫年增：基期是負數時，增減的正負號讀不出方向
  function flowLine(key: string, label: string): string | null {
    const { current } = statementOf('cashFlowStatement')
    const now = current?.found ? current.statement?.[key] : null
    if (now === null || now === undefined) return null
    return `${label}淨現金${now < 0 ? '流出' : '流入'} ${formatMoney(Math.abs(now) * 1000)}`
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
      incomeStatement: joinClauses([line('incomeStatement', 'revenue', '營業收入'), line('incomeStatement', 'profit_loss', '本期淨利'), line('incomeStatement', 'basic_earnings_loss_per_share', '基本每股盈餘', '元')]),
      balanceSheet: joinClauses([line('balanceSheet', 'assets', '資產總計'), line('balanceSheet', 'liabilities', '負債總計'), line('balanceSheet', 'equity', '權益總計')]),
      cashFlowStatement: joinClauses([flowLine('cash_flows_from_used_in_operating_activities', '營業活動'), flowLine('net_cash_flows_from_used_in_investing_activities', '投資活動'), flowLine('cash_flows_from_used_in_financing_activities', '籌資活動')])
    }
  })

  return { statements, latest, statementOf, labelsOf, statementQuestions, statementAnswers, readFailed, pending: statementsData.pending }
}
