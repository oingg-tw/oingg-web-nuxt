<script setup lang="ts">
import type { FinancialStatementResponse, StatementType, StockStatementsResponse } from '#shared/types/financial-statement'
import { STATEMENT_DEFINITIONS, formatStatementAmount, statementChangePercent } from '~/utils/financial-statement-rows'
import { joinClauses } from '~/utils/stock-answers'

// 財務報表 — real route 2026-09-17, split out of stock/[code]/index.vue's own 會計模式 per direct
// request ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣") — StockPeriodSelector/StockFinancialStatementsCard are the exact
// same two components 會計模式 used to render; this page reuses them directly.
//
// Document shape since 2026-09-19 (the SEO build): the latest filing's three statements are
// server-rendered as plain tables（當期／去年同期／增減%, from /api/stock/:code/statements — six
// cached upstream calls cold, none warm）under a question heading with a number-led answer; the
// period-picker card is the second section for browsing other quarters, and its picker now starts
// on the filing that actually exists（seedStockPeriod）instead of a calendar guess.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()

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
        console.warn(`[financial-statements] GET /api/stock/${symbol}/statements unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code], default: () => null }
)
// Seed the shared period selection from the latest filing — before StockPeriodSelector and the
// statement card read it（they mount after this setup）. Registered before the await so a
// client-side navigation to another symbol re-seeds; called explicitly after it for SSR (an
// immediate watcher runs once with null on the server and never again — see useStockPageDigest).
function seedFromStatements(payload: StockStatementsResponse | null) {
  if (payload?.latest) seedStockPeriod(payload.latest.year, payload.latest.season)
}
watch(statementsData.data, seedFromStatements)

// Real numbers into the SSR HTML + the meta description (see useStockPageDigest.ts).
const { digest, description } = await useStockPageDigest(code, 'financial-statements', { shortName: stockShortName })
await statementsData
seedFromStatements(statementsData.data.value)

const statements = computed(() => statementsData.data.value)
const latest = computed(() => statements.value?.latest ?? null)

// Real 財報 conventions, not just "Q{n}": 資產負債表 is a snapshot AS OF the quarter-end date,
// while 損益表/現金流量表 are cumulative from the fiscal-year start（累計數）— a property of the
// filings themselves. Quarter-end days need no Date object（03/31, 06/30, 09/30, 12/31）.
function quarterEnd(season: number): string {
  const month = season * 3
  const day = month === 6 || month === 9 ? 30 : 31
  return `${String(month).padStart(2, '0')}/${day}`
}

function periodLabel(year: number, season: number, statementType: StatementType): string {
  return statementType === 'balanceSheet' ? `${year}年${quarterEnd(season)}` : `${year}年01/01–${quarterEnd(season)}`
}

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
  const name = stockShortName.value
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

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '財務報表', titleKeywords: '資產負債表、損益表與現金流量表', pathSuffix: '/financial-statements', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="stock-financial-statements-page">
    <!-- Same three-way pending/not-found/found branch as stock/[code]/index.vue's own (see that
         file's own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
         "genuinely doesn't exist"). -->
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <!-- Page subject lives in the summary card's single <h1> since 2026-09-19 — see
           StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="財務報表" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <template v-if="latest">
        <StockQuestionSection
          v-for="definition in STATEMENT_DEFINITIONS"
          :id="`stock-statements-${definition.key}`"
          :key="definition.key"
          :question="statementQuestions[definition.key]"
          :answer="statementAnswers[definition.key]"
        >
          <StockFinancialStatementTable
            :title="definition.label"
            :rows="definition.rows"
            :current="statementOf(definition.key).current"
            :prior="statementOf(definition.key).prior"
            :current-label="labelsOf(definition.key).current"
            :prior-label="labelsOf(definition.key).prior"
            :show-title="false"
          />
        </StockQuestionSection>
      </template>
      <StockQuestionSection v-else id="stock-statements-latest" :question="`${stockShortName}最新一季三大報表數字多少？`">
        <p class="stock-answer">目前沒有這檔股票的財務報表申報資料。</p>
      </StockQuestionSection>

      <StockQuestionSection id="stock-statements-browse" question="想看其他季度的報表？" answer="用下方的年度與季別選擇器切換，三張報表同時更新；每一期都與其去年同期並列。">
        <StockPeriodSelector :symbol="stock.code" />
        <StockFinancialStatementsCard :symbol="stock.code" />
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}/metrics-history`">看 {{ stockShortName }} {{ code }} 由這些報表算出的指標逐年數據</NuxtLink>
      </p>
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-financial-statements-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
