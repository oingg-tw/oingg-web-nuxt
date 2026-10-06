<script setup lang="ts">
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import { BADGE_PAGES, METRIC_PAGES } from '#shared/utils/hub-slugs'
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

.stock-quick-view-page__alert {
  margin-bottom: 12px;
}

.stock-quick-view-page__empty,
.stock-quick-view-page__more {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}
</style>
