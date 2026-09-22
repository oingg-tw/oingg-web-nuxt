<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import { DUPONT_METRIC_CODES, type StockDupontPageResponse } from '#shared/types/stock-dupont-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
import { clampDescription, collectMetricSources } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'

// /stock/:code/dupont — 杜邦分析, the first child of the nav's 獲利能力 group.
//
// Built from「杜邦分析該怎麼呈現 放在哪個分類下?」. Its five factors live in three different
// catalog categories（淨利率-side in 獲利能力, 資產週轉 in 營運效率, 權益乘數 in 安全韌性）and that
// spread IS the subject: ROE is not a profitability number on its own, it is profitability × asset
// efficiency × leverage. The page is filed under 獲利能力 because ROE is what it decomposes and
// that is where ROE sits in the catalog; the cross-group nature is content, stated and linked, not
// a taxonomy problem to solve by inventing a fourth top-level group for one page.
//
// See shared/types/stock-dupont-page.ts for the measured identities, and for the two wrong
// measurements that nearly killed this page.
//
// WHAT THIS PAGE DELIBERATELY WILL NOT DO is attribute a CHANGE in ROE to a particular factor. The
// arithmetic supports「these five multiply to this」and nothing more; a log-change decomposition of
// ΔROE would be a frontend-invented analytic, and the same compliance line that keeps the rank and
// screener pages descriptive applies here. The table puts the five columns side by side and the
// reader draws their own conclusion — which is also the traditional way DuPont is taught.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const TOPIC = '杜邦分析'

// The three that multiply to 淨利率. Exactly three series sharing one unit, which is the whole
// budget StockMultiSeriesLineChart is designed around (three colours, three line types, three
// symbol shapes) — so this page needs no chart component of its own. 資產週轉（次）and
// 權益乘數（倍）stay out of it: different units cannot share an axis, and indexing them to a common
// base is unsafe here because these factors legitimately go negative on a loss-making quarter.
const PROFIT_SERIES = [
  { code: 'dupontEbitMargin', name: 'EBIT 利潤率', lineType: 'solid', symbol: 'circle' },
  { code: 'dupontInterestBurden', name: '利息負擔', lineType: 'dashed', symbol: 'triangle' },
  { code: 'dupontTaxBurden', name: '稅務負擔', lineType: 'dotted', symbol: 'rect' }
] as const satisfies readonly LineSeriesSpec[]

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: dupontData } = await useAsyncData<StockDupontPageResponse | null>(
  () => `stock-dupont-${code.value}`,
  async () => {
    try {
      return await $fetch<StockDupontPageResponse>(`/api/stock/${code.value}/dupont`, { retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-dupont] GET /api/stock/${code.value}/dupont unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code], default: () => null }
)

// A period only counts when ALL FIVE factors and ROE are present — this page's entire claim is that
// the columns multiply, and a row missing one of them would print a product a reader cannot check.
// Financials drop out here in full: 資產週轉 is not filed for a bank (its assets are loans, not
// productive capital), so every row fails this test rather than some of them. Measured: of 25
// symbols sampled, the 8 with nothing were 2881/2882/2884/2891/2886/5880/2801/2823 — all financials,
// none of anything else.
const REQUIRED = ['roe', ...DUPONT_METRIC_CODES.filter(metricCode => metricCode !== 'netProfitMargin')]
const ascending = computed<MetricsHistoryEntry[]>(() =>
  (dupontData.value?.series?.entries ?? []).filter(entry => REQUIRED.every(metricCode => entry.values[metricCode]?.value != null))
)
const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value[0] ?? null)

const valueOf = (metricCode: string): number | null => latest.value?.values[metricCode]?.value ?? null

const roe = computed(() => valueOf('roe'))
const netProfitMargin = computed(() => valueOf('netProfitMargin'))
const taxBurden = computed(() => valueOf('dupontTaxBurden'))
const interestBurden = computed(() => valueOf('dupontInterestBurden'))
const ebitMargin = computed(() => valueOf('dupontEbitMargin'))
const assetTurnover = computed(() => valueOf('assetTurnover'))
const equityMultiplier = computed(() => valueOf('equityMultiplier'))

const hasFactors = computed(() => latest.value !== null)

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number }): string => `${entry.fiscalYear} Q${entry.fiscalQuarter}`
const latestPeriodText = computed(() => (latest.value ? periodLabel(latest.value) : ''))

const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], DUPONT_METRIC_CODES))

