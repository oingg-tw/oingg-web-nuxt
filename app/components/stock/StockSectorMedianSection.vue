<script setup lang="ts">
import type { LineSeriesSpec, LineChartEntry } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { SectorMetricHistory } from '#shared/types/hub'
// 「跟同類股中位數比起來如何？」（2026-10-10，產業分析設計 #4）：指標頁與徽章頁共用。合規上允許的比較形式就是「這一檔 vs
// 類股中位數」，所以只陳述兩個數字、四分位範圍與家數，不寫高於／低於的評價詞，也不列成員公司。
// 版面照個股頁規則：一頁只有一張主圖，這裡的雙線圖收在預設關閉的 details 裡、排在表格前（先圖後表）。
// 類股成員是「今天的分類」（上游的定義），金融保險類的三率只有銀行、票券、產險等有值的公司，所以答句一律寫「有值的 N 家」。
const props = defineProps<{
  code: string
  shortName: string
  topic: string
  metricCode: string
  timeframe: MetricsHistoryTimeframe
  unit: string
  entries: MetricsHistoryEntry[]
  sector: SectorMetricHistory | null
}>()

const periodOf = (year: number, quarter: number | null) => (props.timeframe === 'FY' ? `${year} 年` : `${year} Q${quarter}`)
const text = (value: number | null) => (value === null ? '－' : `${value.toFixed(2)}${props.unit === '%' ? '%' : ` ${props.unit}`}`)

// 依年度／季別把個股值併到類股的每一期；類股那一期沒有中位數（全不適用或沒人有值）就不列
const rows = computed(() => {
  const own = new Map(props.entries.map(entry => [`${entry.fiscalYear}-${entry.fiscalQuarter}`, entry.values[props.metricCode]?.value ?? null]))
  return (props.sector?.entries ?? [])
    .filter(entry => entry.median !== null)
    .map(entry => ({ ...entry, period: periodOf(entry.fiscalYear, entry.fiscalQuarter), self: own.get(`${entry.fiscalYear}-${entry.fiscalQuarter}`) ?? null }))
})
const latest = computed(() => [...rows.value].reverse().find(row => row.self !== null) ?? null)

const answer = computed(() => {
  const row = latest.value
  if (!row || !props.sector) return null
  const range = row.q1 !== null && row.q3 !== null ? `，中間一半的公司落在 ${text(row.q1)}～${text(row.q3)}` : ''
  return `${row.period}（${TIMEFRAME_LABELS[props.timeframe]}），${props.shortName}的${props.topic}為 ${text(row.self)}；同一期${props.sector.sectorName}有值的 ${row.count} 家公司，中位數是 ${text(row.median)}${range}。`
})

const chartEntries = computed<LineChartEntry[]>(() => rows.value.map(row => ({
  fiscalYear: row.fiscalYear,
  fiscalQuarter: props.timeframe === 'FY' ? null : row.fiscalQuarter,
  values: { self: { value: row.self }, median: { value: row.median } }
})))
const series = computed<LineSeriesSpec[]>(() => [
  { code: 'self', name: props.shortName, lineType: 'solid', symbol: 'circle' },
  { code: 'median', name: `${props.sector?.sectorName ?? '類股'}中位數`, lineType: 'dashed', symbol: 'triangle' }
])
// 表格新的在上，只列最近 8 期（完整走勢在圖裡）
const tableRows = computed(() => [...rows.value].reverse().slice(0, 8))
</script>

<template>
  <StockQuestionSection
    v-if="latest && sector"
    id="stock-sector-median"
    :question="`${shortName}的${topic}跟${sector.sectorName}中位數比起來如何？`"
    :answer="answer"
  >
    <details class="hub-details">
      <summary>看逐期走勢圖</summary>
      <StockMultiSeriesLineChart :entries="chartEntries" :series="series" palette="compare" :unit="unit" :format="text" />
    </details>
    <SharedTableScroll :label="`${shortName} ${code} 的${topic}與${sector.sectorName}中位數`">
      <table class="seo-table" data-ssr-table>
        <caption>{{ shortName }} {{ code }} 的{{ topic }}與{{ sector.sectorName }}中位數（{{ TIMEFRAME_LABELS[timeframe] }}）</caption>
        <thead>
          <tr>
            <th scope="col">期別</th>
            <th scope="col">{{ shortName }}</th>
            <th scope="col">類股中位數</th>
            <th scope="col">中間一半的範圍</th>
            <th scope="col">有值家數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.period">
            <th scope="row">{{ row.period }}</th>
            <td class="seo-table__num">{{ text(row.self) }}</td>
            <td class="seo-table__num">{{ text(row.median) }}</td>
            <td class="seo-table__num">{{ row.q1 !== null && row.q3 !== null ? `${text(row.q1)}～${text(row.q3)}` : '－' }}</td>
            <td class="seo-table__num">{{ row.count }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
  </StockQuestionSection>
</template>
