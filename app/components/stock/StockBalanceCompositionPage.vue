<script setup lang="ts">
import type { BalanceCompositionPeriod, StockBalanceCompositionResponse } from '#shared/types/stock-balance-composition'
import type { CashFlowCompositionPeriod, StockCashFlowCompositionResponse } from '#shared/types/stock-cash-flow-composition'
// 流動資產組成／非流動資產組成／負債組成（2026-10-12）＋淨值組成（2026-10-14 從 /equity-source 拆出）。四個路由檔只剩 <StockBalanceCompositionPage kind="…" />（同 StockStatementPage 的分派）。
//
// 一開始照負債組成套指標頁模板、畫占總資產的百分比；使用者同日：「流動資產與非流動資產 是不是用存量表示而不用百分比較好」，選了
// 「圖用金額、答句與表格附占比」，接著「debt-composition 也改用數字而非比例」。理由：只看占比會騙人——總資產變大時存貨金額增加、
// 占比卻可能下降；也看不出公司長大了沒有。只看金額則不能跨公司比，所以表格每一格是「金額（占總資產%）」。
//
// 金額從資產負債表原始科目加總，分組對著 analysis-ts 的占比指標反推、多檔實測對得上（見 shared/utils/balance-composition.ts）。
// 圖與表的期別、近N年、單位在共用的 StockBalanceCompositionChart。答句固定講最新一季。金融業不分流動與非流動，拆不開就只說一句為什麼。
// 現金流量的組成（cashFlow，2026-10-17）也是這一頁：資料走 cash-flow-composition、答句講最新一個年度的收入與支出各由什麼組成
const props = defineProps<{ kind: 'current' | 'noncurrent' | 'debt' | 'equity' | 'cashFlow' }>()

// 合計名稱、各項名稱與 shareOfAssets 在 BALANCE_COMPOSITION_KINDS（指標速覽畫同一張圖，共用那一份）
const KINDS = {
  current: { ...BALANCE_COMPOSITION_KINDS.current, topic: '流動資產組成', pathSuffix: '/current-asset-composition', titleKeywords: '流動資產組成現金應收帳款與存貨', metricCode: 'currentAssetsToAssets', learnLabel: '流動資產占比怎麼看' },
  noncurrent: { ...BALANCE_COMPOSITION_KINDS.noncurrent, topic: '非流動資產組成', pathSuffix: '/non-current-asset-composition', titleKeywords: '非流動資產組成廠房設備轉投資與無形資產', metricCode: 'nonCurrentAssetsToAssets', learnLabel: '非流動資產占比怎麼看' },
  debt: { ...BALANCE_COMPOSITION_KINDS.debt, topic: '負債組成', pathSuffix: '/debt-composition', titleKeywords: '負債組成借款應付帳款與公司債', metricCode: 'debtRatio', learnLabel: '負債比率怎麼看' },
  // 淨值的各項占「淨值」而不是占總資產：保留盈餘占總資產幾 % 讀不出「淨值是賺來的還是投進來的」。合計是歸屬母公司權益。
  // 定義自己寫：型錄的股東權益比率（equityRatio）沒有說明文字（2026-10-14 實查 description 是 null），而這一頁問的是「淨值」本身；
  // 新手專區連到每股淨值，那一頁有完整說明
  // 定義自己寫：型錄沒有「現金流量」本身這一支；新手專區連到營業現金流對淨利比
  cashFlow: { ...CASH_FLOW_COMPOSITION_KIND, shareOfAssets: false, topic: '現金流量的組成', pathSuffix: '/cash-flow-composition', titleKeywords: '現金流量組成收入與支出占比', metricCode: 'ocfToNetIncome', learnLabel: '營業現金流對淨利比怎麼看', guideTopic: '現金流量', definition: '現金流量表記錄一段期間內真正收到與付出的現金，分成營業、投資、籌資三種活動；這一頁把收入與支出各拆成幾個大項。' },
  equity: { ...BALANCE_COMPOSITION_KINDS.equity, topic: '淨值組成', pathSuffix: '/equity-composition', titleKeywords: '淨值組成股本資本公積與保留盈餘', metricCode: 'equityRatio', learnMetricCode: 'bvps', learnLabel: '每股淨值怎麼看', definition: '淨值是公司的資產扣掉負債之後屬於股東的部分，也叫股東權益；這一頁拆的是歸屬母公司股東的那一份。' }
} as const
const page = KINDS[props.kind]
const sectionId = `stock${page.pathSuffix.replace('/', '-')}`

