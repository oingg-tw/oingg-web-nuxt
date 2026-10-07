<script setup lang="ts">
import type { PerformanceOutcome } from '~/composables/stock/useHoldings'
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'

// 報酬與大盤（2026-10-05 起的「交易績效」；使用者：「主動交易的績效也要呈現」「不依年度拆開，要讓用戶選擇日期回測
// 特定區間」「sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效，預設過去一年」）。
//
// 2026-10-07 拆頁（「performance 這一頁太亂了，請把指標拆去別的畫面」）：這頁只留「這段期間賺了多少、跟大盤比、
// 怎麼漲跌過來的」——與大盤比較、逐年與逐月報酬、跌幅與回到前高。已實現損益、賣出統計、交易成本搬到
// /holdings/realized；捕獲率、Beta、Sharpe 那些進階統計搬到 /holdings/statistics。路徑沒改（改名不改路徑）。
//
// 中性呈現：不排名、不慶祝、不寫「勝過／領先」這類比較字眼；報酬用正負號，不只靠顏色。
//
// Personal page: out of the index, and out of the sitemap via nuxt.config's sitemap.exclude (/holdings/**).
useSeoMeta({ title: '報酬與大盤', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { fetchPerformance } = useHoldings()
const config = useRuntimeConfig()

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const range = useHoldingsRange()
const performance = ref<PerformanceOutcome | null>(null)
const performancePending = ref(false)
// 加權指數日收盤（公開資料、這一頁抓一次）。2,100 筆約 8 年，等於個股日線的深度上限——
// 比那更早的期間 bff-ts 本來就會回 400。
const taiex = ref<Map<string, number> | null>(null)
const TAIEX_ROWS = 2100

async function loadPerformance() {
  performancePending.value = true
  const [outcome] = await Promise.all([
    fetchPerformance(range.value[0], range.value[1]),
    taiex.value
      ? null
      : $fetch<{ entries: { tradeDate: string; close: string | number }[] }>('/market/taiex-daily-price', {
          baseURL: config.public.apiBase,
          query: { interval: 'daily', limit: TAIEX_ROWS },
          timeout: BFF_REQUEST_TIMEOUT_MS
        })
          .then((response) => {
            taiex.value = new Map(response.entries.map(entry => [entry.tradeDate, Number(entry.close)] as const).filter(([, close]) => Number.isFinite(close)))
          })
          .catch(error => devWarn('holdings', 'GET /market/taiex-daily-price unavailable', error))
  ])
  performance.value = outcome
  performancePending.value = false
}

watch([authResolved, () => currentUser.value?.uid, range], ([resolved, uid]) => {
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

function directionClass(value: number | null): string {
  return priceDirectionClass(value === null ? null : Math.round(value * 10000))
}

// 全部用真實帳本算（不是回推）；null 的原因分開命名，邏輯與檢查在 utils/holdings-metrics.ts。
const report = computed(() => (performance.value?.ok && performance.value.result.twr !== null ? performance.value.result : null))

const annualizedText = computed(() => {
  const result = report.value
  if (!result) return ''
  if (result.annualized.twr === null) return periodUnderYear(result.from, result.to) ? `${UNDER_A_YEAR}，不換算年化。` : ''
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

const drawdownRows = computed(() => {
  const d = report.value?.drawdown
  if (!d) return []
  return [
    { name: '最大跌幅', value: holdingsMetricText(d.maxDrawdown, 'pct'), meaning: d.peakDate && d.troughDate ? `${d.peakDate} 高點 → ${d.troughDate} 低點，${d.recoveryDate ? `${d.recoveryDate} 回到前高` : '期間結束時尚未回到前高'}` : '期間內沒有下跌' },
    { name: '低於前高的天數', value: `${d.underwaterDays} 天`, meaning: '收盤低於前高的交易日合計' },
    { name: '最長連續低於前高', value: `${d.longestUnderwaterDays} 天`, meaning: '跌破前高到站回，最長的一段' },
    { name: '目前距前高', value: Number(d.currentDrawdown) === 0 ? '在前高' : holdingsMetricText(d.currentDrawdown, 'pct'), meaning: '期間最後一天距前高多遠' }
  ]
})
</script>

<template>
  <div class="performance-page">
    <div class="performance-page__heading">
      <h1 class="performance-page__title">報酬與大盤</h1>
      <p class="performance-page__subtitle">持股報酬與同期加權指數</p>
    </div>

    <HoldingsNav />

    <div v-if="!mounted || !authResolved" v-loading="true" class="performance-page__placeholder" />

    <section v-else-if="!currentUser" class="performance-guest">
      <h2 class="performance-guest__title">登入後查看你的報酬</h2>
      <p class="performance-guest__text">持股與交易資料存在你的帳號裡，只有你看得到。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <template v-else>
      <HoldingsRangePicker :pending="performancePending" />

      <section v-loading="performancePending" aria-labelledby="performance-compare-title">
        <h2 id="performance-compare-title" class="performance-page__section-title">與大盤比較</h2>

        <el-alert v-if="performance && !performance.ok" type="error" :closable="false" show-icon :title="performance.message">
          <el-button class="performance-page__retry" @click="loadPerformance">重新載入</el-button>
        </el-alert>

        <template v-else-if="performance?.ok">
          <p v-if="!comparison" class="performance-page__note">加權指數暫時無法取得，只顯示持股報酬率。</p>
          <p v-if="performance.result.twr === null" class="performance-page__note">這段期間沒有持股。</p>
          <template v-else>
            <dl class="performance-compare">
              <div class="performance-total">
                <dt>時間加權報酬<template v-if="comparison?.start && comparison.start > range[0]">（{{ comparison.start }} 起）</template></dt>
                <dd :class="directionClass(Number(performance.result.twr))">{{ holdingsSignedPct(Number(performance.result.twr)) }}</dd>
              </div>
              <div v-if="performance.result.mwr !== null" class="performance-total">
                <dt>資金加權報酬</dt>
                <dd>{{ holdingsMetricText(performance.result.mwr, 'signedPct', '－', 2) }}</dd>
              </div>
              <div v-if="comparison" class="performance-total">
                <dt>同期加權指數</dt>
                <dd :class="directionClass(comparison.benchmark)">{{ holdingsSignedPct(comparison.benchmark) }}</dd>
              </div>
            </dl>

            <StockMultiSeriesLineChart
              v-if="comparison?.entries.length"
              :entries="comparison.entries"
              :series="comparisonSeries"
              palette="accent"
              unit="%"
              :format="pctAxis"
              role="img"
              :aria-label="chartLabel"
            />

            <p v-if="annualizedText" class="performance-page__note">{{ annualizedText }}</p>

            <p class="performance-page__footnote">
              時間加權報酬看選股本身，資金加權報酬看你的錢實際賺多少（含進出場時機）；兩者與加權指數都不含股利。
            </p>
          </template>
        </template>
      </section>

      <template v-if="report">
        <section v-if="yearlyRows.length" aria-labelledby="performance-period-title">
          <h2 id="performance-period-title" class="performance-page__section-title">逐年與逐月報酬</h2>
          <HoldingsMetricTable caption="持股與加權指數的逐年報酬" :rows="yearlyRows" name-label="年度" value-label="你的持股" market-label="加權指數" meaning-label="交易日數" />
          <details v-if="monthlyRows.length" class="performance-page__details holdings-details">
            <summary>逐月報酬（{{ monthlyRows.length }} 個月）</summary>
            <HoldingsMetricTable caption="持股與加權指數的逐月報酬" :rows="monthlyRows" name-label="月份" value-label="你的持股" market-label="加權指數" meaning-label="交易日數" />
          </details>
        </section>

        <section aria-labelledby="performance-drawdown-title">
          <h2 id="performance-drawdown-title" class="performance-page__section-title">跌幅與回到前高</h2>
          <p class="performance-page__note">依實際帳本計算，與「風險」頁用現在持股回推的不同。</p>
          <HoldingsMetricTable caption="實際持股的跌幅" :rows="drawdownRows" value-label="數值" />
        </section>

      </template>
    </template>
  </div>
</template>

<style scoped>
.performance-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.performance-page__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.performance-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.performance-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.performance-page__placeholder {
  min-height: 200px;
}

.performance-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.performance-page__retry {
  margin-top: 8px;
}

.performance-page__details {
  margin-top: 12px;
}

.performance-page__footnote {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.performance-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.performance-guest__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.performance-guest__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.performance-compare {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 16px;
  margin: 0 0 16px;
}

.performance-compare .performance-total {
  margin: 0;
}

.performance-page__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.performance-total {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  margin: 0 0 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.performance-total dt {
  color: var(--el-text-color-regular);
}

.performance-total dd {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
