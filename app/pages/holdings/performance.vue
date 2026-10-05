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
useSeoMeta({ title: '績效', robots: 'noindex, nofollow' })

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

// 交易日期以台北時間為準
function taipeiDate(offsetYears = 0): string {
  const now = new Date(Date.now() + 8 * 3600_000)
  now.setUTCFullYear(now.getUTCFullYear() + offsetYears)
  return now.toISOString().slice(0, 10)
}

// 預設近一年（使用者指定）
const range = ref<[string, string]>([taipeiDate(-1), taipeiDate()])

const shortcuts = [
  { text: '近三個月', value: () => { const end = new Date(); const start = new Date(); start.setMonth(start.getMonth() - 3); return [start, end] } },
  { text: '近一年', value: () => { const end = new Date(); const start = new Date(); start.setFullYear(start.getFullYear() - 1); return [start, end] } },
  { text: '今年以來', value: () => { const end = new Date(); return [new Date(end.getFullYear(), 0, 1), end] } },
  { text: '近三年', value: () => { const end = new Date(); const start = new Date(); start.setFullYear(start.getFullYear() - 3); return [start, end] } }
]

// el-date-picker 給的是本地午夜的 Date；用本地日期比，不要 toISOString（UTC+8 會倒退一天）。
function disabledFutureDate(date: Date): boolean {
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return local > taipeiDate()
}

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
      <h1 class="performance-page__title">績效</h1>
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

            <p class="performance-page__footnote">
              持股報酬率是時間加權報酬：把每天的漲跌連乘起來，排除「什麼時候投入多少錢」的影響，才能跟指數放在同一把尺上比。不含股利，對照的加權指數也是不含股利的價格指數。
            </p>
          </template>
        </template>
      </section>

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
