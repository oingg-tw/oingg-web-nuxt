<script setup lang="ts">
// 單一 ETF 的配息組成（2026-10-11，使用者選「請上游補欄位＋篩選器欄＋彈窗」；篩選器那一欄上游的使用者決定不做——
// 259 檔裡最近一次有揭露組成的只有 134 檔、收益平準金大於 0 的只有 7 檔，所以只放在這個逐檔彈窗）。
//
// 資料：GET /market/etf-distributions?symbol= 每個 event 的 composition（analysis-ts 0816fe84／業務中台 1d61683）。
// 規則照上游 schema：
//   - composition 為 null＝金額還沒公布；物件在但五項全 null＝金額公布了、組成還沒公告；有值才畫
//   - 單項 null＝未揭露，0＝揭露為 0；加總不保證 100%，差額寫「未揭露」，不併進「其他」
//   - 組成一律是投信預估值；distributionWarning 是投信自己的聲明原文，null 不代表組成是確定值
// conductor 規格（個股瀏覽／股東回饋.md）：只給 ETF、分組長條不堆疊。「收益平準金 >30% 警示」是觀察值不是標準，不做。
//
// 讀不到時在彈窗裡說明並給重試，不跳全站讀取失敗彈窗：那會在已開的對話框上再疊一個（記憶「不疊對話框」）。
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'

use([BarChart])

const props = defineProps<{ symbol: string | null; name: string }>()
const visible = defineModel<boolean>({ required: true })

interface Composition {
  dividendIncomePct: number | null
  interestIncomePct: number | null
  incomeEqualizationPct: number | null
  realizedCapitalGainPct: number | null
  otherIncomePct: number | null
}
interface DistributionEvent {
  exDividendDate: string
  distributionPerUnit: number | null
  composition: Composition | null
  distributionWarning: string | null
}
interface DistributionResponse {
  symbol: string
  events: DistributionEvent[]
}

// 收益平準金排第一、拿強調色：這個彈窗回答的就是「配息裡有多少是收益平準金」
const PARTS = [
  { key: 'incomeEqualizationPct', name: '收益平準金' },
  { key: 'dividendIncomePct', name: '股利所得' },
  { key: 'interestIncomePct', name: '利息所得' },
  { key: 'realizedCapitalGainPct', name: '已實現資本利得' },
  { key: 'otherIncomePct', name: '其他' }
] as const
type PartKey = (typeof PARTS)[number]['key']
// 圖只畫最近幾次有組成的配息：月配的 ETF 一年就有 12 次，五類並排 12 組在手機上讀不出來；完整的在表格
const CHART_EVENTS = 6

const data = shallowRef<DistributionResponse | null>(null)
const failure = shallowRef<unknown>(null)
const loading = ref(false)

async function load() {
  const symbol = props.symbol
  if (!symbol) return
  loading.value = true
  failure.value = null
  try {
    const response = await apiFetch<DistributionResponse>('/market/etf-distributions', { query: { symbol } })
    if (props.symbol === symbol) data.value = response
  } catch (error) {
    devWarn('etf-distributions', `GET /market/etf-distributions?symbol=${symbol} unavailable`, error)
    if (props.symbol === symbol) failure.value = error
  } finally {
    loading.value = false
  }
}

watch([visible, () => props.symbol], ([open, symbol], previous) => {
  if (!open || !symbol) return
  if (previous?.[1] !== symbol) data.value = null
  if (!data.value) load()
}, { immediate: true })

const hasValues = (composition: Composition | null) => !!composition && PARTS.some(part => composition[part.key] !== null)
const newestFirst = computed(() => [...(data.value?.events ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)))
const charted = computed(() => newestFirst.value.filter(event => hasValues(event.composition)).slice(0, CHART_EVENTS).reverse())
const latestWarning = computed(() => newestFirst.value.find(event => event.distributionWarning)?.distributionWarning ?? null)

const pct = (value: number | null) => (value === null ? '未揭露' : `${value.toFixed(2)}%`)
function undisclosed(composition: Composition): string {
  const sum = PARTS.reduce((total, part) => total + (composition[part.key] ?? 0), 0)
  const gap = 100 - sum
  return gap > 0.05 ? `${gap.toFixed(2)}%` : '－'
}
function stateText(event: DistributionEvent): string | null {
  if (event.composition === null) return '金額未公布'
  if (!hasValues(event.composition)) return '組成未公告'
  return null
}

