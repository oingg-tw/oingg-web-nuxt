<script setup lang="ts">
import type { PerformanceOutcome, RealizedResult } from '~/composables/stock/useHoldings'
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'

// 持股的績效（2026-10-05）。使用者：「主動交易的績效也要呈現」「不依年度拆開，要讓用戶選擇日期回測特定
// 區間」「sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效，預設過去一年」。
//
// 兩段：與大盤比較（持股的時間加權報酬 vs 同期加權指數，GET /holdings/performance，bff-ts 0a8dcd9）、
// 期間的已實現損益（GET /holdings/realized，bff-ts e516d1e，包含已出清的代號）。兩段都不含息。
//
// 中性呈現：不排名、不慶祝、不寫「勝過／領先」這類比較字眼；損益用正負號與 ▲／▼，不只靠顏色。
//
// Personal page: out of the index, and out of the sitemap via nuxt.config's sitemap.exclude (/holdings/**).
useSeoMeta({ title: '交易績效', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { fetchRealized, fetchPerformance, transactions, loadTransactions } = useHoldings()
const config = useRuntimeConfig()
const { data: companies } = useCompanyIndex()
const { routeFor } = useStockSearch()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

// 預設近一年（使用者指定）。日期工具與快速選項跟風險頁共用（utils/holdings-format.ts）。
const range = ref<[string, string]>([holdingsTaipeiDate(-1), holdingsTaipeiDate()])
const shortcuts = HOLDINGS_RANGE_SHORTCUTS
const disabledFutureDate = holdingsIsFutureDate

const realized = ref<RealizedResult | null>(null)
const pending = ref(false)
const failed = ref(false)

async function loadRealized() {
  pending.value = true
  failed.value = false
  const result = await fetchRealized(range.value[0], range.value[1])
  pending.value = false
  realized.value = result
  failed.value = result === null
}

// ---- 與大盤比較 ----

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

// ---- 2026-10-07 的實際績效指標（使用者在 bff-ts 那邊：「請跟web核對 做投資組合指標的前端頁面」，本 session
// 確認「要，先出設計計畫」→「照做」）。全部用真實帳本算（不是回推），只陳述數字與定義、不評價、不分付費。
// null 的原因分開命名，邏輯與檢查在 utils/holdings-metrics.ts。
const report = computed(() => (performance.value?.ok && performance.value.result.twr !== null ? performance.value.result : null))

const annualizedText = computed(() => {
  const result = report.value
  if (!result) return ''
  if (result.annualized.twr === null) return periodUnderYear(result.from, result.to) ? `${UNDER_A_YEAR}，不換算年化。` : ''
  return `年化：時間加權 ${holdingsMetricText(result.annualized.twr, 'signedPct', '－', 2)}、資金加權 ${holdingsMetricText(result.annualized.mwr, 'signedPct', '－', 2)}。`
})

const comparisonRows = computed(() => {
  const result = report.value
  if (!result) return []
  const bc = result.benchmarkComparison
  const ra = result.riskAdjusted
  const captureMissing = firstReason(sampleShortfall(bc.sampleDays, COVARIANCE_MIN_DAYS))
  const adjustedMissing = firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS))
  return [
    { name: '上漲捕獲率', value: holdingsMetricText(bc.upCapture, 'pct', captureMissing), meaning: '大盤上漲的那些天，持股平均漲了大盤漲幅的幾成' },
    { name: '下跌捕獲率', value: holdingsMetricText(bc.downCapture, 'pct', captureMissing), meaning: '大盤下跌的那些天，持股平均跌了大盤跌幅的幾成' },
    { name: 'Omega', value: holdingsMetricText(bc.omega, 'ratio', captureMissing), meaning: '賺錢那些天的報酬總和 ÷ 賠錢那些天的報酬總和' },
    { name: 'Beta（實際）', value: holdingsMetricText(ra.beta, 'ratio', adjustedMissing), meaning: '用實際每日報酬算：大盤漲跌 1% 時，持股平均跟著漲跌幾 %。跟「風險」頁用現在持股回推的 Beta 不同' },
    { name: 'Jensen α（年化）', value: holdingsMetricText(ra.jensenAlpha, 'signedPct', adjustedMissing), meaning: '扣掉 Beta 與無風險利率能解釋的部分之後，每年多出或少掉的報酬' },
    { name: '追蹤誤差（年化）', value: holdingsMetricText(ra.trackingError, 'pct', adjustedMissing), meaning: '持股與大盤每天報酬差距的波動，換算成一年' },
    { name: '資訊比率', value: holdingsMetricText(ra.informationRatio, 'ratio', adjustedMissing), meaning: '每年相對大盤的超額報酬 ÷ 追蹤誤差' },
    { name: 'M²（年化）', value: holdingsMetricText(ra.m2, 'signedPct', adjustedMissing), meaning: '把持股的波動調成跟大盤一樣時的年化報酬，跟大盤的年化報酬是同一個尺度' }
  ]
})

