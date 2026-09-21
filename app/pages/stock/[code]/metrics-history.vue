<script setup lang="ts">
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import type { SeriesTableColumn } from '~/utils/stock-series-table'
import { buildSeriesTableRows, catalogColumn } from '~/utils/stock-series-table'
import { formatSeriesNumber } from '~/utils/metric-null-reason'
import { joinClauses, joinSentences } from '~/utils/stock-answers'

// 指標歷史 — real route 2026-09-18, split out of stock/[code]/index.vue's own 表格模式 per direct
// request ("summary 上面的 卡片 表格 會計 顯示設定 都拔掉...卡片 表格 會計 做在sidebar上面。財務報表
// (會計) 指標歷史 (表格) 公司健檢 (卡片)") — StockHistoricalStatisticsTable is the exact same
// component 表格模式 used to render inside stock/[code]/index.vue's own experienceMode Transition.
//
// Document shape since 2026-09-19 (the SEO build): a server-rendered 逐年 table of 16 curated
// metrics（periods as columns — each fiscal year's Q4 近四季 figure plus the latest quarter, so a
// crawler and a reader get the multi-year view in one glance）under a question heading with a
// number-led answer, then the full 86-metric table（client-rendered, its own timeframe/window
// switches）as the second section. 公司健檢 shows the same metrics as 20 單季 rows per section;
// this page is the 逐年 columns view, so the two don't duplicate each other.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory) —
// StockHistoricalStatisticsTable awaits it internally too, but this page-level await resolves the
// shared key first.
await useFilterSchema()
const { data: filterSchema } = useNuxtData<FilterSchema>('filter-schema')

// Real numbers into the SSR HTML — the 逐年 table, the answer, the digest and the meta description.
const { digest, description, series } = await useStockPageDigest(code, 'metrics-history', { shortName: stockShortName })
const groups = computed(() => series.value?.groups ?? {})

// The curated 逐年 sets（code, series group, timeframe）— two tables so neither is 16 columns
// wide: 獲利（per-share revenue/earnings, returns, margins）and 現金、股利與估值（per-share cash
// flows, dividend policy, the valuation ratios and the two balance-sheet ratios）.
type ColumnSpec = [string, string, MetricsHistoryTimeframe]

const PROFIT_COLUMNS: ColumnSpec[] = [
  ['eps', 'TTM_CORE_40', 'TTM'],
  ['revenuePerShare', 'TTM_EXTRA_40', 'TTM'],
  ['roe', 'TTM_CORE_40', 'TTM'],
  ['roa', 'TTM_CORE_40', 'TTM'],
  ['grossMargin', 'TTM_CORE_40', 'TTM'],
  ['operatingMargin', 'TTM_CORE_40', 'TTM'],
  ['netProfitMargin', 'TTM_CORE_40', 'TTM']
]

const CASH_VALUATION_COLUMNS: ColumnSpec[] = [
  ['ocfPerShare', 'TTM_CORE_40', 'TTM'],
  ['fcfPerShare', 'TTM_CORE_40', 'TTM'],
  ['dividendPerShare', 'TTM_CORE_40', 'TTM'],
  ['dividendPayoutRatio', 'TTM_CORE_40', 'TTM'],
  ['peRatio', 'TTM_EXTRA_40', 'TTM'],
  ['pbRatio', 'Q_4_40', 'Q'],
  ['bvps', 'Q_4_40', 'Q'],
  ['debtRatio', 'Q_4_40', 'Q'],
  ['currentRatio', 'Q_4_40', 'Q']
]

function toColumns(specs: ColumnSpec[]): SeriesTableColumn[] {
  const categories = filterSchema.value?.categories ?? []
  return specs.map(([metricCode, group, timeframe]) => catalogColumn(categories, metricCode, group, timeframe))
}

const profitColumns = computed(() => toColumns(PROFIT_COLUMNS))
const cashValuationColumns = computed(() => toColumns(CASH_VALUATION_COLUMNS))

