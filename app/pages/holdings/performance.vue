<script setup lang="ts">
import type { PerformanceOutcome } from '~/composables/holdings/holdings-model'
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'

// 報酬與大盤（2026-10-05 起的「交易績效」；使用者：「主動交易的績效也要呈現」「不依年度拆開，要讓用戶選擇日期回測
// 特定區間」「sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效，預設過去一年」）。
//
// 2026-10-07 拆頁（「performance 這一頁太亂了，請把指標拆去別的畫面」）：這頁只留「這段期間賺了多少、跟大盤比」——
// 與大盤比較、逐年與逐月報酬。已實現損益、賣出統計、交易成本搬到 /holdings/realized；捕獲率、Beta、Sharpe 那些進階統計
// 搬到 /holdings/statistics。路徑沒改（改名不改路徑）。原本的「跌幅與回到前高」2026-10-21 搬到風險頁第一段「你實際經歷過多大的
// 跌幅？」（跟回推的放在一起，讀者分得出哪個是經歷過的）。
//
// 中性呈現：不排名、不慶祝、不寫「勝過／領先」這類比較字眼；報酬用正負號，不只靠顏色。
//
// Personal page: out of the index, and out of the sitemap via nuxt.config's sitemap.exclude (/holdings/**).
useSeoMeta({ title: '報酬與大盤', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { fetchPerformance } = useHoldings()

const range = useHoldingsRange()
const performance = ref<PerformanceOutcome | null>(null)
const performancePending = ref(false)
// 加權指數日收盤（公開資料、這一頁抓一次）。2,100 筆約 8 年，等於個股日線的深度上限——
// 比那更早的期間 業務中台 本來就會回 400。
const taiex = ref<Map<string, number> | null>(null)
const TAIEX_ROWS = 2100
const taiexError = ref<unknown>(null)

// 讀取失敗交給全站彈窗（2026-10-11）；只有「開始日期早於歷史價格」這種可行動的失敗留在頁面上的提示框
watchLoadFailure('holdings-performance', () => (performance.value && !performance.value.ok ? performance.value.error ?? null : null), () => loadPerformance())

async function loadPerformance() {
  performancePending.value = true
  const [outcome] = await Promise.all([
    fetchPerformance(range.value[0], range.value[1]),
    taiex.value
      ? null
      : apiFetch<{ entries: { tradeDate: string; close: string | number }[] }>('/market/taiex-daily-price', { query: { interval: 'daily', limit: TAIEX_ROWS } })
          .then((response) => {
            taiexError.value = null
            taiex.value = new Map(response.entries.map(entry => [entry.tradeDate, Number(entry.close)] as const).filter(([, close]) => Number.isFinite(close)))
          })
          .catch((error) => {
            taiexError.value = error
            devWarn('holdings', 'GET /market/taiex-daily-price unavailable', error)
          })
  ])
  performance.value = outcome
  performancePending.value = false
}

// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08），畫面上不再各自出訊息
watchLoadFailure('holdings-taiex', () => taiexError.value, () => loadPerformance(), { scope: 'section' })

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadPerformance()
  else performance.value = null
}, { immediate: true })

// 對齊規則與它的檢查在 utils/holdings-summary.ts 的 compareWithBenchmark。
const comparison = computed(() => {
  const outcome = performance.value
  if (!outcome?.ok || !taiex.value) return null
  const result = compareWithBenchmark(outcome.result.series, taiex.value)
  const entries: LineChartEntry[] = result.points.map(point => ({
    label: point.date,
    values: {
      portfolio: { value: point.portfolio === null ? null : point.portfolio * 100 },
      taiex: { value: point.benchmark === null ? null : point.benchmark * 100 }
    }
  }))
  return { start: result.start, entries, benchmark: result.benchmark }
})

const comparisonSeries: LineSeriesSpec[] = [
  { code: 'portfolio', name: '你的持股', lineType: 'solid', symbol: 'circle', baseline: true },
  { code: 'taiex', name: '加權指數', lineType: 'dashed', symbol: 'triangle' }
]

