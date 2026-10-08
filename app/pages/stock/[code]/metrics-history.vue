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

// 一律預設單季（2026-10-07「metrics-history 希望一律預設用單季」）。上游沒有單季的三支——每股股利、
// 盈餘發放率、本益比——照舊是近四季，列標題寫明期別，不硬湊。
const PROFIT_COLUMNS: ColumnSpec[] = [
  ['eps', 'Q_CORE_40', 'Q'],
  ['revenuePerShare', 'Q_CORE_40', 'Q'],
  ['roe', 'Q_CORE_40', 'Q'],
  ['roa', 'Q_CORE_40', 'Q'],
  ['grossMargin', 'Q_CORE_40', 'Q'],
  ['operatingMargin', 'Q_CORE_40', 'Q'],
  ['netProfitMargin', 'Q_CORE_40', 'Q']
]

const DIVIDEND_COLUMNS: ColumnSpec[] = [
  ['dividendPerShare', 'TTM_CORE_40', 'TTM'],
  ['ocfPerShare', 'Q_CORE_40', 'Q'],
  ['fcfPerShare', 'Q_CORE_40', 'Q'],
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

// 單季之後，回答句講「最新一季」與「去年同一季」——單季數字跟前一季比會被淡旺季帶著走，跟去年同季比
// 才是同一個季節。只陳述兩個數字，不寫增減的形容詞。
// 表格顯示最近 8 季（2 年）；更早的在最下面的全部指標表（每季、可選回看年限）。
const QUARTERS_SHOWN = 8

function buildQuarterAnswer(columns: SeriesTableColumn[], codes: [string, string][]): string | null {
  const rows = buildSeriesTableRows(groups.value, columns, { latestFirst: false })
  const latest = rows.at(-1)
  if (!latest || latest.fiscalQuarter === null) return null
  const yearAgo = rows.find(row => row.fiscalYear === latest.fiscalYear - 1 && row.fiscalQuarter === latest.fiscalQuarter) ?? null
  const unitOf = (metricCode: string) => {
    const unit = columns.find(column => column.code === metricCode)?.unit ?? ''
    return unit === '%' ? '%' : unit && unit !== '無單位' ? ` ${unit}` : ''
  }
  const clauses = (row: (typeof rows)[number]) => joinClauses(codes.map(([metricCode, label]) => {
    const index = columns.findIndex(column => column.code === metricCode)
    const point = index === -1 ? null : row.cells[index]
    return point && point.value !== null ? `${label} ${formatSeriesNumber(point.value)}${unitOf(metricCode)}` : null
  }))
  const latestText = clauses(latest)
  const yearAgoText = yearAgo ? clauses(yearAgo) : null
  return joinSentences([
    latestText ? `最新一季（${latest.fiscalYear} Q${latest.fiscalQuarter}）${latestText}` : null,
    yearAgoText ? `去年同一季（${yearAgo!.fiscalYear} Q${yearAgo!.fiscalQuarter}）${yearAgoText}` : null
  ])
}

const profitAnswer = computed(() => buildQuarterAnswer(profitColumns.value, [['eps', 'EPS'], ['roe', 'ROE'], ['grossMargin', '毛利率']]))
const dividendAnswer = computed(() => buildQuarterAnswer(dividendColumns.value, [['ocfPerShare', '每股營業現金流'], ['fcfPerShare', '每股自由現金流'], ['dividendPerShare', '每股股利（近四季）']]))
const safetyAnswer = computed(() => buildQuarterAnswer(safetyColumns.value, [['debtRatio', '負債比率'], ['currentRatio', '流動比率']]))
const valuationAnswer = computed(() => buildQuarterAnswer(valuationColumns.value, [['pbRatio', '股價淨值比'], ['peRatio', '本益比（近四季）']]))

// 貼頂圖表 2026-10-07 加上、同日拿掉（「指標歷史 圖表還是拿掉」）。這一頁維持純表格——跟 2026-09-14
// 「就讓它是純數字」同一個結論。要看單一指標的走勢，點進各指標頁（那裡有圖）。

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '指標歷史', titleKeywords: 'EPS、ROE 與毛利率逐季數據', pathSuffix: '/metrics-history', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-metrics-history-page">
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

      <StockQuestionSection id="stock-metrics-profit" :question="`${stockShortName}的 EPS、ROE、毛利率最近幾季多少？`" :answer="profitAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐季獲利指標`" :columns="profitColumns" :groups="groups" layout="periods-as-columns" :latest-first="false" :max-periods="QUARTERS_SHOWN" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-dividend" :question="`${stockShortName}的現金流與股利最近幾季多少？`" :answer="dividendAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐季現金流與股利指標`" :columns="dividendColumns" :groups="groups" layout="periods-as-columns" :latest-first="false" :max-periods="QUARTERS_SHOWN" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-safety" :question="`${stockShortName}的負債比率與流動比率最近幾季多少？`" :answer="safetyAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐季財務安全指標`" :columns="safetyColumns" :groups="groups" layout="periods-as-columns" :latest-first="false" :max-periods="QUARTERS_SHOWN" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-metrics-valuation" :question="`${stockShortName}的股價淨值比與本益比最近幾季多少？`" :answer="valuationAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 逐季估值指標`" :columns="valuationColumns" :groups="groups" layout="periods-as-columns" :latest-first="false" :max-periods="QUARTERS_SHOWN" />
      </StockQuestionSection>

      <!-- 全部指標的大表收進預設關閉的展開區（2026-10-07 使用者決定）：首屏只留整理過的四段；資料與功能
           （期別、回看年限、稽核鏈）照舊。 -->
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

</style>