// 「本站有 5 個年度（2021–2025）的年度數字：EPS 由 2021 年的 23.01 元到 2025 年的 60.85 元、…；
// 最新一季（2026 Q2，近四季）EPS 86.27 元、ROE 34.78%。」— built from the same rows the table
// shows（oldest → newest, fiscal-year rows plus the latest quarter）.
function buildAnnualAnswer(columns: SeriesTableColumn[], rangeCodes: [string, string][], latestCodes: [string, string][]): string | null {
  const rows = buildSeriesTableRows(groups.value, columns, { annual: true, latestFirst: false })
  const yearRows = rows.filter(row => row.fiscalQuarter === 4)
  const cell = (row: (typeof rows)[number], metricCode: string) => {
    const index = columns.findIndex(column => column.code === metricCode)
    return index === -1 ? null : row.cells[index] ?? null
  }
  const unitOf = (metricCode: string) => {
    const unit = columns.find(column => column.code === metricCode)?.unit ?? ''
    return unit === '%' ? '%' : unit && unit !== '無單位' ? ` ${unit}` : ''
  }
  const range = (metricCode: string, label: string) => {
    if (yearRows.length < 2) return null
    const first = cell(yearRows[0]!, metricCode)
    const last = cell(yearRows[yearRows.length - 1]!, metricCode)
    if (!first || !last || first.value === null || last.value === null) return null
    const joiner = /^[A-Za-z0-9]/.test(label) ? ' 由' : '由'
    return `${label}${joiner} ${yearRows[0]!.fiscalYear} 年的 ${formatSeriesNumber(first.value)}${unitOf(metricCode)} 到 ${yearRows[yearRows.length - 1]!.fiscalYear} 年的 ${formatSeriesNumber(last.value)}${unitOf(metricCode)}`
  }
  const latest = rows.length ? rows[rows.length - 1]! : null
  const latestClause = (metricCode: string, label: string) => {
    const point = latest ? cell(latest, metricCode) : null
    return point && point.value !== null ? `${label} ${formatSeriesNumber(point.value)}${unitOf(metricCode)}` : null
  }
  const span = yearRows.length ? `本站有 ${yearRows.length} 個年度（${yearRows[0]!.fiscalYear}–${yearRows[yearRows.length - 1]!.fiscalYear}）的年度數字` : null
  const ranges = joinClauses(rangeCodes.map(([metricCode, label]) => range(metricCode, label)))
  const latestSentence = latest && latest.fiscalQuarter !== 4 ? joinClauses(latestCodes.map(([metricCode, label]) => latestClause(metricCode, label))) : null
  return joinSentences([
    span ? `${span}${ranges ? `：${ranges}` : '。'}` : null,
    latest && latestSentence ? `最新一季（${latest.fiscalYear} Q${latest.fiscalQuarter}，近四季）${latestSentence}` : null
  ])
}

const profitAnswer = computed(() => buildAnnualAnswer(profitColumns.value, [['eps', 'EPS'], ['roe', 'ROE'], ['grossMargin', '毛利率']], [['eps', 'EPS'], ['roe', 'ROE'], ['grossMargin', '毛利率']]))
const cashValuationAnswer = computed(() => buildAnnualAnswer(cashValuationColumns.value, [['dividendPerShare', '每股股利'], ['fcfPerShare', '每股自由現金流'], ['peRatio', '本益比'], ['debtRatio', '負債比率']], [['dividendPerShare', '每股股利'], ['fcfPerShare', '每股自由現金流'], ['peRatio', '本益比']]))

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '指標歷史', titleKeywords: 'EPS、ROE 與毛利率逐年數據', pathSuffix: '/metrics-history', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="stock-metrics-history-page">
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
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="指標歷史" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-metrics-profit" :question="`${stockShortName}的 EPS、ROE、毛利率逐年多少？`" :answer="profitAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐年獲利指標`" :columns="profitColumns" :groups="groups" layout="periods-as-columns" annual />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-cash-valuation" :question="`${stockShortName}的每股現金流、股利與本益比逐年多少？`" :answer="cashValuationAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐年現金、股利與估值指標`" :columns="cashValuationColumns" :groups="groups" layout="periods-as-columns" annual />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-full" question="想看所有指標的逐季數字？" answer="下表列出本站計算的每一項指標，可切換單季／近四季與回看年限；有稽核鏈的指標可展開，看它是由哪些申報數字算出來的。">
        <!-- StockIndicatorTrendChart.vue (指標走勢比較圖) and the table's own 圖表 checkbox column
             REMOVED 2026-09-14 per direct request ("我放棄 我有點 複雜化了，把 指標走勢比較圖 拿掉。
             勾選的機制也自然拿掉") — this table is back to just plain numbers, no charting
             affordance ("就讓它是純數字"). -->
        <StockHistoricalStatisticsTable :symbol="stock.code" />
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}/financial-statements`">看 {{ stockShortName }} {{ code }} 的三大財務報表</NuxtLink>
      </p>
      <!-- 公司基本資訊 is its own top-level section (StockProfileCard renders an <h2>), a sibling
           of the sections above, not part of them. -->
      <StockProfileCard v-if="profile" :profile="profile" class="stock-metrics-history-page__profile" />
      <StockProfileCardShell v-else class="stock-metrics-history-page__profile" />
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-metrics-history-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
