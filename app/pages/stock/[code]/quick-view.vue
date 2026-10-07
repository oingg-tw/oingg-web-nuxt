<script setup lang="ts">
import { Bottom, Check, Plus, Top } from '@element-plus/icons-vue'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { StockSeriesResponse } from '#shared/types/stock-series'
import { BADGE_PAGES, METRIC_PAGES, badgePageChartMetricCode, hasPinnableChart } from '#shared/utils/hub-slugs'
import { findMetricInSchema } from '~/utils/stock-digest'
import { METRIC_INDEX_BY_SLUG, STOCK_METRIC_INDEX, type StockNavNode } from '~/utils/stock-page-nav'
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

const { pinnedSlugs, isPinned, isFull, toggle, move } = useStockPinnedMetrics()

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

// 每一列帶自己的 slug，不靠索引跟 pinnedSlugs 對齊：清單裡有已下架的 slug 時（目錄查不到、這裡濾掉）
// 索引會錯位，上移／下移就會動到別支。
const rows = computed(() =>
  pinnedSlugs.value.flatMap(slug => {
    const node = METRIC_INDEX_BY_SLUG.get(slug)
    if (!node) return []
    const field = fieldOf(slug)
    return [{ slug, label: node.label, to: node.to!(code.value), field: field && isKnownField(field) ? field : null }]
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
// StockBadgeDetailPage；配股配息是它那一頁的殖利率市場分布卡。沒有圖的頁不能釘（hasPinnableChart），
// 所以格子跟釘選清單一對一。
const categories = computed(() => schema.value?.categories ?? [])
const timeframesOf = (metricCode: string) => {
  const periods = findMetricInSchema(categories.value, metricCode)?.metric.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
}
const nameOf = (metricCode: string) => {
  const metric = findMetricInSchema(categories.value, metricCode)?.metric
  return metric ? (metric.nameSuffix ? `${metric.nameSuffix} ${metric.name}` : metric.name) : undefined
}
type ChartSpec = { dividend: true } | { river: 'pe' | 'pb' | 'ps' } | { metricCode: string; topic: string; timeframe: MetricsHistoryTimeframe; partCodes?: string[]; compareMetricCode?: string }
function chartOf(slug: string): ChartSpec | null {
  if (slug === 'dividend') return { dividend: true }
  const page = METRIC_PAGES.find(item => item.slug === slug)
  if (page) return page.riverKind ? { river: page.riverKind } : { metricCode: page.metricCode, topic: page.topic, timeframe: page.timeframe, partCodes: page.partMetricCodes, compareMetricCode: page.compareMetricCode }
  const badge = BADGE_PAGES.find(item => item.slug === slug)
  if (!badge) return null
  if (badge.riverKind) return { river: badge.riverKind }
  return badge.chartTimeframe ? { metricCode: badgePageChartMetricCode(badge), topic: badge.topic, timeframe: badge.chartTimeframe, compareMetricCode: badge.compareMetricCode } : null
}
// 標題後面接最新數值（2026-10-07「速覽 卡片 左上角的 後面 請放上數值」），跟表格同一份 /screener/values
const charts = computed(() => rows.value.flatMap(row => {
  const spec = chartOf(row.slug)
  return spec ? [{ ...row, spec }] : []
}))

// 上移／下移在表格最後一欄（2026-10-07「把上移／下移做進速覽 表格中」）。按鈕不是拖曳：拖曳要另補
// 一套鍵盤操作（WCAG 2.5.7）。移動後焦點跟著那一列；移到頭／尾時那一顆會 disabled，改落到另一顆。
const orderAnnouncement = ref('')
async function moveRow(slug: string, offset: -1 | 1, label: string) {
  move(slug, offset)
  const position = rows.value.findIndex(row => row.slug === slug)
  orderAnnouncement.value = `${label} 移到第 ${position + 1} 個`
  await nextTick()
  const atEdge = offset < 0 ? position === 0 : position === rows.value.length - 1
  document.getElementById(`quick-view-${atEdge ? (offset < 0 ? 'down' : 'up') : (offset < 0 ? 'up' : 'down')}-${slug}`)?.focus()
}

// 格子最後一格固定是「加入指標」（2026-10-07「grid最後一個欄位永遠是個placeholder，按下以後打開彈窗，
// 這個彈窗可以選要加入的指標」）。彈窗列的是全部指標頁同一份目錄、同一個分組；按一下就釘／取消，
// 跟側邊欄共用同一份清單，所以沒有「確定」鈕——關掉就是完成。
const pickerOpen = ref(false)
const slugOf = (node: StockNavNode) => node.to!('_').split('/').pop()!
const pickerGroups = STOCK_METRIC_INDEX
  .map(group => ({ label: group.label, children: (group.children ?? []).filter(link => hasPinnableChart(slugOf(link))) }))
  .filter(group => group.children.length)

// 分布卡要的百分位跟配股配息頁讀同一份（Nitro 快取的 series?page=dividend），有釘才抓
const { data: dividendPercentile } = useAsyncData(
  () => `quick-view-dividend-${code.value}`,
  async () => {
    if (!pinnedSlugs.value.includes('dividend')) return null
    const series = await $fetch<StockSeriesResponse>(`/api/stock/${code.value}/series`, { query: { page: 'dividend' }, retry: 0, timeout: BFF_REQUEST_TIMEOUT_MS }).catch(() => null)
    return series?.payerPercentile ?? null
  },
  { server: false, watch: [pinnedSlugs], default: () => null }
)

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
          <div class="stock-quick-view-page__grid">
          <template v-for="item in charts" :key="item.slug">
          <StockDividendYieldPercentileCard v-if="'dividend' in item.spec" :symbol="code" :percentile="dividendPercentile" class="stock-quick-view-page__chart">
            <template #title>
              <h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field) }}</span></h3>
            </template>
          </StockDividendYieldPercentileCard>
          <el-card v-else shadow="never" class="stock-quick-view-page__chart">
            <template #header>
              <h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field) }}</span></h3>
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
          </template>
          <button type="button" class="stock-quick-view-page__add" @click="pickerOpen = true">
            <el-icon aria-hidden="true"><Plus /></el-icon>加入指標
          </button>
          </div>
          <el-dialog v-model="pickerOpen" title="加入指標" width="min(720px, 92vw)" align-center>
            <p class="stock-quick-view-page__picker-status" aria-live="polite">
              已加入 {{ pinnedSlugs.length }} / {{ PINNED_METRIC_LIMIT }} 個{{ isFull ? '，已到上限，先取消一個才能再加' : '' }}
            </p>
            <section v-for="group in pickerGroups" :key="group.label" class="stock-quick-view-page__picker-group">
              <h3 class="stock-quick-view-page__picker-title">{{ group.label }}</h3>
              <ul class="stock-quick-view-page__picker-list">
                <li v-for="link in group.children" :key="slugOf(link)">
                  <button
                    type="button"
                    class="stock-quick-view-page__picker-item"
                    :class="{ 'is-pinned': isPinned(slugOf(link)) }"
                    :aria-pressed="isPinned(slugOf(link))"
                    :disabled="!isPinned(slugOf(link)) && isFull"
                    @click="toggle(slugOf(link))"
                  >
                    <el-icon aria-hidden="true"><component :is="isPinned(slugOf(link)) ? Check : Plus" /></el-icon>{{ link.label }}
                  </button>
                </li>
              </ul>
            </section>
          </el-dialog>
        </ClientOnly>
        <SharedTableScroll v-if="rows.length" :label="`${stockShortName} ${code} 自選指標速覽`">
          <table class="seo-table">
            <caption class="visually-hidden">{{ stockShortName }} {{ code }} 的自選指標最新數值與期別</caption>
            <thead>
              <tr>
                <th scope="col">指標</th>
                <th scope="col" class="seo-table__num">最新數值</th>
                <th scope="col">期別（資料日期）</th>
                <th scope="col">順序</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.slug">
                <th scope="row"><NuxtLink :to="row.to" class="seo-table__link">{{ row.label }}</NuxtLink></th>
                <td class="seo-table__num">{{ valueText(row.field) }}</td>
                <td>{{ periodText(row.field) }}</td>
                <td class="stock-quick-view-page__order">
                  <button :id="`quick-view-up-${row.slug}`" type="button" class="stock-quick-view-page__move" :disabled="index === 0" :aria-label="`${row.label} 上移`" @click="moveRow(row.slug, -1, row.label)">
                    <el-icon aria-hidden="true"><Top /></el-icon>上移
                  </button>
                  <button :id="`quick-view-down-${row.slug}`" type="button" class="stock-quick-view-page__move" :disabled="index === rows.length - 1" :aria-label="`${row.label} 下移`" @click="moveRow(row.slug, 1, row.label)">
                    <el-icon aria-hidden="true"><Bottom /></el-icon>下移
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
        <p v-else class="stock-quick-view-page__empty">
          還沒有釘選任何指標。到<NuxtLink :to="`/stock/${code}/metrics`">全部指標</NuxtLink>把想常看的釘到側邊欄。
        </p>
        <p class="visually-hidden" aria-live="polite">{{ orderAnnouncement }}</p>
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

