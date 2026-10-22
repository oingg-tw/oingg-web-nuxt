<script setup lang="ts">
import { DUPONT_METRIC_CODES, type StockDupontPageResponse } from '#shared/types/stock-dupont-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
// /stock/:code/dupont — 杜邦分析（「杜邦分析該怎麼呈現 放在哪個分類下?」）。三個因子分屬三個型錄分類（淨利率在獲利能力、資產週轉在
// 營運效率、權益乘數在安全韌性），那個分散就是主題：ROE 不是獨立的獲利數字，是獲利 × 資產效率 × 槓桿。歸在獲利能力（ROE 在型錄裡
// 的位置）。恆等式的量測與兩次差點讓這一頁夭折的錯誤量測見 shared/types/stock-dupont-page.ts。
// **刻意不做**：把 ROE 的變化歸因到某一個因子——算術只支持「三者相乘等於它」，ΔROE 的對數分解是前端自創的分析，排行與篩選器的
// 合規線同樣適用；五欄並排，讀者自己下結論（杜邦分析傳統上也是這樣教）。
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '杜邦分析'

// 數值格式與「哪幾期三項齊全」在 app/utils/dupont-series.ts，圖（四條線、期別、近N年）在 StockDupontChart——指標速覽也畫同一張（2026-10-14）
const rateText = dupontRateText
const timesText = dupontTimesText
const multipleText = dupontMultipleText

const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: dupontData, error: dupontError, status: dupontDataStatus, refresh: refreshDupontData } = await useAsyncData<StockDupontPageResponse | null>(
  () => `stock-dupont-${code.value}`,
  async () => {
    return readOrNull($fetch<StockDupontPageResponse>(`/api/stock/${code.value}/dupont`, { retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS }), 'stock-dupont')
  },
  { watch: [code], default: () => null }
)
// 讀失敗 vs 真的沒資料（2026-10-11，照 StockMetricDetailPage）：載入完成後請求出錯（4xx 由 readOrNull 變成 null，不算）或 series 是 null
//（伺服器 settle 失敗）＝讀不到，交給全站讀取失敗彈窗；畫面留空，不說「目前沒有資料」
const readFailed = computed(() => dupontDataStatus.value !== 'pending' && (!!dupontError.value || dupontData.value?.series === null))
watchLoadFailure(() => `stock-dupont:${code.value}`, () => dupontError.value ?? readFailed.value, refreshDupontData)

const activeSeries = computed(() => (basis.value === 'Q' ? dupontData.value?.quarterlySeries : dupontData.value?.series))

const ascending = computed<MetricsHistoryEntry[]>(() => trimDupontEntries(activeSeries.value?.entries ?? []))
const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value.find(isDupontComplete) ?? null)

// 期別切換（2026-09-22「杜邦分析圖表要可以選單季與近四季」）：兩種序列同一次請求就有，切換是換資料不是重抓。預設仍是近四季（單季
// ROE 是季報酬，9.71% 被讀成年化會高估約四倍）——但不藏基準也能防誤讀，所以 basisLabel 穿過這一頁的每一句、每個標題與註記。
const basis = ref<'TTM' | 'Q'>('TTM')
const basisLabel = computed(() => TIMEFRAME_LABELS[basis.value])
// 資產週轉率's plain-language gloss is the quiet half of the same trap: 0.14 次 is a QUARTER's
// turnover, and the table said「一年」unconditionally.
const turnoverPeriodWord = computed(() => (basis.value === 'Q' ? '一季' : '一年'))

const valueOf = (metricCode: string): number | null => latest.value?.values[metricCode]?.value ?? null

const roe = computed(() => valueOf('roe'))
const netProfitMargin = computed(() => valueOf('netProfitMargin'))
const taxBurden = computed(() => valueOf('dupontTaxBurden'))
const interestBurden = computed(() => valueOf('dupontInterestBurden'))
const ebitMargin = computed(() => valueOf('dupontEbitMargin'))
const assetTurnover = computed(() => valueOf('assetTurnover'))
const equityMultiplier = computed(() => valueOf('equityMultiplier'))

const hasFactors = computed(() => latest.value !== null)

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number | null }): string => (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)
const latestPeriodText = computed(() => (latest.value ? periodLabel(latest.value) : ''))

