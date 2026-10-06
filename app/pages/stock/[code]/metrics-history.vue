<script setup lang="ts">
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import type { SeriesTableColumn } from '~/utils/stock-series-table'
import { buildSeriesTableRows, catalogColumn } from '~/utils/stock-series-table'
import { findMetricInSchema } from '~/utils/stock-digest'
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

// 2026-10-07 重新設計（「metrics-history 這一頁請重新設計」，參考 conductor docs/2_knowledge；使用者選了
// 「放一個會貼頂的圖表」、大表收進預設關閉的展開區、年度為主＋最新一季）。
//
// 原本兩張表，第二張把 元／%／倍、近四季／單季全混在一起。改成四段，每段一個讀者問題：
// 獲利、股利與現金、財務安全、估值。指標還是同樣 16 支，資料還是同一次 SSR 請求（SERIES_PLANS 不動）。
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

const DIVIDEND_COLUMNS: ColumnSpec[] = [
  ['dividendPerShare', 'TTM_CORE_40', 'TTM'],
  ['ocfPerShare', 'TTM_CORE_40', 'TTM'],
  ['fcfPerShare', 'TTM_CORE_40', 'TTM'],
  ['dividendPayoutRatio', 'TTM_CORE_40', 'TTM']
]

// 季末時點的餘額比率，只有單季（近四季對它沒有意義）
const SAFETY_COLUMNS: ColumnSpec[] = [
  ['debtRatio', 'Q_4_40', 'Q'],
  ['currentRatio', 'Q_4_40', 'Q']
]

const VALUATION_COLUMNS: ColumnSpec[] = [
  ['peRatio', 'TTM_EXTRA_40', 'TTM'],
  ['pbRatio', 'Q_4_40', 'Q'],
  ['bvps', 'Q_4_40', 'Q']
]

function toColumns(specs: ColumnSpec[]): SeriesTableColumn[] {
  const categories = filterSchema.value?.categories ?? []
  return specs.map(([metricCode, group, timeframe]) => catalogColumn(categories, metricCode, group, timeframe))
}

const profitColumns = computed(() => toColumns(PROFIT_COLUMNS))
const dividendColumns = computed(() => toColumns(DIVIDEND_COLUMNS))
const safetyColumns = computed(() => toColumns(SAFETY_COLUMNS))
const valuationColumns = computed(() => toColumns(VALUATION_COLUMNS))

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
const dividendAnswer = computed(() => buildAnnualAnswer(dividendColumns.value, [['dividendPerShare', '每股股利'], ['fcfPerShare', '每股自由現金流'], ['dividendPayoutRatio', '盈餘發放率']], [['dividendPerShare', '每股股利'], ['fcfPerShare', '每股自由現金流']]))
const safetyAnswer = computed(() => buildAnnualAnswer(safetyColumns.value, [['debtRatio', '負債比率'], ['currentRatio', '流動比率']], [['debtRatio', '負債比率'], ['currentRatio', '流動比率']]))
const valuationAnswer = computed(() => buildAnnualAnswer(valuationColumns.value, [['peRatio', '本益比'], ['pbRatio', '股價淨值比']], [['peRatio', '本益比'], ['pbRatio', '股價淨值比']]))

