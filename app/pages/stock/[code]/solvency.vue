<script setup lang="ts">
import type { WaterfallStep } from '~/components/stock/StockWaterfallChart.vue'
import { SOLVENCY_LIQUIDITY_CODES, SOLVENCY_METRIC_CODES, type StockSolvencyPageResponse } from '#shared/types/stock-solvency-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
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
const code = computed(() => String(route.params.code))

const TOPIC = '安全韌性的組成'

const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// 瀏覽器裡換頁不等資料（lazy，2026-10-23）：讀取中（pending）放答句與圖的骨架，不落到「目前沒有資料」
const { data: solvencyData, error: solvencyError, status: solvencyDataStatus, pending: solvencyPending, refresh: refreshSolvencyData } = await useAsyncData<StockSolvencyPageResponse | null>(
  () => `stock-solvency-${code.value}`,
  async () => {
    return readOrNull($fetch<StockSolvencyPageResponse>(`/api/stock/${code.value}/solvency`, { retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS }), 'stock-solvency')
  },
  { watch: [code], default: () => null, lazy: true }
)
// 讀失敗 vs 真的沒資料（2026-10-11，照 StockMetricDetailPage）：載入完成後請求出錯（4xx 由 readOrNull 變成 null，不算）或 series 是 null
//（伺服器 settle 失敗）＝讀不到，交給全站讀取失敗彈窗；畫面留空，不說「目前沒有資料」
const readFailed = computed(() => solvencyDataStatus.value !== 'pending' && (!!solvencyError.value || solvencyData.value?.series === null))
const answerSkeleton = computed(() => (solvencyPending.value ? `${stockShortName.value}（${code.value}）2026 Q2 的償債能力比率（單季）、流動比率 000.00%、速動比率 000.00%、現金比率 000.00%、資料時間 2026-08-11。` : null))
watchLoadFailure(() => `stock-solvency:${code.value}`, () => solvencyError.value ?? readFailed.value, refreshSolvencyData)

// Periods with none of the three liquidity ratios filed are dropped at the source — a financial
// gets 20 such rows back (no 流動資產/流動負債 split on a bank's balance sheet), which would
// otherwise render as a table of 尚無資料 cells. Same filter, same reason, as margins.vue's.
const ascending = computed<MetricsHistoryEntry[]>(() =>  (solvencyData.value?.series?.entries ?? []).filter(entry => SOLVENCY_LIQUIDITY_CODES.some(ratioCode => entry.values[ratioCode]?.value != null))
)
// 圖（三條線、區間選單）在 StockRatioLinesChart，指標速覽畫同一張

const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value[0] ?? null)

const valueOf = (metricCode: string): number | null => latest.value?.values[metricCode]?.value ?? null

const currentRatio = computed(() => valueOf('currentRatio'))
const quickRatio = computed(() => valueOf('quickRatio'))
const cashRatio = computed(() => valueOf('cashRatio'))
const debtRatio = computed(() => valueOf('debtRatio'))
const equityRatio = computed(() => valueOf('equityRatio'))

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number | null }): string => (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)

// Where this page's numbers come from, per metric, from the catalog — see collectMetricSources.
const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], SOLVENCY_METRIC_CODES))
// 頁尾的相關頁面（2026-10-11 從兩個段落末移進 StockPageFooter）：各比率自己的頁，原始金額在資產負債表
// 頁尾前的定義區（2026-10-14 指標頁一致性盤點，「關係頁補定義區」）：這一頁的主線是流動比率，定義取型錄的第一句
const definition = computed(() => firstSentence(findMetricInSchema(filterSchema.value?.categories ?? [], 'currentRatio')?.metric.description))
const footerLinks = computed(() => [
  { to: metricPath('currentRatio'), label: '流動比率怎麼看（新手專區）' },
  { to: `/stock/${code.value}/current-ratio`, label: '流動比率' },
  { to: `/stock/${code.value}/quick-ratio`, label: '速動比率' },
  { to: `/stock/${code.value}/debt-ratio`, label: '負債比率' },
  { to: `/stock/${code.value}/interest-bearing-debt-to-equity`, label: '有息負債權益比' },
  { to: `/stock/${code.value}/interest-coverage`, label: '利息保障倍數' },
  { to: `/stock/${code.value}/balance-sheet`, label: '資產負債表' }
])

// 數字一律固定兩位小數（rateText／signedText，shared/utils/number-format.ts）：3 位有效數字會把 245.76 印成「246」，讀者自己加減就跟頁面對不上

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
    `流動比率 ${fixedRateText(currentRatio.value)}`,
    `速動比率 ${fixedRateText(quickRatio.value)}`,
    `現金比率 ${fixedRateText(cashRatio.value)}`,
    latest.value.values.currentRatio?.knowledgeDate ? `資料時間 ${latest.value.values.currentRatio.knowledgeDate}` : null
  ])
})