const answer = computed(() => {
  const latest = newestFirst.value.find(event => hasValues(event.composition))
  if (!latest?.composition) return null
  const equalization = latest.composition.incomeEqualizationPct
  return `最近一次有公告組成的是 ${latest.exDividendDate} 除息的那一次：收益平準金 ${pct(equalization)}、股利所得 ${pct(latest.composition.dividendIncomePct)}、已實現資本利得 ${pct(latest.composition.realizedCapitalGainPct)}。比例是投信公告的預估值。`
})

const isDesktop = useIsDesktop()
const { resolvedMode, color: accentColorName } = useAppTheme()

const chartOption = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const layers = getStackLayerColors(resolvedMode.value)
  const colors = [accent, layers[1], layers[2], layers[3], layers[4]]
  return {
    // 手機的圖例會折成三行，留更多上方空間（2026-10-11 截圖量到圖例壓在 100 的刻度上）
    grid: { left: 8, right: 8, top: isDesktop.value ? 48 : 104, bottom: 8, containLabel: true },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', valueFormatter: (value: number | null) => pct(value ?? null) },
    xAxis: { type: 'category', data: charted.value.map(event => (isDesktop.value ? event.exDividendDate : event.exDividendDate.slice(2, 7))) },
    yAxis: { type: 'value', name: '%', max: 100 },
    series: PARTS.map((part, index) => ({
      name: part.name,
      type: 'bar',
      itemStyle: { color: colors[index] },
      data: charted.value.map(event => event.composition?.[part.key as PartKey] ?? null)
    }))
  }
})
</script>

<template>
  <el-dialog v-model="visible" width="min(760px, 94vw)" align-center append-to-body>
    <template #header="{ titleId, titleClass }">
      <h2 :id="titleId" :class="[titleClass, 'etf-distribution-dialog__title']">{{ name }}（{{ symbol }}）的配息組成</h2>
    </template>

    <div v-if="loading && !data" v-loading="true" class="etf-distribution-dialog__loading" />
    <div v-else-if="failure" class="etf-distribution-dialog__failure">
      <p>配息資料暫時讀不到。</p>
      <el-button @click="load">重新讀取</el-button>
    </div>
    <template v-else-if="data">
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <p v-else class="hub-answer">這檔 ETF 目前沒有公告過配息組成。</p>
      <SharedChart v-if="charted.length" class="app-chart etf-distribution-dialog__chart" :option="chartOption" autoresize :aria-label="`${name} 最近 ${charted.length} 次配息的組成比例分組長條圖`" />
      <SharedTableScroll :label="`${name} 歷次配息的組成`">
        <table class="seo-table">
          <caption>歷次配息的組成（投信公告的預估比例，新的在上；2023 年 2 月以前沒有組成資料）</caption>
          <thead>
            <tr>
              <th scope="col">除息日</th>
              <th scope="col">每單位配息（元）</th>
              <th v-for="part in PARTS" :key="part.key" scope="col">{{ part.name }}</th>
              <th scope="col">未揭露</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in newestFirst" :key="event.exDividendDate">
              <th scope="row">{{ event.exDividendDate }}</th>
              <td class="seo-table__num">{{ event.distributionPerUnit ?? '－' }}</td>
              <td v-if="stateText(event)" :colspan="PARTS.length + 1">{{ stateText(event) }}</td>
              <template v-else>
                <td v-for="part in PARTS" :key="part.key" class="seo-table__num">{{ pct(event.composition![part.key]) }}</td>
                <td class="seo-table__num">{{ undisclosed(event.composition!) }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <details v-if="latestWarning" class="hub-details">
        <summary>投信公告附註（原文）</summary>
        <blockquote class="etf-distribution-dialog__warning">{{ latestWarning }}</blockquote>
      </details>
    </template>
  </el-dialog>
</template>

<style scoped>
.etf-distribution-dialog__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.etf-distribution-dialog__loading {
  min-height: 12rem;
}

.etf-distribution-dialog__failure {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.etf-distribution-dialog__chart {
  height: 20rem;
}

.etf-distribution-dialog__warning {
  margin: 8px 0 0;
  padding-left: 12px;
  border-left: 3px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
