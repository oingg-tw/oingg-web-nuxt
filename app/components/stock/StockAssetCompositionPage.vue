<script setup lang="ts">
import type { StockAssetCompositionResponse } from '#shared/types/stock-asset-composition'
// 流動資產組成／非流動資產組成（2026-10-12）。兩個路由檔只剩 <StockAssetCompositionPage side="…" />（同 StockStatementPage 的分派）。
//
// 一開始照負債組成套指標頁模板、畫占總資產的百分比；使用者同日：「流動資產與非流動資產 是不是用存量表示而不用百分比較好」，
// 選了「圖用金額、答句與表格附占比」。理由：只看占比會騙人——總資產變大時存貨金額增加、占比卻可能下降；也看不出公司長大了沒有。
// 只看金額則不能跨公司比，所以表格每一格是「金額（占總資產%）」。
//
// 圖與表照「淨值從哪來」：年度 Q4 快照＋最新一期，金額堆疊。金額從資產負債表直接加總，分組對著 analysis-ts 的 12 支占比反推、
// 440 格實測對得上（見 shared/utils/asset-composition.ts）。金融業不分流動與非流動，拆不開就只說一句為什麼。
const props = defineProps<{ side: 'current' | 'noncurrent' }>()

const SIDES = {
  current: { topic: '流動資產組成', total: '流動資產', pathSuffix: '/current-asset-composition', titleKeywords: '流動資產組成現金應收帳款與存貨', labels: CURRENT_ASSET_PART_LABELS, metricCode: 'currentAssetsToAssets', siblingSlug: 'non-current-asset-composition', siblingTopic: '非流動資產組成' },
  noncurrent: { topic: '非流動資產組成', total: '非流動資產', pathSuffix: '/non-current-asset-composition', titleKeywords: '非流動資產組成廠房設備轉投資與無形資產', labels: NONCURRENT_ASSET_PART_LABELS, metricCode: 'nonCurrentAssetsToAssets', siblingSlug: 'current-asset-composition', siblingTopic: '流動資產組成' }
} as const
const page = SIDES[props.side]
const sectionId = `stock${page.pathSuffix.replace('/', '-')}`

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// await 在頂層：同 key 的 useAsyncData 沒 await 會被多個同時掛載的元件卡在初始值（2026-09-09 根因過一次）
const { data, error, refresh } = await useAsyncData(
  () => `stock-asset-composition-${code.value}`,
  () => $fetch<StockAssetCompositionResponse>(`/api/stock/${code.value}/asset-composition`),
  { watch: [code], default: () => null }
)
watchLoadFailure(() => `stock-asset-composition:${code.value}`, () => error.value, refresh)

const periods = computed(() => data.value?.periods ?? [])
const latest = computed(() => periods.value.at(-1) ?? null)
const partsOf = (period: NonNullable<typeof latest.value>) => (props.side === 'current' ? period.current : period.noncurrent) as Record<string, number>
const totalOf = (period: NonNullable<typeof latest.value>) => (props.side === 'current' ? period.currentAssets : period.noncurrentAssets)

// 金額一律 formatMoney（萬／億／兆＋4 位有效數字，2026-10-12）。原本是整數億元，7711 的不動產廠房及設備印成「0 億元（0.2%）」
const money = (thousand: number) => formatMoney(thousand * 1000)
// 圖的單位依最大合計自動選：到 1 億元才用億元，否則用萬元；圖層傳原值、不先四捨五入（原本每層先取整數億，小公司整張圖是平的）
const chartUnit = computed(() => {
  const max = Math.max(0, ...periods.value.map(totalOf))
  return max >= 1e5 ? { divisor: 1e5, label: '億元' } : { divisor: 10, label: '萬元' }
})
const share = (thousand: number, totalAssets: number) => `${((thousand / totalAssets) * 100).toFixed(1)}%`

