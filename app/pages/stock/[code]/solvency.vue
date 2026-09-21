<script setup lang="ts">
import type { WaterfallStep } from '~/components/stock/StockWaterfallChart.vue'
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import { SOLVENCY_METRIC_CODES, type StockSolvencyPageResponse } from '#shared/types/stock-solvency-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
import { clampDescription, collectMetricSources } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'

// /stock/:code/solvency — 安全韌性的組成, the first child of the nav's 安全韌性 group.
//
// Built from「只有單一一個指標呈現好像沒甚麼意思」and the decision that followed it（「那先做安全韌
// 性」）. The five per-ratio pages in that group each answer about ONE ratio; what a reader wants is
// how they relate, and here that relationship is genuinely arithmetic rather than a claim:
//
//   流動比率 − 速動比率 = 存貨 ÷ 流動負債       （exact — quickRatio's numerator IS
//   速動比率 − 現金比率 = 其他速動資產 ÷ 流動負債   CurrentAssets − Inventory, same denominator）
//   負債比率 + 股東權益比率 = 100%
//
// Both measured across 2330/1101/1216/2454/2317 before any of this was designed; the capital
// structure summed to exactly 100.00 on all five. That is the same bar /margins had to clear, and
// it is what lets this page describe its subject without a sentence of judgement — the standing
// line on the rank and screener pages too.
//
// What this page deliberately does NOT do is pair a fundamental with 股價. That idea came up in the
// same conversation and is a CORRELATION, not an identity: describing a chain of subtractions needs
// no claim about a company, while putting a ratio next to its price implies one. The one accepted
// exception is 月營收 × 股價（「畢竟這是台股特別玩法」— monthly revenue disclosure is a structural
// feature of this market, not a judgement about any company）, and that one is blocked on data
// regardless: /stocks/:symbol/monthly-revenue-history still returns 60 entries for 2330 and zero
// for everything else, and 月營收 has no metricCode at all.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const TOPIC = '安全韌性的組成'

const LIQUIDITY_SERIES = [
  { code: 'currentRatio', name: '流動比率', lineType: 'solid', symbol: 'circle' },
  { code: 'quickRatio', name: '速動比率', lineType: 'dashed', symbol: 'triangle' },
  { code: 'cashRatio', name: '現金比率', lineType: 'dotted', symbol: 'rect' }
] as const satisfies readonly LineSeriesSpec[]

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: solvencyData } = await useAsyncData<StockSolvencyPageResponse | null>(
  () => `stock-solvency-${code.value}`,
  async () => {
    try {
      return await $fetch<StockSolvencyPageResponse>(`/api/stock/${code.value}/solvency`, { retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-solvency] GET /api/stock/${code.value}/solvency unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code], default: () => null }
)

// Periods with none of the three liquidity ratios filed are dropped at the source — a financial
// gets 20 such rows back (no 流動資產/流動負債 split on a bank's balance sheet), which would
// otherwise render as a table of 尚無資料 cells. Same filter, same reason, as margins.vue's.
const ascending = computed<MetricsHistoryEntry[]>(() =>
  (solvencyData.value?.series?.entries ?? []).filter(entry => LIQUIDITY_SERIES.some(series => entry.values[series.code]?.value != null))
)
const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value[0] ?? null)

const valueOf = (metricCode: string): number | null => latest.value?.values[metricCode]?.value ?? null

const currentRatio = computed(() => valueOf('currentRatio'))
const quickRatio = computed(() => valueOf('quickRatio'))
const cashRatio = computed(() => valueOf('cashRatio'))
const debtRatio = computed(() => valueOf('debtRatio'))
const equityRatio = computed(() => valueOf('equityRatio'))

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number }): string => `${entry.fiscalYear} Q${entry.fiscalQuarter}`

// Where this page's numbers come from, per metric, from the catalog — see collectMetricSources.
const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], SOLVENCY_METRIC_CODES))

// Fixed 2 decimals for the same reason margins.vue states: this page's claim is that its columns
// add up, and 3 significant digits would print 245.76 as "246" and make a reader's own arithmetic
// disagree with the page.
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
const signedText = (value: number | null): string => (value === null ? '尚無資料' : `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`)

const latestPeriodText = computed(() => (latest.value ? periodLabel(latest.value) : ''))