// 2 decimals to read, and an explicit note that the chain is rounded — NOT the「make the arithmetic
// close exactly」treatment margins.vue and solvency.vue use, because this identity is a PRODUCT and
// theirs are sums. Relative rounding errors compound across five factors instead of cancelling.
//
// Measured on 2330: the backend publishes the three percentage factors at 2dp already（83.85 /
// 99.56 / 60.35）but 資產週轉 and 權益乘數 at 4（0.5505 / 1.4761）. Printing those two at 2dp as well
// takes the chain from 0.001pp off to 0.070pp off — the page printed「… ＝ 40.94%」while the numbers
// beside it multiplied to 41.01, which a reader with a calculator would catch.
//
// Showing 4 decimals would close it（0.5505 次）and is the wrong trade for this audience. Saying so
// is the honest fix, and the one financial statements themselves use. The alternative — dropping
// the chain entirely — would cost the page its point, since watching the five multiply IS what
// DuPont teaches.
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
const timesText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 次`)
const multipleText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 倍`)

const valueAnswer = computed(() => {
  if (!hasFactors.value) return null
  return joinClauses([
    `${stockShortName.value}（${code.value}）${latestPeriodText.value} 的股東權益報酬率（近四季）為 ${rateText(roe.value)}`,
    `稅務負擔 ${rateText(taxBurden.value)}`,
    `利息負擔 ${rateText(interestBurden.value)}`,
    `EBIT 利潤率 ${rateText(ebitMargin.value)}`,
    `資產週轉 ${timesText(assetTurnover.value)}`,
    `權益乘數 ${multipleText(equityMultiplier.value)}`
  ])
})

const chainAnswer = computed(() => {
  if (!hasFactors.value) return null
  return `這五個數字相乘就會得到 ROE：${rateText(taxBurden.value)} × ${rateText(interestBurden.value)} × ${rateText(ebitMargin.value)} × ${timesText(assetTurnover.value)} × ${multipleText(equityMultiplier.value)}，約為 ${rateText(roe.value)}。前三項相乘是稅後淨利率 ${rateText(netProfitMargin.value)}，所以這張表也可以讀成「淨利率 × 資產週轉 × 權益乘數」這個比較常見的三項版本。`
})

const historyAnswer = computed(() => {
  const list = periods.value
  if (list.length < 2) return null
  return `以下為 ${stockShortName.value} 由新到舊的杜邦五項拆解（近四季），共 ${list.length} 期，涵蓋 ${periodLabel(list[list.length - 1]!)} 至 ${periodLabel(list[0]!)}。`
})

const description = computed(() => {
  if (!hasFactors.value) return null
  return clampDescription(joinSentences([valueAnswer.value, historyAnswer.value]) ?? '')
})

