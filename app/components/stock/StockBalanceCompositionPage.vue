<script setup lang="ts">
import type { BalanceCompositionPeriod, StockBalanceCompositionResponse } from '#shared/types/stock-balance-composition'
// 流動資產組成／非流動資產組成／負債組成（2026-10-12）。三個路由檔只剩 <StockBalanceCompositionPage kind="…" />（同 StockStatementPage 的分派）。
//
// 一開始照負債組成套指標頁模板、畫占總資產的百分比；使用者同日：「流動資產與非流動資產 是不是用存量表示而不用百分比較好」，選了
// 「圖用金額、答句與表格附占比」，接著「debt-composition 也改用數字而非比例」。理由：只看占比會騙人——總資產變大時存貨金額增加、
// 占比卻可能下降；也看不出公司長大了沒有。只看金額則不能跨公司比，所以表格每一格是「金額（占總資產%）」。
//
// 金額從資產負債表原始科目加總，分組對著 analysis-ts 的占比指標反推、多檔實測對得上（見 shared/utils/balance-composition.ts）。
// 圖與表的期別、近N年、單位在共用的 StockBalanceCompositionChart。答句固定講最新一季。金融業不分流動與非流動，拆不開就只說一句為什麼。
const props = defineProps<{ kind: 'current' | 'noncurrent' | 'debt' }>()

const KINDS = {
  current: { topic: '流動資產組成', total: '流動資產', pathSuffix: '/current-asset-composition', titleKeywords: '流動資產組成現金應收帳款與存貨', labels: CURRENT_ASSET_PART_LABELS as Record<string, string>, metricCode: 'currentAssetsToAssets', learnLabel: '流動資產占比怎麼看' },
  noncurrent: { topic: '非流動資產組成', total: '非流動資產', pathSuffix: '/non-current-asset-composition', titleKeywords: '非流動資產組成廠房設備轉投資與無形資產', labels: NONCURRENT_ASSET_PART_LABELS as Record<string, string>, metricCode: 'nonCurrentAssetsToAssets', learnLabel: '非流動資產占比怎麼看' },
  debt: { topic: '負債組成', total: '負債', pathSuffix: '/debt-composition', titleKeywords: '負債組成借款應付帳款與公司債', labels: DEBT_PART_LABELS as Record<string, string>, metricCode: 'debtRatio', learnLabel: '負債比率怎麼看' }
} as const
const page = KINDS[props.kind]
const sectionId = `stock${page.pathSuffix.replace('/', '-')}`

// 從一期取出這一頁的合計與各項（千元）
function pick(period: BalanceCompositionPeriod): { total: number; parts: Record<string, number> } | null {
  if (props.kind === 'debt') return period.debt ? { total: period.debt.liabilities, parts: period.debt.parts } : null
  if (!period.assets) return null
  return props.kind === 'current'
    ? { total: period.assets.currentAssets, parts: period.assets.current }
    : { total: period.assets.noncurrentAssets, parts: period.assets.noncurrent }
}

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// await 在頂層：同 key 的 useAsyncData 沒 await 會被多個同時掛載的元件卡在初始值（2026-09-09 根因過一次）
const { data, error, refresh } = await useAsyncData(
  () => `stock-balance-composition-${code.value}`,
  () => $fetch<StockBalanceCompositionResponse>(`/api/stock/${code.value}/balance-composition`),
  { watch: [code], default: () => null }
)
watchLoadFailure(() => `stock-balance-composition:${code.value}`, () => error.value, refresh)

const periods = computed(() => data.value?.periods ?? [])
const latestPeriod = computed(() => [...periods.value].reverse().find(period => pick(period) !== null) ?? null)

const money = (thousand: number) => formatMoney(thousand * 1000)
const share = (thousand: number, totalAssets: number) => `${((thousand / totalAssets) * 100).toFixed(1)}%`

const question = computed(() => `${stockShortName.value}（${code.value}）的${page.total}由哪些項目組成？`)
// 答句講最新一季，由大到小，每一項附占總資產比
const answer = computed(() => {
  const period = latestPeriod.value
  const picked = period && pick(period)
  if (!period || !picked) return null
  const parts = Object.keys(page.labels)
    .filter(key => (picked.parts[key] ?? 0) > 0)
    .sort((a, b) => picked.parts[b]! - picked.parts[a]!)
    .map(key => `${page.labels[key]} ${money(picked.parts[key]!)}（${share(picked.parts[key]!, period.totalAssets)}）`)
  return `${period.fiscalYear} Q${period.fiscalQuarter} 的${page.total} ${money(picked.total)}，占總資產 ${share(picked.total, period.totalAssets)}：${parts.join('、')}。括號裡是占總資產的比率。`
})
const emptyAnswer = computed(() => `${stockShortName.value}沒有可以拆開的${page.total}。銀行、保險、證券與金控的資產負債表不分流動與非流動，這一頁不適用。`)

const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], page.metricCode)?.metric ?? null)
const definition = computed(() => firstSentence(metricEntry.value?.description))
const SIBLINGS = [
  { slug: 'current-asset-composition', topic: '流動資產組成' },
  { slug: 'non-current-asset-composition', topic: '非流動資產組成' },
  { slug: 'debt-composition', topic: '負債組成' }
]
const footerLinks = computed(() => [
  { to: metricPath(page.metricCode), label: `${page.learnLabel}（新手專區）` },
  ...SIBLINGS.filter(sibling => `/${sibling.slug}` !== page.pathSuffix).map(sibling => ({ to: `/stock/${code.value}/${sibling.slug}`, label: sibling.topic })),
  ...(props.kind === 'debt' ? [{ to: `/stock/${code.value}/debt-ratio`, label: '負債比率' }] : []),
  { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` }
])

const description = computed(() => clampDescription(answer.value ?? emptyAnswer.value))
const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: page.topic, titleKeywords: page.titleKeywords, pathSuffix: page.pathSuffix, stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-balance-composition-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="page.topic" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection v-if="answer" :id="sectionId" :question="question" :answer="answer">
        <StockBalanceCompositionChart :periods="periods" :pick="pick" :labels="page.labels" :total-label="page.total" share-of-assets :short-name="stockShortName" :code="code" :topic="page.total" :table-section-id="`${sectionId}-table`" />
      </StockQuestionSection>
      <StockQuestionSection v-else-if="!error" :id="sectionId" :question="question" :answer="emptyAnswer" />

      <StockMetricGuide :id-prefix="sectionId" :topic="page.total" :definition="definition ? [definition] : []" />
      <StockPageFooter :sources="metricEntry?.sources ?? []" :links="footerLinks" />
    </template>
  </div>
</template>