const adjustedRows = computed(() => {
  const result = report.value
  if (!result) return []
  const ra = result.riskAdjusted
  const missing = firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS))
  const calmarMissing = firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS), periodUnderYear(result.from, result.to) && UNDER_A_YEAR)
  return [
    { name: 'Sharpe', value: holdingsMetricText(ra.sharpe, 'ratio', missing), meaning: '（年化報酬 − 無風險利率）÷ 年化波動度' },
    { name: 'Sortino', value: holdingsMetricText(ra.sortino, 'ratio', missing), meaning: '跟 Sharpe 一樣，但分母只算下跌那一側的波動' },
    { name: 'Calmar', value: holdingsMetricText(ra.calmar, 'ratio', calmarMissing), meaning: '年化報酬 ÷ 期間內實際的最大跌幅' }
  ]
})

const tradingRows = computed(() => {
  const trading = report.value?.trading
  if (!trading) return []
  const noExposure = '期間內沒有持股'
  return [
    { name: '買進金額', value: holdingsMetricText(trading.buyAmount, 'money'), meaning: '期間內實際成交的買進（不含配股與成本不明的取得）' },
    { name: '賣出金額', value: holdingsMetricText(trading.sellAmount, 'money'), meaning: '期間內實際成交的賣出' },
    { name: '手續費', value: holdingsMetricText(trading.fees, 'money'), meaning: '買進與賣出的券商手續費' },
    { name: '證交稅', value: holdingsMetricText(trading.taxes, 'money'), meaning: '賣出時的證券交易稅' },
    { name: '週轉率', value: holdingsMetricText(trading.turnover, 'pct', noExposure, 2), meaning: '買進與賣出較小的那一個 ÷ 平均市值，整段期間、不年化' },
    { name: '成本率', value: holdingsMetricText(trading.costRatio, 'pct', noExposure, 2), meaning: '（手續費＋證交稅）÷ 平均市值，整段期間、不年化' }
  ]
})

function pctAxis(value: number | null): string {
  return value === null ? '－' : `${value.toFixed(2)}%`
}

watch([authResolved, () => currentUser.value?.uid, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) {
    loadRealized()
    loadPerformance()
  } else {
    realized.value = null
    performance.value = null
  }
}, { immediate: true })

const rows = computed(() => (realized.value?.symbols ?? []).map((row) => {
  const entry = companyByCode.value.get(row.symbol)
  return {
    symbol: row.symbol,
    name: entry?.name ?? row.symbol,
    link: entry ? routeFor(entry) : `/stock/${row.symbol}`,
    value: Number(row.realizedProfitLoss)
  }
}))
type RealizedRow = (typeof rows.value)[number]

// 每一檔可以展開看交易紀錄（賣出價格、組成持倉的買進）。可以同時展開好幾檔；開關是真正的按鈕，
// el-table 自己的展開箭頭不能聚焦，所以那一欄用 CSS 藏起來（同 holdings/index.vue）。
const expanded = ref<string[]>([])

function toggleDetail(symbol: string) {
  if (expanded.value.includes(symbol)) {
    expanded.value = expanded.value.filter(item => item !== symbol)
    return
  }
  expanded.value = [...expanded.value, symbol]
  loadTransactions(symbol)
}

function rowLabelFor(row: RealizedRow) {
  return (symbol: string) => `${row.name} ${symbol}`
}

const total = computed(() => (realized.value ? Number(realized.value.totalRealizedProfitLoss) : null))

function directionClass(value: number | null): string {
  return priceDirectionClass(value === null ? null : Math.round(value))
}
</script>