// 走勢圖的可及名稱：期間與終點的兩個數字（2026-10-07 a11y 盤點：原本沒有 role 與名稱）。同期間的逐年、逐月數字
// 在下面的表格裡，圖不是唯一的資料路徑。
const chartLabel = computed(() => {
  const result = report.value
  if (!result) return ''
  const portfolio = holdingsMetricText(result.twr, 'signedPct', '－', 2)
  const benchmark = comparison.value ? holdingsSignedPct(comparison.value.benchmark) : '－'
  return `${result.from} 到 ${result.to} 的累積報酬走勢：你的持股 ${portfolio}，同期加權指數 ${benchmark}`
})

function pctAxis(value: number | null): string {
  return value === null ? '－' : `${value.toFixed(2)}%`
}


// 全部用真實帳本算（不是回推）；null 的原因分開命名，邏輯與檢查在 utils/holdings-metrics.ts。
const report = computed(() => (performance.value?.ok && performance.value.result.twr !== null ? performance.value.result : null))

// 同樣進出買大盤：影子組合賣超（endValue ≤ 0）時它的 mwr 是 null
const sameFlows = computed(() => report.value?.sameFlowsBenchmark ?? null)
const sameFlowsOversold = computed(() => !!sameFlows.value && Number(sameFlows.value.endValue) <= 0)
// 讀的時候（2026-10-20）：表格的列照樣列出、數值留空（HoldingsMetricTable loading），名稱與意思先出現；逐年的列數照上次
const firstLoad = computed(() => !performance.value)
const metricText = (...args: Parameters<typeof holdingsMetricText>) => (report.value ? holdingsMetricText(...args) : '')

const pairRows = computed(() => {
  const result = report.value
  if (!result && !firstLoad.value) return []
  const start = comparison.value?.start && comparison.value.start > range.value[0] ? `（${comparison.value.start} 起）` : ''
  return [
    { name: `時間加權報酬${start}`, value: metricText(result?.twr, 'signedPct', '－', 2), market: !result ? '' : comparison.value ? holdingsSignedPct(comparison.value.benchmark) : '－', meaning: '看選股；大盤是同一段期間' },
    { name: '資金加權報酬', value: metricText(result?.mwr, 'signedPct', '－', 2), market: metricText(sameFlows.value?.mwr, 'signedPct', '－', 2), meaning: '看實際的錢，含進出時機；大盤是同樣的錢、同樣的日子買賣' }
  ]
})

const annualizedText = computed(() => {
  const result = report.value
  if (!result) return ''
  // report 只在 twr 有值時存在，所以這裡 null 就是 業務中台 判定未滿一年（不自己用起訖日期重算，見績效統計的 calmarMissing）
  if (result.annualized.twr === null) return `${UNDER_A_YEAR}，不換算年化。`
  return `年化：時間加權 ${holdingsMetricText(result.annualized.twr, 'signedPct', '－', 2)}、資金加權 ${holdingsMetricText(result.annualized.mwr, 'signedPct', '－', 2)}。`
})

const periodRow = (row: { period: string; portfolio: string | null; benchmark: string | null; tradingDays: number }) => ({
  name: row.period,
  value: holdingsMetricText(row.portfolio, 'signedPct', '－', 2),
  market: holdingsMetricText(row.benchmark, 'signedPct', '－', 2),
  meaning: `${row.tradingDays} 天`
})
const yearlyRows = computed(() => (report.value?.periodReturns.yearly ?? []).map(periodRow))
const monthlyRows = computed(() => (report.value?.periodReturns.monthly ?? []).map(periodRow))
const yearCountHint = useLayoutHint('holdings-performance-years', 2)
watch(yearlyRows, (rows) => {
  if (report.value) yearCountHint.value = rows.length
})
const skeletonYearRows = computed(() => Array.from({ length: yearCountHint.value }, () => ({ skeleton: true, name: '2026', value: '+12.34%', market: '+12.34%', meaning: '240 天' })))

</script>