const ladderAnswer = computed(() => {
  if (!hasLiquidity.value) return null
  return `這三個比率的分母都是同一筆流動負債，分子一層比一層嚴格：流動比率 ${fixedRateText(currentRatio.value)} 扣掉存貨 ${fixedRateText(Math.abs(inventoryShare.value!))} 後為速動比率 ${fixedRateText(quickRatio.value)}，再扣掉應收帳款等其他速動資產 ${fixedRateText(Math.abs(receivablesShare.value!))} 後為現金比率 ${fixedRateText(cashRatio.value)}。`
})

const structureAnswer = computed(() => {
  if (!hasStructure.value) return null
  return `${stockShortName.value}的總資產裡，${fixedRateText(debtRatio.value)} 由負債支應、${fixedRateText(equityRatio.value)} 由股東權益支應，兩者相加必然等於 100%。`
})

const history = computed(() => {
  const list = periods.value
  return historyTableText({ shortName: stockShortName.value, code: code.value, topic: '償債能力比率', basis: '單季', count: list.length, from: list.length ? periodLabel(list.at(-1)!) : '', to: list.length ? periodLabel(list[0]!) : '' })
})
const historyAnswer = computed(() => (periods.value.length < 2 ? null : history.value.answer))
// 拆解表的表名（caption 藏起來，同 SharedTable 的 label；2026-10-13 統一）
const breakdownLabel = (topic: string) => `${stockShortName.value} ${code.value} ${latestPeriodText.value} 的${topic}拆解（單季）`

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
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <StockPageShell
    class="app-page app-page--compact stock-solvency-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: dataSources, links: footerLinks }"
  >
    <StockQuestionSection id="stock-solvency-value" :question="`${stockShortName}（${code}）的償債能力比率分別是多少？`" :answer="valueAnswer" :answer-skeleton="answerSkeleton">
      <StockRatioLinesChart v-if="hasLiquidity" page="solvency" :entries="ascending" />
      <SharedChartCard v-else-if="solvencyPending"><div class="app-skeleton app-skeleton--chart" aria-hidden="true" /></SharedChartCard>
      <template v-else-if="readFailed" />
      <p v-else class="stock-solvency-page__line">
        目前沒有這檔股票的償債能力比率資料。這三個比率都以流動負債為分母，銀行與保險業的資產負債表沒有流動／非流動的劃分，因此不會有這組數字。
      </p>
    </StockQuestionSection>

    <StockQuestionSection v-if="periods.length" id="stock-solvency-history" :question="history.question" :answer="historyAnswer">
      <SharedTable :label="history.label">
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
              {{ fixedRateText(entry.values[metricCode]?.value ?? null) }}
            </td>
            <td>{{ entry.values.currentRatio?.knowledgeDate ?? '—' }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>

    <StockQuestionSection v-if="ladderAnswer" id="stock-solvency-ladder" question="流動、速動、現金比率差在哪裡？" :answer="ladderAnswer">
      <StockWaterfallChart :steps="liquiditySteps" :format="fixedRateText" :format-signed="fixedSignedRateText" />

      <!-- Same treatment the margins page's own decomposition gets: the chart is the better read
           of a chain, but ECharts draws semantics-free SVG, so the numbers still have to exist as
           real table markup for a screen reader and for indexing. -->
      <details class="stock-solvency-page__details">
        <summary>看完整項目名稱與逐列數字</summary>
        <SharedTable :label="breakdownLabel('短期償債比率')">
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">佔流動負債比率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">流動比率</th>
              <td>{{ fixedRateText(currentRatio) }}</td>
            </tr>
            <tr>
              <th scope="row">減：存貨</th>
              <td>{{ fixedRateText(inventoryShare === null ? null : Math.abs(inventoryShare)) }}</td>
            </tr>
            <tr>
              <th scope="row">等於：速動比率</th>
              <td>{{ fixedRateText(quickRatio) }}</td>
            </tr>
            <tr>
              <th scope="row">減：應收帳款等其他速動資產</th>
              <td>{{ fixedRateText(receivablesShare === null ? null : Math.abs(receivablesShare)) }}</td>
            </tr>
            <tr>
              <th scope="row">等於：現金比率</th>
              <td>{{ fixedRateText(cashRatio) }}</td>
            </tr>
          </tbody>
        </SharedTable>
      </details>

    </StockQuestionSection>

    <StockQuestionSection v-if="structureAnswer" id="stock-solvency-structure" :question="`${stockShortName}的資產有多少是借來的？`" :answer="structureAnswer">
      <SharedTable :label="breakdownLabel('總資產來源')">
        <thead>
          <tr>
            <th scope="col">來源</th>
            <th scope="col">佔總資產比率</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">負債</th>
            <td>{{ fixedRateText(debtRatio) }}</td>
          </tr>
          <tr>
            <th scope="row">股東權益</th>
            <td>{{ fixedRateText(equityRatio) }}</td>
          </tr>
          <tr>
            <th scope="row">合計</th>
            <td>{{ fixedRateText(debtRatio !== null && equityRatio !== null ? debtRatio + equityRatio : null) }}</td>
          </tr>
        </tbody>
      </SharedTable>

    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-solvency" topic="流動比率" :definition="definition ? [definition] : []" />
    </template>
  </StockPageShell>
</template>

<style scoped>

.stock-solvency-page__line {
  margin: 0;
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
