<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { MarginMonth } from '#shared/utils/trading-flows'

// 信用交易頁的圖（2026-11-24）：每月月底一點。餘額是柱子（張，左軸），比率是線（%，右軸），同月營收頁「金額柱、比率線」的畫法。
// 借券賣出餘額只有柱子（只有上櫃有）。近N年與自訂區間在 SharedChartCard＋useChartPeriod
const props = defineProps<{ kind: 'margin' | 'short' | 'sbl'; months: MarginMonth[] }>()

type MarginKey = 'marginBalanceLots' | 'marginUtilizationRate' | 'shortBalanceLots' | 'shortToMarginRatio' | 'sblShortBalanceLots'
const SPECS: Record<'margin' | 'short' | 'sbl', { bar: [MarginKey, string]; line: [MarginKey, string] | null }> = {
  margin: { bar: ['marginBalanceLots', '融資餘額'], line: ['marginUtilizationRate', '融資使用率'] },
  short: { bar: ['shortBalanceLots', '融券餘額'], line: ['shortToMarginRatio', '券資比'] },
  sbl: { bar: ['sblShortBalanceLots', '借券賣出餘額'], line: null }
}
const spec = computed(() => SPECS[props.kind])
const lots = (value: number | null) => (value === null ? '－' : `${lotsNumber(value)} 張`)

// 頭尾沒有餘額的月份不畫（不在名單上的那幾個月），中間的留空白
const plotted = computed(() => trimEmptyEnds(props.months, month => month[spec.value.bar[0]] != null)
  .map(month => ({ label: month.month, values: { bar: { value: month[spec.value.bar[0]] }, line: { value: spec.value.line ? month[spec.value.line[0]] : null } } })))
const series = computed<LineSeriesSpec[]>(() => [
  { code: 'bar', name: spec.value.bar[1], type: 'bar', lineType: 'solid', symbol: 'rect', format: lots },
  ...(spec.value.line ? [{ code: 'line', name: spec.value.line[1], axis: 'right' as const, lineType: 'solid' as const, symbol: 'circle' as const, format: ratePct }] : [])
])
const { period, shown } = useChartPeriod({ all: plotted, keyOf: entry => entry.label, perYear: 12 })
</script>

<template>
  <SharedChartCard v-if="plotted.length" :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart :entries="shown" :series="series" palette="accent" unit="張" :format="lots" :unit-right="spec.line ? '%' : undefined" />
  </SharedChartCard>
</template>