const noindex = computed(() => !hasFactors.value)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '杜邦分析五項拆解 ROE',
  pathSuffix: '/dupont',
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-dupont-page">
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

      <StockQuestionSection id="stock-dupont-value" :question="`${stockShortName}（${code}）的 ROE 由哪五個部分組成？`" :answer="valueAnswer">
        <el-card shadow="never" class="stock-dupont-page__card">
          <StockMultiSeriesLineChart v-if="hasFactors" :entries="ascending" :series="PROFIT_SERIES" unit="%" :format="rateText" />
          <p v-else class="stock-dupont-page__line">
            目前沒有這檔股票的杜邦拆解資料。這五項裡的資產週轉率需要「營收 ÷ 總資產」，而銀行、保險與金控的資產是放款和保單，不是用來生產的設備，因此不會有這個數字，也就無法做杜邦拆解。
          </p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="chainAnswer" id="stock-dupont-chain" question="這五項是怎麼乘成 ROE 的？" :answer="chainAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的杜邦五項拆解`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 的 ROE 五項拆解（近四季）</caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">數值</th>
                <th scope="col">這一項在問什麼</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">稅務負擔</th>
                <td>{{ rateText(taxBurden) }}</td>
                <td>稅前賺的錢，繳完稅後留下幾成</td>
              </tr>
              <tr>
                <th scope="row">利息負擔</th>
                <td>{{ rateText(interestBurden) }}</td>
                <td>本業賺的錢，付完利息後留下幾成</td>
              </tr>
              <tr>
                <th scope="row">EBIT 利潤率</th>
                <td>{{ rateText(ebitMargin) }}</td>
                <td>每 100 元營收，本業賺到多少（還沒扣利息和稅）</td>
              </tr>
              <tr>
                <th scope="row">資產週轉率</th>
                <td>{{ timesText(assetTurnover) }}</td>
                <td>公司的資產一年可以做出幾倍的營收</td>
              </tr>
              <tr>
                <th scope="row">權益乘數</th>
                <td>{{ multipleText(equityMultiplier) }}</td>
                <td>總資產是股東自有資本的幾倍，也就是槓桿開多大</td>
              </tr>
              <tr>
                <th scope="row">五項相乘＝ROE</th>
                <td>{{ rateText(roe) }}</td>
                <td>股東每投入 1 元，一年賺回多少</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>

        <p class="stock-answer stock-dupont-page__note">
          為什麼要拆成五項：ROE 下滑可能是被加稅、被利息吃掉、本業變差、資產用得比較沒效率，或只是槓桿收掉了——這是五個完全不同的結論。
          常見的三項版本把前三者合併成一個「淨利率」，就分不出來是哪一種。
        </p>

        <!-- Stated rather than engineered away: five rounded factors multiplied together drift from
             the rounded ROE beside them（2330: 41.01 against 40.94）, and a reader who checks with a
             calculator should find the reason on the page instead of finding a contradiction. -->
        <p class="stock-answer stock-dupont-page__rounding">
          畫面上每個數字都四捨五入到小數點後兩位，方便閱讀。五個數字連乘會把這些微小的差距放大，所以自己按計算機乘出來，可能和上面的 ROE 差個零點零幾，那是進位造成的，不是哪一邊算錯。
        </p>

        <p class="stock-answer stock-dupont-page__links">
          其中幾項各自的定義、限制與逐期數據：
          <NuxtLink :to="`/stock/${code}/roe`">股東權益報酬率</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/net-profit-margin`">稅後淨利率</NuxtLink>。
          本業獲利的上游拆解見<NuxtLink :to="`/stock/${code}/margins`">財報三率</NuxtLink>，
          槓桿的另一面見<NuxtLink :to="`/stock/${code}/solvency`">安全韌性的組成</NuxtLink>。
          原始金額見<NuxtLink :to="`/stock/${code}/income-statement`">損益表</NuxtLink>與<NuxtLink :to="`/stock/${code}/balance-sheet`">資產負債表</NuxtLink>。
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="historyAnswer" id="stock-dupont-history" :question="`${stockShortName}的杜邦五項歷年變化如何？`" :answer="historyAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的杜邦五項逐期數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 逐期的杜邦五項拆解（近四季，由新到舊）</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">稅務負擔</th>
                <th scope="col">利息負擔</th>
                <th scope="col">EBIT 利潤率</th>
                <th scope="col">資產週轉率</th>
                <th scope="col">權益乘數</th>
                <th scope="col">ROE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in periods" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
                <th scope="row">{{ periodLabel(entry) }}</th>
                <td>{{ rateText(entry.values.dupontTaxBurden?.value ?? null) }}</td>
                <td>{{ rateText(entry.values.dupontInterestBurden?.value ?? null) }}</td>
                <td>{{ rateText(entry.values.dupontEbitMargin?.value ?? null) }}</td>
                <td>{{ timesText(entry.values.assetTurnover?.value ?? null) }}</td>
                <td>{{ multipleText(entry.values.equityMultiplier?.value ?? null) }}</td>
                <td>{{ rateText(entry.values.roe?.value ?? null) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <StockQuestionSection id="stock-dupont-method" question="杜邦分析是什麼？" >
        <el-card shadow="never" class="stock-dupont-page__card">
          <p class="stock-dupont-page__line">
            杜邦分析把股東權益報酬率（ROE）拆成幾個可以分別觀察的部分，因為同樣的 ROE 可能來自完全不同的經營方式。
            名稱來自杜邦公司在 1920 年代發展出來的內部管理方法。
          </p>
          <p class="stock-dupont-page__line">
            這裡採五項版本。前三項相乘等於稅後淨利率，所以它也可以讀成常見的三項版本「淨利率 × 資產週轉率 × 權益乘數」。
          </p>
          <p class="stock-dupont-page__line">
            銀行、保險與金控沒有這組數字：資產週轉率要用「營收 ÷ 總資產」，而金融業的資產是放款與保單，不是用來生產營收的設備，這個比率對它們沒有意義。
          </p>
          <p v-if="dataSources.length" class="stock-dupont-page__line">資料來源：{{ dataSources.join('、') }}</p>
        </el-card>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-dupont-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-dupont-page__card {
  border-radius: 12px;
}

.stock-dupont-page__line {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.7;
}

.stock-dupont-page__line:last-child {
  margin-bottom: 0;
}

.stock-dupont-page__note,
.stock-dupont-page__links {
  margin-top: 12px;
}

.stock-dupont-page__rounding {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}
</style>