<template>
  <HoldingsPageShell title="報酬與大盤" subtitle="持股報酬與同期加權指數" guest-title="登入後查看你的報酬" guest-text="持股與交易資料存在你的帳號裡，只有你看得到。" :pending="performancePending && !performance">
    <template #default="{ loading }">

      <HoldingsRangePicker :pending="performancePending" />

      <!-- 遮罩只給換期間（內容已經在畫面上）；第一次讀的時候問句、表的名稱與意思、註腳照畫，數字與走勢圖是骨架（2026-10-20） -->
      <section v-loading="performancePending && !loading" aria-labelledby="performance-compare-title" :aria-busy="loading">
        <h2 id="performance-compare-title" class="performance-page__section-title">與大盤比較</h2>

        <el-alert v-if="performance && !performance.ok && !performance.error" type="error" :closable="false" show-icon :title="performance.message">
          <el-button @click="loadPerformance">重新載入</el-button>
        </el-alert>

        <template v-else-if="loading || performance?.ok">
          <p v-if="!loading && performance?.ok && performance.result.twr === null" class="performance-page__note">這段期間沒有持股。</p>
          <template v-else>
            <!-- 兩組配對（2026-10-16，使用者：「我畢竟有主動交易，這樣我的持股就不能很好拿來跟大盤比較」→「對我這樣進出，有沒有比
                 同樣時間買大盤好」）：時間加權報酬對同期加權指數（比選股）、資金加權報酬對同樣的錢在同樣的日子買賣加權指數（業務中台
                 5afaf57 的 sameFlowsBenchmark，比實際的錢）。原本三格卡片把資金加權報酬跟「期初買進抱到期末」的指數並排，口徑不同。
                 對照表跟下面逐年報酬同一個元件，中性色、不用漲跌色暗示好壞。
                 同日先放過一句答句「這樣進出，比同樣時間買賣大盤多／少 X 元」，使用者看到自己的數字：「這太傷心了請拿掉」——
                 不要把輸給大盤的金額寫成大字答句，只留表格裡的百分比 -->
            <HoldingsMetricTable class="performance-page__pairs" caption="你的持股與加權指數的報酬對照" :rows="pairRows" market-label="加權指數" meaning-label="比的是" :loading="loading" />

            <StockMultiSeriesLineChart
              v-if="loading || comparison?.entries.length"
              :loading="loading"
              :entries="comparison?.entries ?? []"
              :series="comparisonSeries"
              palette="accent"
              unit="%"
              :format="pctAxis"
              role="img"
              :aria-label="chartLabel"
            />

            <p v-if="loading || annualizedText" class="performance-page__note">
              <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">年化：時間加權 +12.34%、資金加權 +12.34%。</span>
              <template v-else>{{ annualizedText }}</template>
            </p>

            <p class="performance-page__footnote">
              大盤不扣交易成本，你的手續費與證交稅算在你這邊；兩邊都不含股利。<template v-if="!loading && sameFlowsOversold">你賣出的金額比同樣時間買大盤能拿回的還多，大盤那邊算不出資金加權報酬。</template>
            </p>
          </template>
        </template>
      </section>

      <template v-if="loading || report">
        <section v-if="loading ? yearCountHint : yearlyRows.length" aria-labelledby="performance-period-title" :aria-busy="loading">
          <h2 id="performance-period-title" class="performance-page__section-title">逐年與逐月報酬</h2>
          <HoldingsMetricTable caption="持股與加權指數的逐年報酬" :rows="loading ? skeletonYearRows : yearlyRows" :loading="loading" name-label="年度" value-label="你的持股" market-label="加權指數" meaning-label="交易日數" />
          <details v-if="loading || monthlyRows.length" class="performance-page__details holdings-details">
            <summary>逐月報酬<span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">（12 個月）</span><template v-else>（{{ monthlyRows.length }} 個月）</template></summary>
            <HoldingsMetricTable caption="持股與加權指數的逐月報酬" :rows="monthlyRows" name-label="月份" value-label="你的持股" market-label="加權指數" meaning-label="交易日數" />
          </details>
        </section>

      </template>
    </template>
  </HoldingsPageShell>
</template>

<style scoped>
.performance-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.performance-page__details {
  margin-top: 12px;
}

.performance-page__footnote {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.performance-page__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

/* 對照表與下面的走勢圖之間 */
.performance-page__pairs {
  margin-bottom: 16px;
}
</style>