const pick = (period: BalanceCompositionPeriod | CashFlowCompositionPeriod) => {
  if ('cashFlow' in period) return period.cashFlow ? { total: period.cashFlow.netChange, parts: period.cashFlow.parts as Record<string, number> } : null
  return props.kind === 'cashFlow' ? null : pickBalanceComposition(props.kind, period)
}

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// await 在頂層：同 key 的 useAsyncData 沒 await 會被多個同時掛載的元件卡在初始值（2026-09-09 根因過一次）
const { data, error, refresh } = await useAsyncData(
  () => `stock-${props.kind === 'cashFlow' ? 'cash-flow' : 'balance'}-composition-${code.value}`,
  () => $fetch<StockBalanceCompositionResponse | StockCashFlowCompositionResponse>(`/api/stock/${code.value}/${props.kind === 'cashFlow' ? 'cash-flow' : 'balance'}-composition`),
  { watch: [code], default: () => null }
)
watchLoadFailure(() => `stock-balance-composition:${code.value}`, () => error.value, refresh)

const periods = computed<(BalanceCompositionPeriod | CashFlowCompositionPeriod)[]>(() => data.value?.periods ?? [])
// 現金流量講最新一個年度（沒有完整年度才講最新一季）；資產負債表講最新一季
const latestPeriod = computed(() => {
  const usable = [...periods.value].reverse().filter(period => pick(period) !== null)
  return (props.kind === 'cashFlow' ? usable.find(period => period.fiscalQuarter === null) : null) ?? usable.find(period => period.fiscalQuarter !== null) ?? null
})
const periodName = (period: { fiscalYear: number; fiscalQuarter: number | null }) => (period.fiscalQuarter === null ? `${period.fiscalYear} 年` : `${period.fiscalYear} Q${period.fiscalQuarter}`)

const money = (thousand: number) => formatMoney(thousand * 1000)
const share = (thousand: number, totalAssets: number) => `${((thousand / totalAssets) * 100).toFixed(1)}%`

const question = computed(() => (props.kind === 'cashFlow'
  ? `${stockShortName.value}（${code.value}）的現金從哪裡來、花到哪裡去？`
  : `${stockShortName.value}（${code.value}）的${page.total}由哪些項目組成？`))
// 現金流量：收入與支出各列最大的三項與占比，最後是現金增減。只陳述數字，不評價
const flowAnswer = (period: BalanceCompositionPeriod | CashFlowCompositionPeriod, picked: { total: number; parts: Record<string, number> }) => {
  const side = (sign: 1 | -1) => {
    const keys = Object.keys(page.labels).filter(key => Math.sign(picked.parts[key] ?? 0) === sign).sort((a, b) => Math.abs(picked.parts[b]!) - Math.abs(picked.parts[a]!))
    const whole = keys.reduce((sum, key) => sum + Math.abs(picked.parts[key]!), 0)
    return { whole, text: keys.slice(0, 3).map(key => `${page.labels[key]} ${share(Math.abs(picked.parts[key]!), whole)}`).join('、') }
  }
  const income = side(1)
  const spending = side(-1)
  return `${periodName(period)}現金收入 ${money(income.whole)}，${income.text}；支出 ${money(spending.whole)}，${spending.text}；現金${picked.total >= 0 ? '增加' : '減少'} ${money(Math.abs(picked.total))}。百分比是占全部收入或全部支出的比率。`
}
// 答句講最新一季，由大到小，每一項附占比（資產與負債占總資產、淨值占淨值）
const answer = computed(() => {
  const period = latestPeriod.value
  const picked = period && pick(period)
  if (!period || !picked) return null
  if (!('totalAssets' in period)) return flowAnswer(period, picked)
  const base = page.shareOfAssets ? period.totalAssets : picked.total
  const parts = Object.keys(page.labels)
    .filter(key => (picked.parts[key] ?? 0) > 0)
    .sort((a, b) => picked.parts[b]! - picked.parts[a]!)
    .map(key => `${page.labels[key]} ${money(picked.parts[key]!)}（${share(picked.parts[key]!, base)}）`)
  return page.shareOfAssets
    ? `${period.fiscalYear} Q${period.fiscalQuarter} 的${page.total} ${money(picked.total)}，占總資產 ${share(picked.total, period.totalAssets)}：${parts.join('、')}。括號裡是占總資產的比率。`
    : `${period.fiscalYear} Q${period.fiscalQuarter} 的${page.total}（歸屬母公司權益）${money(picked.total)}：${parts.join('、')}。括號裡是占淨值的比率。`
})
const emptyAnswer = computed(() => (props.kind === 'equity' || props.kind === 'cashFlow'
  ? `${stockShortName.value}目前沒有可以拆開的${props.kind === 'equity' ? '淨值' : '現金流量'}資料。`
  : `${stockShortName.value}沒有可以拆開的${page.total}。銀行、保險、證券與金控的資產負債表不分流動與非流動，這一頁不適用。`))

