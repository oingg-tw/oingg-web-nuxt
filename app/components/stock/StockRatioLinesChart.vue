<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
// 財報三率（/margins）與安全韌性（/solvency）的比率折線圖卡（2026-10-16 從兩頁抽出：指標速覽要畫同一張，「指標速覽沒有顯示所有的
// 指標圖」）。外殼、近N年與自訂區間在 SharedChartCard＋useChartPeriod，區間是這張圖自己的，只切圖、不切頁面上的表。
const props = defineProps<{
  page: 'margins' | 'solvency'
  // 由舊到新，原樣傳進來
  entries: MetricsHistoryEntry[]
}>()

const RATES = [
  { code: 'grossMargin', name: '毛利率', lineType: 'solid', symbol: 'circle' },
  { code: 'operatingMargin', name: '營業利益率', lineType: 'dashed', symbol: 'triangle' },
  { code: 'netProfitMargin', name: '稅後淨利率', lineType: 'dotted', symbol: 'rect' }
] as const satisfies readonly LineSeriesSpec[]

// 三率拆成上下兩張圖（2026-09-30）。高齡友善的折線規格是一張圖最多兩條線，而使用者給的放行條件
// 是「只要不交集」——所以我去量了，而量出來的答案剛好把切點指定好了（抽 61 檔、912 期、近四季）：
//
//   營業利益率 > 毛利率      0 期（0.0%）    毛利減營業費用就是營業利益，不可能反過來
//   稅後淨利率 > 營業利益率  422 期（46.3%） 50/61 檔至少發生一次，業外收益一加就超車
//
// 所以不是「為了守規則硬拆」：上面那一對永遠不交叉、兩線之間的距離就是營業費用率；下面那一對
// 常常交叉、距離就是業外與稅。各自有單一的意義，比三條疊在一起清楚。
// /solvency 同一份量測是 1022 期 0 次交叉——流動⊇速動⊇現金是定義上的包含關係，所以那張維持三條線。
const CHARTS: Record<'margins' | 'solvency', readonly (readonly LineSeriesSpec[])[]> = {
  margins: [RATES.filter(s => s.code !== 'netProfitMargin'), RATES.filter(s => s.code !== 'grossMargin')],
  solvency: [[
    { code: 'currentRatio', name: '流動比率', lineType: 'solid', symbol: 'circle' },
    { code: 'quickRatio', name: '速動比率', lineType: 'dashed', symbol: 'triangle' },
    { code: 'cashRatio', name: '現金比率', lineType: 'dotted', symbol: 'rect' }
  ]]
}
const charts = computed(() => CHARTS[props.page])

// 一條線都沒有值的期別不畫：金融業會拿到 20 期全是 null（2891 實測）
const plotted = computed(() => props.entries.filter(entry => charts.value.some(chart => chart.some(series => entry.values[series.code]?.value != null))))
const { period, shown } = useChartPeriod({ all: plotted, keyOf: entry => `${entry.fiscalYear}Q${entry.fiscalQuarter}`, labelOf: key => key.replace('Q', ' Q') })

// 固定兩位小數（rateText，shared/utils/number-format.ts）：兩頁的表格要逐項加減對得起來
</script>

<template>
  <SharedChartCard :period="plotted.length ? period : undefined">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <template v-if="plotted.length">
      <StockMultiSeriesLineChart v-for="(series, index) in charts" :key="index" :entries="shown" :series="series" unit="%" :format="rateText" />
    </template>
    <p v-else class="stock-ratio-lines-chart__line">目前沒有這張圖的資料。</p>
  </SharedChartCard>
</template>

<style scoped>
.stock-ratio-lines-chart__line {
  margin: 0;
}
</style>