const hasLiquidity = computed(() => currentRatio.value !== null && quickRatio.value !== null && cashRatio.value !== null)
const hasStructure = computed(() => debtRatio.value !== null && equityRatio.value !== null)

// The two gaps the ladder spends, each signed as the amount to ADD to the running figure — the
// same convention StockWaterfallChart's own formatSigned renders, so the column chains downward.
const inventoryShare = computed(() =>
  currentRatio.value !== null && quickRatio.value !== null ? quickRatio.value - currentRatio.value : null
)
const receivablesShare = computed(() =>
  quickRatio.value !== null && cashRatio.value !== null ? cashRatio.value - quickRatio.value : null
)

const liquiditySteps = computed<WaterfallStep[]>(() => {
  if (!hasLiquidity.value) return []
  const current = currentRatio.value!
  const quick = quickRatio.value!
  const cash = cashRatio.value!
  return [
    { label: '流動比率', start: 0, end: current, delta: null },
    { label: '減：存貨', start: current, end: quick, delta: quick - current },
    { label: '等於：速動比率', start: 0, end: quick, delta: null },
    { label: '減：應收等', start: quick, end: cash, delta: cash - quick },
    { label: '等於：現金比率', start: 0, end: cash, delta: null }
  ]
})

const valueAnswer = computed(() => {
  if (!latest.value || !hasLiquidity.value) return null
  return joinClauses([
    `${stockShortName.value}（${code.value}）${latestPeriodText.value} 的償債能力比率（單季）`,
    `流動比率 ${rateText(currentRatio.value)}`,
    `速動比率 ${rateText(quickRatio.value)}`,
    `現金比率 ${rateText(cashRatio.value)}`,
    latest.value.values.currentRatio?.knowledgeDate ? `資料時間 ${latest.value.values.currentRatio.knowledgeDate}` : null
  ])
})

const ladderAnswer = computed(() => {
  if (!hasLiquidity.value) return null
  return `這三個比率的分母都是同一筆流動負債，分子一層比一層嚴格：流動比率 ${rateText(currentRatio.value)} 扣掉存貨 ${rateText(Math.abs(inventoryShare.value!))} 後為速動比率 ${rateText(quickRatio.value)}，再扣掉應收帳款等其他速動資產 ${rateText(Math.abs(receivablesShare.value!))} 後為現金比率 ${rateText(cashRatio.value)}。`
})

const structureAnswer = computed(() => {
  if (!hasStructure.value) return null
  return `${stockShortName.value}的總資產裡，${rateText(debtRatio.value)} 由負債支應、${rateText(equityRatio.value)} 由股東權益支應，兩者相加必然等於 100%。`
})

const historyAnswer = computed(() => {
  const list = periods.value
  if (list.length < 2) return null
  return `以下為 ${stockShortName.value} 由新到舊的償債能力比率（單季），共 ${list.length} 期，涵蓋 ${periodLabel(list[list.length - 1]!)} 至 ${periodLabel(list[0]!)}。`
})

const description = computed(() => {
  if (!hasLiquidity.value) return null
  return clampDescription(joinSentences([valueAnswer.value, ladderAnswer.value]) ?? '')
})