const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], page.metricCode)?.metric ?? null)
const definition = computed(() => ('definition' in page ? page.definition : firstSentence(metricEntry.value?.description)))
const SIBLINGS = [
  { slug: 'current-asset-composition', topic: '流動資產組成' },
  { slug: 'non-current-asset-composition', topic: '非流動資產組成' },
  { slug: 'debt-composition', topic: '負債組成' },
  { slug: 'equity-composition', topic: '淨值組成' }
]
// 現金流量的組成連到現金流那一組的頁面與現金流量表，不連資產負債表那四頁
const CASH_FLOW_LINKS = [
  { slug: 'ocf-to-net-income', topic: '營業現金流對淨利比' },
  { slug: 'fcf-conversion-rate', topic: '自由現金流轉換率' },
  { slug: 'capex-to-revenue', topic: '資本支出佔營收比' }
]
const footerLinks = computed(() => props.kind === 'cashFlow' ? [
  { to: metricPath(page.metricCode), label: `${page.learnLabel}（新手專區）` },
  ...CASH_FLOW_LINKS.map(link => ({ to: `/stock/${code.value}/${link.slug}`, label: link.topic })),
  { to: `/stock/${code.value}/cash-flow-statement`, label: `${stockShortName.value} ${code.value} 最新一期的現金流量表` }
] : [
  { to: metricPath('learnMetricCode' in page ? page.learnMetricCode : page.metricCode), label: `${page.learnLabel}（新手專區）` },
  ...SIBLINGS.filter(sibling => `/${sibling.slug}` !== page.pathSuffix).map(sibling => ({ to: `/stock/${code.value}/${sibling.slug}`, label: sibling.topic })),
  ...(props.kind === 'debt' ? [{ to: `/stock/${code.value}/debt-ratio`, label: '負債比率' }] : []),
  ...(props.kind === 'equity' ? [{ to: `/stock/${code.value}/equity-source`, label: '淨值從哪來' }, { to: `/stock/${code.value}/equity-growth`, label: '淨值成長年增率' }] : []),
  { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` }
])

const description = computed(() => clampDescription(answer.value ?? emptyAnswer.value))
const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: page.topic, titleKeywords: page.titleKeywords, pathSuffix: page.pathSuffix, stock, summary, description, sectorCode })
</script>

<template>
  <StockPageShell
    class="app-page stock-balance-composition-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :short-name="stockShortName"
    :topic="page.topic"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: metricEntry?.sources ?? [], links: footerLinks }"
  >
    <StockQuestionSection v-if="answer" :id="sectionId" :question="question" :answer="answer">
      <StockBalanceCompositionChart :periods="periods" :kind="kind" :short-name="stockShortName" :code="code" :table-section-id="`${sectionId}-table`" />
    </StockQuestionSection>
    <StockQuestionSection v-else-if="!error" :id="sectionId" :question="question" :answer="emptyAnswer" />
    <template #guide>
      <StockMetricGuide :id-prefix="sectionId" :topic="'guideTopic' in page ? page.guideTopic : page.total" :definition="definition ? [definition] : []" />
    </template>
  </StockPageShell>
</template>
