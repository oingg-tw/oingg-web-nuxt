<script setup lang="ts">
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import { BADGE_PAGES, METRIC_PAGES, badgePageChartMetricCode } from '#shared/utils/hub-slugs'
import { findMetricInSchema } from '~/utils/stock-digest'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'

// 指標速覽（2026-10-07「我想增加一個功能，自選指標的速覽」→「指標速覽請放在配息從哪來的下面」）。
// 側邊欄釘選的每一支指標，這檔股票的最新數值一頁看完；點名稱進該指標頁看歷史。
//
// 文件型一張表，不做卡片牆（使用者 2026-09「card-per-metric＝畫面髒亂」）。只陳述數字與期別，不比高低。
// 內容是各人的釘選清單，所以 noindex——搜尋引擎看到的會是預設釘選，那不是這一頁該被搜到的樣子。
const TOPIC = '指標速覽'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
await useFilterSchema()
const { data: schema } = useNuxtData<{ categories: Parameters<typeof locateFieldInSchema>[0] }>('filter-schema')

const pinnedNodes = useStockPinnedMetricNodes()
const { pinnedSlugs } = useStockPinnedMetrics()

// 釘選的是「頁面」（slug），不是指標欄位。對應成 /screener/values 的欄位：
//   - 指標頁：METRIC_PAGES 的 metricCode＋timeframe
//   - 徽章頁：BADGE_PAGES 的 metricCode＋chartTimeframe（沒寫就近四季）
//   - 配股配息：交易所公布的殖利率（那一頁回答的就是「領多少」）
//   - 其他整頁型的（指標歷史、杜邦分析…）沒有單一數值，只給連結
const SPECIAL_FIELDS: Record<string, string> = { dividend: 'dividendYield.EOD' }
function fieldOf(slug: string): string | null {
  if (SPECIAL_FIELDS[slug]) return SPECIAL_FIELDS[slug]!
  const metricPage = METRIC_PAGES.find(page => page.slug === slug)
  if (metricPage) return `${metricPage.metricCode}.${metricPage.timeframe}`
  const badgePage = BADGE_PAGES.find(page => page.slug === slug)
  if (badgePage) return `${badgePage.metricCode}.${badgePage.chartTimeframe ?? 'TTM'}`
  return null
}
// 型錄裡查不到的欄位不送：一個未知欄位會讓整個請求 400
const isKnownField = (field: string) => !!locateFieldInSchema(schema.value?.categories ?? [], field)

const rows = computed(() =>
  pinnedNodes.value.map((node, index) => {
    const field = fieldOf(pinnedSlugs.value[index] ?? '')
    return { label: node.label, to: node.to!(code.value), field: field && isKnownField(field) ? field : null }
  })
)
const fields = computed(() => [...new Set(rows.value.map(row => row.field).filter((field): field is string => !!field))])

interface ScreenerValue { value: string | null; knowledgeDate: string | null }
const config = useRuntimeConfig()
const { data: values, pending: valuesPending, error: valuesError } = useAsyncData(
  () => `quick-view-${code.value}-${fields.value.join(',')}`,
  async () => {
    if (!fields.value.length) return {}
    const response = await $fetch<{ results: { symbol: string; values: Record<string, ScreenerValue | undefined> }[] }>('/screener/values', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { symbols: [code.value], columns: fields.value.map(field => ({ field })) },
      timeout: BFF_REQUEST_TIMEOUT_MS
    })
    return response.results[0]?.values ?? {}
  },
  // 釘選清單只在瀏覽器裡（登入後才從帳號同步），伺服器端算出來的會是預設清單
  { server: false, watch: [fields], default: () => ({}) as Record<string, ScreenerValue | undefined> }
)

// 每支指標各自的圖（2026-10-07「quick-view 加上圖表」→「圖表就是該指標各自的圖表」）：跟它自己那一頁
// 畫的是同一張——河流圖、或互動卡片連同成分與對照指標，規則照抄 StockMetricDetailPage／
// StockBadgeDetailPage。沒有圖的頁（配股配息、指標歷史、杜邦…）就不畫，表格裡照樣有它。
const categories = computed(() => schema.value?.categories ?? [])
const timeframesOf = (metricCode: string) => {
  const periods = findMetricInSchema(categories.value, metricCode)?.metric.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
}
const nameOf = (metricCode: string) => {
  const metric = findMetricInSchema(categories.value, metricCode)?.metric
  return metric ? (metric.nameSuffix ? `${metric.nameSuffix} ${metric.name}` : metric.name) : undefined
}
type ChartSpec = { river: 'pe' | 'pb' | 'ps' } | { metricCode: string; topic: string; timeframe: MetricsHistoryTimeframe; partCodes?: string[]; compareMetricCode?: string }
function chartOf(slug: string): ChartSpec | null {
  const page = METRIC_PAGES.find(item => item.slug === slug)
  if (page) return page.riverKind ? { river: page.riverKind } : { metricCode: page.metricCode, topic: page.topic, timeframe: page.timeframe, partCodes: page.partMetricCodes, compareMetricCode: page.compareMetricCode }
  const badge = BADGE_PAGES.find(item => item.slug === slug)
  if (!badge) return null
  if (badge.riverKind) return { river: badge.riverKind }
  return badge.chartTimeframe ? { metricCode: badgePageChartMetricCode(badge), topic: badge.topic, timeframe: badge.chartTimeframe, compareMetricCode: badge.compareMetricCode } : null
}
const charts = computed(() => pinnedSlugs.value.flatMap((slug, index) => {
  const spec = chartOf(slug)
  const node = pinnedNodes.value[index]
  return spec && node ? [{ slug, label: node.label, to: node.to!(code.value), spec }] : []
}))

