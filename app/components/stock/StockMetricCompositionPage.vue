<script setup lang="ts">
import type { StockMetricPageResponse } from '#shared/types/stock-metric-page'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
// 指標的組成頁（2026-10-14，指標頁一致性盤點，使用者：「我本以為組成都有各自頁面了」→ 選了拆成獨立頁面）：營業費用、股東總回饋率
// 原本把組成段塞在指標頁裡，跟資產負債表的四張組成頁不一致。這裡是一張堆疊圖＋一張逐期組成表，指標頁回到「圖＋歷年表＋計算依據」。
// 資料跟指標頁讀同一支（/api/stock/:code/metric?slug=母項），母項與成分同一次取回，恆等式檢查在 StockMetricCompositionSection 裡。
const props = defineProps<{
  // 母項指標頁的 slug（METRIC_PAGES 裡帶 partMetricCodes 的那幾頁）
  parentSlug: string
  topic: string
  pathSuffix: string
  titleKeywords: string
}>()

const metricPage = findMetricPage(props.parentSlug)
if (!metricPage?.partMetricCodes) throw createError({ statusCode: 404, statusMessage: 'unknown composition page', fatal: true })
const partCodes = metricPage.partMetricCodes

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// 跟指標頁同一個 key：從指標頁點過來不用重抓
const { data: metricData, error, refresh } = await useAsyncData<StockMetricPageResponse | null>(
  () => `stock-metric-${code.value}-${props.parentSlug}`,
  () => readOrNull($fetch<StockMetricPageResponse>(`/api/stock/${code.value}/metric`, { query: { slug: props.parentSlug }, retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS }), 'stock-metric'),
  { watch: [code], default: () => null }
)
watchLoadFailure(() => `stock-metric-composition:${props.parentSlug}:${code.value}`, () => error.value ?? (metricData.value?.series === null ? true : null), refresh)

const categories = computed(() => filterSchema.value?.categories ?? [])
const metricEntry = computed(() => findMetricInSchema(categories.value, metricPage.metricCode)?.metric ?? null)
const valueTopic = metricPage.valueTopic ?? metricPage.topic
const nameOf = (metricCode: string) => findMetricInSchema(categories.value, metricCode)?.metric.name ?? metricCode
const partNames = computed(() => partCodes.map(nameOf))
const availableTimeframes = computed<MetricsHistoryTimeframe[]>(() => {
  const periods = metricEntry.value?.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
})

const definition = computed(() => firstSentence(metricGuideFrom(findMetricCopy(metricPage.metricCode), metricEntry.value).definition[0] ?? null))
const dataSources = computed(() => collectMetricSources(categories.value, [metricPage.metricCode, ...partCodes]))
// 成分自己有指標頁的才連（銀行業專用的幾支沒有）
const partPages = computed(() => partCodes.flatMap((partCode) => {
  const page = METRIC_PAGES.find(item => item.metricCode === partCode)
  return page ? [{ to: `/stock/${code.value}/${page.slug}`, label: page.topic }] : []
}))
const footerLinks = computed(() => [
  { to: metricPath(metricPage.metricCode), label: `${metricPage.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/${metricPage.slug}`, label: metricPage.topic },
  ...partPages.value,
  { to: `/stock/${code.value}/income-statement`, label: `${stockShortName.value} ${code.value} 最新一期的損益表` }
])

const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）的${valueTopic}由${partNames.value.join('、')}組成：逐期列出各項的數值與占比，資料整理自公開資訊觀測站的財務報表。`))
const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: props.topic, titleKeywords: props.titleKeywords, pathSuffix: props.pathSuffix, stock, summary, description, sectorCode })
</script>

<template>
  <StockPageShell
    class="app-page stock-metric-composition-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :is-favorite="isFavorite"
    :short-name="stockShortName"
    :topic="topic"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: dataSources, links: footerLinks }"
    @toggle-favorite="toggleFavorite"
  >
    <StockMetricCompositionSection
      v-if="metricData?.series"
      :entries="metricData.series.entries"
      :parent-code="metricPage.metricCode"
      :part-codes="partCodes"
      :timeframe="metricPage.timeframe"
      :topic="valueTopic"
      :short-name="stockShortName"
      :code="code"
    >
      <StockMetricHistoryChartInteractive
        :symbol="code"
        :metric-code="metricPage.metricCode"
        :topic="valueTopic"
        :unit="metricEntry?.unit ?? ''"
        :default-timeframe="metricPage.timeframe"
        :available-timeframes="availableTimeframes"
        :part-codes="partCodes"
        :part-names="partNames"
      />
    </StockMetricCompositionSection>

    <StockQuestionSection id="stock-metric-composition-source" question="這些數字是從哪份報表來的？" :answer="`${valueTopic}與各項成分都來自損益表與股利資料，整理自公開資訊觀測站（MOPS）的公司申報；各項加起來等於${valueTopic}的期別才列出來。`" />
    <template #guide>
      <StockMetricGuide id-prefix="stock-metric-composition" :topic="metricPage.topic" :definition="definition ? [definition] : []" />
    </template>
  </StockPageShell>
</template>