<template>
  <div class="performance-page">
    <div class="performance-page__heading">
      <h1 class="performance-page__title">交易績效</h1>
      <p class="performance-page__subtitle">選一段期間，看持股報酬率與同期加權指數，以及這段期間賣出的已實現損益</p>
    </div>

    <HoldingsNav />

    <div v-if="!mounted || !authResolved" v-loading="true" class="performance-page__placeholder" />

    <section v-else-if="!currentUser" class="performance-guest">
      <h2 class="performance-guest__title">登入後查看你的交易績效</h2>
      <p class="performance-guest__text">持股與交易資料存在你的帳號裡，只有你看得到。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <template v-else>
      <div class="performance-range">
        <span id="performance-range-label" class="performance-range__label">期間</span>
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          format="YYYY/MM/DD"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
          range-separator="～"
          unlink-panels
          :clearable="false"
          :shortcuts="shortcuts"
          :disabled-date="disabledFutureDate"
          aria-labelledby="performance-range-label"
          size="large"
        />
      </div>

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
                <dt>你的持股<template v-if="comparison?.start && comparison.start > range[0]">（{{ comparison.start }} 起）</template></dt>
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
            />

            <p v-if="annualizedText" class="performance-page__note">{{ annualizedText }}</p>

            <p class="performance-page__footnote">
              時間加權報酬是選股本身的報酬，資金加權報酬是你的錢實際賺了多少，兩者的差距來自進出場時機。持股報酬率是時間加權報酬：把每天的漲跌連乘起來，排除「什麼時候投入多少錢」的影響，才能跟指數放在同一把尺上比。不含股利，對照的加權指數也是不含股利的價格指數。
            </p>
          </template>
        </template>
      </section>

      <template v-if="report">
        <section aria-labelledby="performance-relative-title">
          <h2 id="performance-relative-title" class="performance-page__section-title">相對大盤的統計</h2>
          <p class="performance-page__note">用實際的每日報酬跟加權指數逐日比對，依 {{ report.benchmarkComparison.sampleDays }} 個交易日計算。</p>
          <HoldingsMetricTable caption="持股相對加權指數的統計" :rows="comparisonRows" value-label="數值" />
        </section>

        <section aria-labelledby="performance-adjusted-title">
          <h2 id="performance-adjusted-title" class="performance-page__section-title">風險調整後報酬</h2>
          <p class="performance-page__note">
            依 {{ report.riskAdjusted.sampleDays }} 個交易日計算，全部年化。<template v-if="riskFreeLine(report.riskFree)">{{ riskFreeLine(report.riskFree) }}。</template>
          </p>
          <HoldingsMetricTable caption="持股的風險調整後報酬" :rows="adjustedRows" value-label="數值" />
        </section>

        <section aria-labelledby="performance-trading-title">
          <h2 id="performance-trading-title" class="performance-page__section-title">交易成本</h2>
          <HoldingsMetricTable caption="期間內的交易與成本" :rows="tradingRows" value-label="數值" />
        </section>

        <p class="performance-page__footnote">以上數字只陳述這段期間的統計，不代表未來，也不構成任何買賣建議。</p>
      </template>

      <section aria-labelledby="performance-realized-title" v-loading="pending">
        <h2 id="performance-realized-title" class="performance-page__section-title">已實現損益</h2>

        <el-alert v-if="failed" type="error" :closable="false" show-icon title="已實現損益暫時無法載入">
          <el-button class="performance-page__retry" @click="loadRealized">重新載入</el-button>
        </el-alert>

        <template v-else-if="realized">
          <dl class="performance-total">
            <dt>{{ range[0] }}～{{ range[1] }} 合計</dt>
            <dd :class="directionClass(total)">{{ holdingsSignedMoney(total) }}</dd>
          </dl>

          <el-table class="performance-realized" :data="rows" row-key="symbol" :expand-row-keys="expanded">
            <template #empty>這段期間沒有賣出</template>
            <el-table-column type="expand" width="1" class-name="performance-expand-col" label-class-name="performance-expand-col">
              <template #default="{ row }">
                <HoldingsLedger
                  :entries="transactions[tableRow<RealizedRow>(row).symbol]"
                  :symbol-label="rowLabelFor(tableRow<RealizedRow>(row))"
                  readonly
                  :range="range"
                  @retry="loadTransactions(tableRow<RealizedRow>(row).symbol)"
                />
              </template>
            </el-table-column>
            <el-table-column label="股票" min-width="180">
              <template #default="{ row }">
                <NuxtLink :to="tableRow<RealizedRow>(row).link">{{ tableRow<RealizedRow>(row).name }}</NuxtLink>
                <span class="performance-page__code">{{ tableRow<RealizedRow>(row).symbol }}</span>
              </template>
            </el-table-column>
            <el-table-column label="已實現損益" align="right" min-width="140">
              <template #default="{ row }">
                <span :class="directionClass(tableRow<RealizedRow>(row).value)">{{ holdingsSignedMoney(tableRow<RealizedRow>(row).value) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="明細" min-width="110">
              <template #default="{ row }">
                <el-button
                  :aria-label="`${tableRow<RealizedRow>(row).name} ${tableRow<RealizedRow>(row).symbol} 的交易明細`"
                  :aria-expanded="expanded.includes(tableRow<RealizedRow>(row).symbol)"
                  class="performance-detail-button"
                  @click="toggleDetail(tableRow<RealizedRow>(row).symbol)"
                >
                  {{ expanded.includes(tableRow<RealizedRow>(row).symbol) ? '收合' : '明細' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <p v-if="realized.excludedSellCount" class="performance-page__note">
            另有 {{ realized.excludedSellCount }} 筆賣出、共 {{ groupThousands(realized.excludedShares) }} 股的取得成本不明，未計入損益。
          </p>
          <p class="performance-page__footnote">
            只計賣出日落在期間內的賣出，包含已經全部賣出的股票。成本以先進先出（跟券商相同）配對，期間開始前買進的股票也照實帶入成本；賣出的手續費與交易稅已扣除，不含股利。除權配股依除權息行事曆自動入帳。
          </p>
        </template>
      </section>
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

.performance-page__code {
  margin-left: 8px;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
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

.performance-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.performance-range__label {
  font-weight: 600;
}

.performance-realized :deep(.performance-expand-col .cell) {
  display: none;
}

.performance-detail-button {
  min-height: 44px;
}

.performance-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

@media (max-width: 767px) {
  .performance-compare {
    grid-template-columns: minmax(0, 1fr);
  }
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