const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], DUPONT_METRIC_CODES))
// 頁尾的相關頁面（2026-10-11 從拆解段落末移進 StockPageFooter）
// 頁尾第一個連結是新手專區的完整說明（2026-10-12「把教學、說明與指標頁面分開」）：這一頁只留一句定義
const TOPIC_GUIDE = findLearnTopic('dupont')!
const footerLinks = computed(() => [
  { to: learnTopicPath(TOPIC_GUIDE.slug), label: `${TOPIC_GUIDE.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/roe`, label: '股東權益報酬率' },
  { to: `/stock/${code.value}/net-profit-margin`, label: '稅後淨利率' },
  { to: `/stock/${code.value}/margins`, label: '財報三率' },
  { to: `/stock/${code.value}/solvency`, label: '安全韌性的組成' },
  { to: `/stock/${code.value}/income-statement`, label: '損益表' },
  { to: `/stock/${code.value}/balance-sheet`, label: '資產負債表' }
])

// 兩位小數＋明說整條鏈有四捨五入——不用 margins／solvency 那套「讓算術剛好閉合」：這個恆等式是乘積不是加總，相對誤差會沿五個因子
// 累積。2330 實測：後端三個百分比因子已是 2 位，資產週轉與權益乘數是 4 位（0.5505／1.4761），那兩個也印 2 位會讓鏈從差 0.001pp 變
// 差 0.070pp（頁上寫 40.94%、旁邊的數字相乘是 41.01）。印 4 位能閉合但對這群讀者是錯的取捨；財報本身也是這樣處理。

// The five-factor expansion only renders when all three profit-stage factors are there. They are
// the ones that come back `insufficient_history` on a short-history company, so this is checked
// separately from hasFactors rather than folded into it — the three-factor page must stand up
// without them.
const hasExpansion = computed(() =>
  taxBurden.value !== null && interestBurden.value !== null && ebitMargin.value !== null
)

const valueAnswer = computed(() => {
  if (!hasFactors.value) return null
  return joinClauses([
    `${stockShortName.value}（${code.value}）${latestPeriodText.value} 的股東權益報酬率（${basisLabel.value}）為 ${rateText(roe.value)}`,
    `稅後淨利率 ${rateText(netProfitMargin.value)}`,
    `資產週轉率 ${timesText(assetTurnover.value)}`,
    `權益乘數 ${multipleText(equityMultiplier.value)}`
  ])
})

const chainAnswer = computed(() => {
  if (!hasFactors.value) return null
  // 用字精簡（2026-10-07「但我希望用字精簡點。圖表優先 文字其次」）：只留算式
  return `${rateText(netProfitMargin.value)} × ${timesText(assetTurnover.value)} × ${multipleText(equityMultiplier.value)} ≈ ${rateText(roe.value)}。`
})

const expansionAnswer = computed(() => {
  if (!hasExpansion.value) return null
  return `${rateText(taxBurden.value)} × ${rateText(interestBurden.value)} × ${rateText(ebitMargin.value)} ≈ ${rateText(netProfitMargin.value)}。`
})

const history = computed(() => {
  const list = periods.value
  return historyTableText({ shortName: stockShortName.value, code: code.value, topic: '杜邦三項', basis: basisLabel.value, count: list.length, from: list.length ? periodLabel(list.at(-1)!) : '', to: list.length ? periodLabel(list[0]!) : '' })
})
const historyAnswer = computed(() => (periods.value.length < 2 ? null : history.value.answer))
// 拆解表的表名（caption 藏起來，同 SharedTable 的 label；2026-10-13 統一）
const breakdownLabel = (topic: string) => `${stockShortName.value} ${code.value} ${latestPeriodText.value} 的${topic}拆解（${basisLabel.value}）`

const description = computed(() => {
  if (!hasFactors.value) return null
  return clampDescription(joinSentences([valueAnswer.value, historyAnswer.value]) ?? '')
})