// ---- 貼頂圖表（2026-10-07 使用者選「請放一個會貼頂的圖表」）----
// 一張圖、點表格任一列就換成那一支。2026-09-14 拿掉的是「勾選多支疊在一起比」那一套（「我放棄 我有點
// 複雜化了」）；這次刻意只有一支、沒有勾選框，選指標的方式就是點表格的列標題。
// 圖表元件跟 60 個指標頁同一支（StockMetricHistoryChartInteractive：期別切換、近 N 年、40 期請求吃伺服器
// 快取），所以這裡看到的圖跟點進該指標頁看到的一樣。
const ALL_SPECS = [...PROFIT_COLUMNS, ...DIVIDEND_COLUMNS, ...SAFETY_COLUMNS, ...VALUATION_COLUMNS]
const chartCode = ref('eps')
const chartColumn = computed(() => {
  const spec = ALL_SPECS.find(([metricCode]) => metricCode === chartCode.value) ?? ALL_SPECS[0]!
  return catalogColumn(filterSchema.value?.categories ?? [], spec[0], spec[1], spec[2])
})
const chartTimeframes = computed<MetricsHistoryTimeframe[]>(() => {
  const located = findMetricInSchema(filterSchema.value?.categories ?? [], chartCode.value)
  const keys = (located?.metric.fields ?? []).map(field => field.key).filter((key): key is MetricsHistoryTimeframe => key === 'TTM' || key === 'Q' || key === 'FY')
  return keys.length ? keys : [chartColumn.value.timeframe]
})
const chartUnit = computed(() => (chartColumn.value.unit && chartColumn.value.unit !== '無單位' ? chartColumn.value.unit : ''))
const chartAnnouncement = ref('')
function selectChart(metricCode: string) {
  chartCode.value = metricCode
  chartAnnouncement.value = `圖表：${chartColumn.value.label}`
}

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
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <!-- Page subject lives in the summary card's single <h1> since 2026-09-19 — see
           StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="指標歷史" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <!-- 貼頂圖表：寬而高的視窗才貼頂（見 CSS）。圖在表前（使用者 2026-09-27「先圖表再表格」）。 -->
      <section class="stock-metrics-history-page__chart" aria-labelledby="stock-metrics-chart-title">
        <el-card shadow="never" class="stock-metrics-history-page__chart-card">
          <h2 id="stock-metrics-chart-title" class="stock-metrics-history-page__chart-title">{{ chartColumn.label }}</h2>
          <p class="stock-metrics-history-page__chart-hint">點下面表格任一列，圖表換成那個指標</p>
          <p class="visually-hidden" aria-live="polite">{{ chartAnnouncement }}</p>
          <StockMetricHistoryChartInteractive
            :key="chartCode"
            :symbol="code"
            :metric-code="chartCode"
            :topic="chartColumn.label"
            :unit="chartUnit"
            :default-timeframe="chartColumn.timeframe"
            :available-timeframes="chartTimeframes"
          />
        </el-card>
      </section>

      <StockQuestionSection id="stock-metrics-profit" :question="`${stockShortName}的 EPS、ROE、毛利率逐年多少？`" :answer="profitAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐年獲利指標`" :columns="profitColumns" :groups="groups" layout="periods-as-columns" annual :selected-code="chartCode" @select="selectChart" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-dividend" :question="`${stockShortName}的股利與現金流逐年多少？`" :answer="dividendAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐年股利與現金流指標`" :columns="dividendColumns" :groups="groups" layout="periods-as-columns" annual :selected-code="chartCode" @select="selectChart" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-safety" :question="`${stockShortName}的負債比率與流動比率逐年多少？`" :answer="safetyAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐年財務安全指標`" :columns="safetyColumns" :groups="groups" layout="periods-as-columns" annual :selected-code="chartCode" @select="selectChart" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-valuation" :question="`${stockShortName}的本益比與股價淨值比逐年多少？`" :answer="valuationAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐年估值指標`" :columns="valuationColumns" :groups="groups" layout="periods-as-columns" annual :selected-code="chartCode" @select="selectChart" />
      </StockQuestionSection>

      <!-- 全部指標的大表收進預設關閉的展開區（2026-10-07 使用者決定）：首屏只留整理過的四段；資料與功能
           （期別、回看年限、稽核鏈）照舊。2026-09-14 拿掉的走勢比較圖與勾選框仍然不回來。 -->
      <details class="stock-metrics-history-page__full">
        <summary>想看所有指標的逐季數字？</summary>
        <p class="stock-metrics-history-page__full-note">下表列出本站計算的每一項指標，可切換單季／近四季與回看年限；有稽核鏈的指標可展開，看它是由哪些申報數字算出來的。</p>
        <StockHistoricalStatisticsTable :symbol="stock.code" />
      </details>

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
/* 貼頂圖表。只在寬而高的視窗貼頂：手機與放大 200%（960px 寬）照一般排版捲走，貼頂的圖會擋住大半個
   畫面（2026-10-05「a11y 要求放大 200% 也不可以跑版」）。 */
.stock-metrics-history-page__chart {
  z-index: 5;
}

@media (min-width: 1024px) and (min-height: 760px) {
  .stock-metrics-history-page__chart {
    position: sticky;
    top: var(--app-header-height, 57px);
  }

  /* 頁內跳轉（目錄、錨點）落點要避開貼頂的圖表，不然段落標題會被圖蓋住。圖卡約 400px 高 */
  .stock-metrics-history-page :deep([id^='stock-metrics-']) {
    scroll-margin-top: calc(var(--app-header-height, 57px) + 420px);
  }
}

/* 窄螢幕：圖表元件的期別／區間控制項原本絕對定位在卡片右上角，手機寬度會壓在標題上（2026-10-07 截圖）。
   改回一般排版，排在標題與提示下面。 */
@media (max-width: 767px) {
  .stock-metrics-history-page__chart-card :deep(.stock-metric-history-chart-interactive__corner) {
    position: static;
    justify-content: flex-start;
    margin-bottom: 8px;
  }
}

/* 圖表元件的期別／區間控制項是絕對定位在卡片右上角，所以卡片要當定位錨點（同 StockMetricDetailPage） */
.stock-metrics-history-page__chart-card {
  position: relative;
  box-shadow: 0 4px 12px rgb(0 0 0 / 6%);
}

.stock-metrics-history-page__chart-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.stock-metrics-history-page__chart-hint {
  margin: 4px 0 8px;
  color: var(--el-text-color-regular);
}

.stock-metrics-history-page__full summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 1.25rem;
  font-weight: 600;
}

.stock-metrics-history-page__full-note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.stock-metrics-history-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