const PERIOD_WORD: Record<string, string> = { ...TIMEFRAME_WORD, EOD: '每日' }
function valueText(field: string | null): string {
  if (!field) return '－'
  const cell = values.value[field]
  if (valuesPending.value && !cell) return '…'
  return cell?.value == null ? '－' : formatScreenerValue(cell.value, locateFieldInSchema(schema.value?.categories ?? [], field)?.field.unit, field)
}
function periodText(field: string | null): string {
  if (!field) return '整頁內容'
  const basis = field.split('.')[1] as MetricsHistoryTimeframe | 'EOD'
  const date = values.value[field]?.knowledgeDate
  return `${PERIOD_WORD[basis] ?? basis}${date ? `（${date}）` : ''}`
}

const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: TOPIC, pathSuffix: '/quick-view', stock, summary, sectorCode, noindex: true })
</script>

<template>
  <div v-loading="stockPending" class="stock-quick-view-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-quick-view" :question="`${stockShortName}的自選指標最新是多少？`" answer="側邊欄「自選指標」裡的每一項，這檔股票最新一期的數字。點名稱可以看它的歷年變化。">
        <el-alert v-if="valuesError" type="warning" :closable="false" show-icon title="數值暫時讀不到，請稍後再看" class="stock-quick-view-page__alert" />
        <!-- 圖在表前（2026-09-27 規則）。釘選清單只在瀏覽器裡，所以圖也只在瀏覽器畫 -->
        <ClientOnly>
          <!-- 每張圖一張卡片（2026-10-07「quick-view 圖表請放在卡片中」），跟指標頁的卡片同一個樣子 -->
          <el-card v-for="item in charts" :key="item.slug" shadow="never" class="stock-quick-view-page__chart">
            <template #header>
              <h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink></h3>
            </template>
            <StockValuationRiverChart v-if="'river' in item.spec" :symbol="code" :kind="item.spec.river" />
            <StockMetricHistoryChartInteractive
              v-else
              :symbol="code"
              :metric-code="item.spec.metricCode"
              :topic="item.spec.topic"
              :unit="findMetricInSchema(categories, item.spec.metricCode)?.metric.unit ?? ''"
              :default-timeframe="item.spec.timeframe"
              :available-timeframes="timeframesOf(item.spec.metricCode)"
              :part-codes="item.spec.partCodes"
              :part-names="item.spec.partCodes?.map(partCode => findMetricInSchema(categories, partCode)?.metric.name ?? partCode)"
              :compare-metric-code="item.spec.compareMetricCode"
              :compare-name="item.spec.compareMetricCode && nameOf(item.spec.compareMetricCode)"
              :compare-timeframes="item.spec.compareMetricCode ? timeframesOf(item.spec.compareMetricCode) : undefined"
            />
          </el-card>
        </ClientOnly>
        <SharedTableScroll v-if="rows.length" :label="`${stockShortName} ${code} 自選指標速覽`">
          <table class="seo-table">
            <caption class="visually-hidden">{{ stockShortName }} {{ code }} 的自選指標最新數值與期別</caption>
            <thead>
              <tr>
                <th scope="col">指標</th>
                <th scope="col" class="seo-table__num">最新數值</th>
                <th scope="col">期別（資料日期）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.to">
                <th scope="row"><NuxtLink :to="row.to" class="seo-table__link">{{ row.label }}</NuxtLink></th>
                <td class="seo-table__num">{{ valueText(row.field) }}</td>
                <td>{{ periodText(row.field) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
        <p v-else class="stock-quick-view-page__empty">
          還沒有釘選任何指標。到<NuxtLink :to="`/stock/${code}/metrics`">全部指標</NuxtLink>把想常看的釘到側邊欄。
        </p>
        <p class="stock-quick-view-page__more">
          <NuxtLink :to="`/stock/${code}/metrics#stock-metric-pinning`">調整自選指標與順序</NuxtLink>
        </p>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-quick-view-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-quick-view-page__chart {
  /* 圖表元件的回看年限選單貼在卡片右上角（同 .stock-metric-page__card） */
  position: relative;
  margin-bottom: 16px;
}

.stock-quick-view-page__chart :deep(.el-card__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}

.stock-quick-view-page__chart-title {
  margin: 0;
  font-size: 18px;
}

.stock-quick-view-page__alert {
  margin-bottom: 12px;
}

.stock-quick-view-page__empty,
.stock-quick-view-page__more {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}
</style>