const noindex = computed(() => !hasLiquidity.value)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '流動比率速動比率現金比率',
  pathSuffix: '/solvency',
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-solvency-page">
    <template v-if="stockPending" />
    <el-result v-else-if="!stock" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-solvency-value" :question="`${stockShortName}（${code}）的償債能力比率分別是多少？`" :answer="valueAnswer">
        <el-card shadow="never" class="stock-solvency-page__card">
          <StockMultiSeriesLineChart v-if="hasLiquidity" :entries="ascending" :series="LIQUIDITY_SERIES" unit="%" :format="rateText" />
          <p v-else class="stock-solvency-page__line">
            目前沒有這檔股票的償債能力比率資料。這三個比率都以流動負債為分母，銀行與保險業的資產負債表沒有流動／非流動的劃分，因此不會有這組數字。
          </p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="ladderAnswer" id="stock-solvency-ladder" question="流動、速動、現金比率差在哪裡？" :answer="ladderAnswer">
        <el-card shadow="never" class="stock-solvency-page__card">
          <StockWaterfallChart :steps="liquiditySteps" :format="rateText" :format-signed="signedText" />
        </el-card>

        <!-- Same treatment the margins page's own decomposition gets: the chart is the better read
             of a chain, but ECharts draws semantics-free SVG, so the numbers still have to exist as
             real table markup for a screen reader and for indexing. -->
        <details class="stock-solvency-page__details">
          <summary>看完整項目名稱與逐列數字</summary>
          <SharedTableScroll :label="`${stockShortName} ${code} 的短期償債比率拆解`">
            <table class="seo-table" data-ssr-table>
              <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 由流動比率逐項減到現金比率（單季，各項均為佔流動負債比率）</caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">佔流動負債比率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">流動比率</th>
                  <td>{{ rateText(currentRatio) }}</td>
                </tr>
                <tr>
                  <th scope="row">減：存貨</th>
                  <td>{{ rateText(inventoryShare === null ? null : Math.abs(inventoryShare)) }}</td>
                </tr>
                <tr>
                  <th scope="row">等於：速動比率</th>
                  <td>{{ rateText(quickRatio) }}</td>
                </tr>
                <tr>
                  <th scope="row">減：應收帳款等其他速動資產</th>
                  <td>{{ rateText(receivablesShare === null ? null : Math.abs(receivablesShare)) }}</td>
                </tr>
                <tr>
                  <th scope="row">等於：現金比率</th>
                  <td>{{ rateText(cashRatio) }}</td>
                </tr>
              </tbody>
            </table>
          </SharedTableScroll>
        </details>

        <p class="stock-answer stock-solvency-page__links">
          每一個比率各自的定義、限制與逐期數據：
          <NuxtLink :to="`/stock/${code}/current-ratio`">流動比率</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/quick-ratio`">速動比率</NuxtLink>。
          原始金額見<NuxtLink :to="`/stock/${code}/balance-sheet`">資產負債表</NuxtLink>。
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="structureAnswer" id="stock-solvency-structure" :question="`${stockShortName}的資產有多少是借來的？`" :answer="structureAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的資本結構`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 的總資產來源（單季）</caption>
            <thead>
              <tr>
                <th scope="col">來源</th>
                <th scope="col">佔總資產比率</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">負債</th>
                <td>{{ rateText(debtRatio) }}</td>
              </tr>
              <tr>
                <th scope="row">股東權益</th>
                <td>{{ rateText(equityRatio) }}</td>
              </tr>
              <tr>
                <th scope="row">合計</th>
                <td>{{ rateText(debtRatio !== null && equityRatio !== null ? debtRatio + equityRatio : null) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>

        <p class="stock-answer stock-solvency-page__links">
          負債的組成與成本：
          <NuxtLink :to="`/stock/${code}/debt-ratio`">負債比率</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/interest-bearing-debt-to-equity`">有息負債權益比</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/interest-coverage`">利息保障倍數</NuxtLink>。
        </p>

        <p v-if="dataSources.length" class="stock-answer stock-solvency-page__sources">資料來源：{{ dataSources.join('、') }}</p>
      </StockQuestionSection>

      <StockQuestionSection v-if="periods.length" id="stock-solvency-history" :question="`${stockShortName}的償債能力歷年怎麼變化？`" :answer="historyAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的償債能力比率逐期數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 的償債能力比率（單季）</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">流動比率（%）</th>
                <th scope="col">速動比率（%）</th>
                <th scope="col">現金比率（%）</th>
                <th scope="col">負債比率（%）</th>
                <th scope="col">資料時間</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in periods" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
                <th scope="row">{{ periodLabel(entry) }}</th>
                <td v-for="metricCode in ['currentRatio', 'quickRatio', 'cashRatio', 'debtRatio']" :key="metricCode">
                  {{ rateText(entry.values[metricCode]?.value ?? null) }}
                </td>
                <td>{{ entry.values.currentRatio?.knowledgeDate ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-solvency-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-solvency-page__line {
  margin: 0;
}

.stock-solvency-page__links {
  margin-top: 16px;
}

.stock-solvency-page__sources {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
}

.stock-solvency-page__details {
  margin-top: 16px;
}

/* ≥48px target for the disclosure toggle — a <summary> is a real button to every browser but gets
   no size from the UA beyond its text's own line box. */
.stock-solvency-page__details > summary {
  display: flex;
  align-items: center;
  min-height: 48px;
  cursor: pointer;
}
</style>