/* 卡片排成格狀（2026-10-07「quick-view 圖表希望grid排列」）；欄寬下限讓窄螢幕自然落回單欄 */
.stock-quick-view-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stock-quick-view-page__chart {
  /* 圖表元件的回看年限選單貼在卡片右上角（同 .stock-metric-page__card） */
  position: relative;
  min-width: 0;
}

.stock-quick-view-page__chart :deep(.el-card__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}

.stock-quick-view-page__chart-title {
  margin: 0;
  font-size: 18px;
}

.stock-quick-view-page__chart-value {
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

/* 虛線外框＝空位，跟實心的圖表卡片一眼分得出來；同一列裡會被 grid 撐到跟旁邊的卡片一樣高 */
.stock-quick-view-page__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  border: 2px dashed var(--el-border-color);
  border-radius: var(--el-card-border-radius, 4px);
  background: transparent;
  color: var(--el-color-primary-dark-2);
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}

.stock-quick-view-page__add:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.stock-quick-view-page__picker-status {
  margin: 0 0 8px;
  color: var(--el-text-color-regular);
}

.stock-quick-view-page__picker-group + .stock-quick-view-page__picker-group {
  margin-top: 16px;
}

.stock-quick-view-page__picker-title {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.stock-quick-view-page__picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-quick-view-page__picker-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

/* 已加入：實心底＋勾號，不只靠顏色 */
.stock-quick-view-page__picker-item.is-pinned {
  border-color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
}

.stock-quick-view-page__picker-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 按鈕列高 44px，文字欄跟著置中，不要貼在上緣 */
.seo-table tbody th,
.seo-table tbody td {
  vertical-align: middle;
}

.stock-quick-view-page__order {
  white-space: nowrap;
}

.stock-quick-view-page__move {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

.stock-quick-view-page__move + .stock-quick-view-page__move {
  margin-left: 8px;
}

.stock-quick-view-page__move:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.stock-quick-view-page__alert {
  margin-bottom: 12px;
}

.stock-quick-view-page__empty {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}
</style>
