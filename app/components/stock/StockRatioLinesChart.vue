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

// 一張圖三條線。三率 2026-09-30 曾拆成上下兩張（高齡友善的折線規格一張圖最多兩條線），2026-10-24 合回一張（使用者：「三率的關係
// 正名 財報三率 並且 合併 三條線，也就是把圖表合併成一個」）。2026-09-30 抽 61 檔、912 期量過：營業利益率沒有一期高過毛利率
// （差距＝營業費用率）；稅後淨利率有 46.3% 的期別高過營業利益率，那兩條交叉的地方就是業外損益大過所得稅
const SERIES: Record<'margins' | 'solvency', readonly LineSeriesSpec[]> = {
  margins: [
    { code: 'grossMargin', name: '毛利率', lineType: 'solid', symbol: 'circle' },
    { code: 'operatingMargin', name: '營業利益率', lineType: 'dashed', symbol: 'triangle' },
    { code: 'netProfitMargin', name: '稅後淨利率', lineType: 'dotted', symbol: 'rect' }
  ],
  solvency: [
    { code: 'currentRatio', name: '流動比率', lineType: 'solid', symbol: 'circle' },
    { code: 'quickRatio', name: '速動比率', lineType: 'dashed', symbol: 'triangle' },
    { code: 'cashRatio', name: '現金比率', lineType: 'dotted', symbol: 'rect' }
  ]
}
const series = computed(() => SERIES[props.page])

// 一條線都沒有值的期別不畫：金融業會拿到 20 期全是 null（2891 實測）
const plotted = computed(() => props.entries.filter(entry => series.value.some(spec => entry.values[spec.code]?.value != null)))
const { period, shown } = useChartPeriod({ all: plotted, keyOf: entry => `${entry.fiscalYear}Q${entry.fiscalQuarter}`, labelOf: key => key.replace('Q', ' Q') })

// 固定兩位小數（rateText，shared/utils/number-format.ts）：兩頁的表格要逐項加減對得起來
</script>

<template>
  <SharedChartCard :period="plotted.length ? period : undefined">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart v-if="plotted.length" :entries="shown" :series="series" unit="%" :format="fixedRateText" />
    <p v-else class="stock-ratio-lines-chart__line">目前沒有這張圖的資料。</p>
  </SharedChartCard>
</template>

<style scoped>
.stock-ratio-lines-chart__line {
  margin: 0;
}
</style>