// 層的順序由最新一期的大小決定，圖、表、答句共用（第 0 層拿強調色）；全部期別都是 0 的項目不畫也不列
const order = computed(() => {
  const last = latest.value
  if (!last) return []
  return (Object.keys(page.labels) as string[])
    .filter(part => periods.value.some(period => partsOf(period)[part]! > 0))
    .sort((a, b) => partsOf(last)[b]! - partsOf(last)[a]!)
})
const labelOf = (part: string) => (page.labels as Record<string, string>)[part]!

const layers = computed(() => order.value.map(part => ({ name: labelOf(part), values: periods.value.map(period => partsOf(period)[part]! / chartUnit.value.divisor) })))

const question = computed(() => `${stockShortName.value}（${code.value}）的${page.total}由哪些項目組成？`)
const answer = computed(() => {
  const last = latest.value
  if (!last) return null
  const parts = order.value.map(part => `${labelOf(part)} ${money(partsOf(last)[part]!)}（${share(partsOf(last)[part]!, last.totalAssets)}）`)
  const first = periods.value[0]
  const trend = first && first !== last ? `${first.label} 年底的${page.total}是 ${money(totalOf(first))}。` : ''
  return `${last.label} 的${page.total} ${money(totalOf(last))}，占總資產 ${share(totalOf(last), last.totalAssets)}：${parts.join('、')}。括號裡是占總資產的比率。${trend}`
})
const emptyAnswer = computed(() => `${stockShortName.value}沒有可以拆開的${page.total}。銀行、保險、證券與金控的資產負債表不分流動與非流動，這一頁不適用。`)

const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], page.metricCode)?.metric ?? null)
const definition = computed(() => firstSentence(metricEntry.value?.description))
const footerLinks = computed(() => [
  { to: metricPath(page.metricCode), label: `${page.total}占比怎麼看（新手專區）` },
  { to: `/stock/${code.value}/${page.siblingSlug}`, label: page.siblingTopic },
  { to: `/stock/${code.value}/debt-composition`, label: '負債組成' },
  { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` }
])

const description = computed(() => clampDescription(answer.value ?? emptyAnswer.value))
const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: page.topic, titleKeywords: page.titleKeywords, pathSuffix: page.pathSuffix, stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-asset-composition-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="page.topic" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection v-if="answer" :id="sectionId" :question="question" :answer="answer">
        <StockStackedBarChart
          :categories="periods.map(period => period.label)"
          :layers="layers"
          :unit="chartUnit.label"
          :value-formatter="value => money(value * chartUnit.divisor)"
          :tooltip-header="index => `${periods[index]?.label}　${page.total} ${money(periods[index] ? totalOf(periods[index]!) : 0)}`"
        />
      </StockQuestionSection>
      <StockQuestionSection v-else-if="!error" :id="sectionId" :question="question" :answer="emptyAnswer" />

      <StockQuestionSection v-if="answer" :id="`${sectionId}-table`" :question="`每一年的${page.total}各是多少？`" answer="每一格是金額，括號裡是占總資產的比率；年度是第四季底的數字，最後一列是最新一季。">
        <SharedTableScroll :label="`${stockShortName} ${code} 的${page.topic}逐年數據`">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ stockShortName }} {{ code }} 的{{ page.topic }}，金額與占總資產比</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">{{ page.total }}合計</th>
                <th v-for="part in order" :key="part" scope="col">{{ labelOf(part) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="period in [...periods].reverse()" :key="period.label">
                <th scope="row">{{ period.label }}</th>
                <td class="seo-table__num">{{ money(totalOf(period)) }}（{{ share(totalOf(period), period.totalAssets) }}）</td>
                <td v-for="part in order" :key="part" class="seo-table__num">{{ money(partsOf(period)[part]!) }}（{{ share(partsOf(period)[part]!, period.totalAssets) }}）</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <StockMetricGuide :id-prefix="sectionId" :topic="page.total" :definition="definition ? [definition] : []" />
      <StockPageFooter :sources="metricEntry?.sources ?? []" :links="footerLinks" />
    </template>
  </div>
</template>