const noindex = computed(() => !hasFactors.value)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '杜邦分析三項拆解 ROE',
  pathSuffix: '/dupont',
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <StockPageShell
    class="app-page app-page--compact stock-dupont-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: dataSources, links: footerLinks }"
  >
    <StockQuestionSection id="stock-dupont-value" :question="`${stockShortName}（${code}）的 ROE 由哪三個部分組成？`" :answer="valueAnswer">
      <!-- 讀不到時交給全站讀取失敗彈窗，畫面留空 -->
      <StockDupontChart v-if="dupontData && !readFailed" v-model:basis="basis" :data="dupontData" />
    </StockQuestionSection>

    <StockQuestionSection v-if="historyAnswer" id="stock-dupont-history" :question="history.question" :answer="historyAnswer">
      <SharedTable :label="history.label">
        <thead>
          <tr>
            <th scope="col">期別</th>
            <th scope="col">稅後淨利率</th>
            <th scope="col">資產週轉率</th>
            <th scope="col">權益乘數</th>
            <th scope="col">ROE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in periods" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
            <th scope="row">{{ periodLabel(entry) }}</th>
            <td>{{ rateText(entry.values.netProfitMargin?.value ?? null) }}</td>
            <td>{{ timesText(entry.values.assetTurnover?.value ?? null) }}</td>
            <td>{{ multipleText(entry.values.equityMultiplier?.value ?? null) }}</td>
            <td>{{ rateText(entry.values.roe?.value ?? null) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>

    <StockQuestionSection v-if="chainAnswer" id="stock-dupont-chain" question="這三項是怎麼乘成 ROE 的？" :answer="chainAnswer">
      <SharedTable :label="breakdownLabel('ROE 三項')">
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">數值</th>
            <th scope="col">意思</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">稅後淨利率</th>
            <td>{{ rateText(netProfitMargin) }}</td>
            <td>每 100 元營收最後留下多少</td>
          </tr>
          <tr>
            <th scope="row">資產週轉率</th>
            <td>{{ timesText(assetTurnover) }}</td>
            <td>資產{{ turnoverPeriodWord }}做出幾倍營收</td>
          </tr>
          <tr>
            <th scope="row">權益乘數</th>
            <td>{{ multipleText(equityMultiplier) }}</td>
            <td>總資產是自有資本的幾倍（槓桿）</td>
          </tr>
          <tr>
            <th scope="row">三項相乘＝ROE</th>
            <td>{{ rateText(roe) }}</td>
            <td>股東每 1 元一年賺回多少</td>
          </tr>
        </tbody>
      </SharedTable>

      <p class="stock-answer stock-dupont-page__note">
        ROE 變高可能是更賺錢、資產更有效率，或只是槓桿變大——權益乘數變大不代表本業變強。
      </p>

      <!-- Stated rather than engineered away: rounded factors multiplied together drift from the
           rounded ROE beside them, and a reader who checks with a calculator should find the
           reason on the page instead of finding a contradiction. Smaller with three factors than
           it was with five, but not zero. -->
      <p class="stock-answer stock-dupont-page__rounding">
        數字四捨五入到兩位小數，自己相乘可能和 ROE 差零點零幾。
      </p>

      <!-- The five-factor version, demoted to a closed details on 2026-09-22 rather than deleted:
           it answers the follow-up（「淨利率為什麼動了」）and its data arrives in the same request,
           but it needs three factors that a short-history company doesn't have, so it must never
           be what the page depends on（v-if 仍在：資料不夠的公司整段不出現）。
           2026-10-07 起不摺疊（使用者：「dupont 不摺疊了 都展開吧」），summary 改成小標題。 -->
      <section v-if="expansionAnswer" class="stock-dupont-page__expansion" aria-labelledby="stock-dupont-expansion-title">
        <h3 id="stock-dupont-expansion-title" class="stock-dupont-page__expansion-title">再往下拆：稅後淨利率的三個來源</h3>
        <p class="stock-answer">{{ expansionAnswer }}</p>
        <SharedTable :label="breakdownLabel('稅後淨利率')">
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">數值</th>
              <th scope="col">意思</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">稅務負擔</th>
              <td>{{ rateText(taxBurden) }}</td>
              <td>繳稅後留下幾成</td>
            </tr>
            <tr>
              <th scope="row">利息負擔</th>
              <td>{{ rateText(interestBurden) }}</td>
              <td>付利息後留下幾成</td>
            </tr>
            <tr>
              <th scope="row">EBIT 利潤率</th>
              <td>{{ rateText(ebitMargin) }}</td>
              <td>每 100 元營收的本業獲利</td>
            </tr>
            <tr>
              <th scope="row">三項相乘＝稅後淨利率</th>
              <td>{{ rateText(netProfitMargin) }}</td>
              <td>每 100 元營收最後留下多少</td>
            </tr>
          </tbody>
        </SharedTable>
      </section>

    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-dupont" :topic="TOPIC_GUIDE.topic" :definition="[TOPIC_GUIDE.summary]" />
    </template>
  </StockPageShell>
</template>

<style scoped>
.stock-dupont-page__expansion-title {
  margin: 24px 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-dupont-page__note {
  margin-top: 12px;
}

.stock-dupont-page__rounding {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}
</style>
