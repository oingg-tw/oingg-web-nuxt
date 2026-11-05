<script setup lang="ts">
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { ReitPageResponse } from '#shared/types/screener-detail'
// REITs 每個面向的那一張圖（2026-10-30）：面向頁與速覽畫的是同一張（同 EtfFacetChart）。外殼是 SharedChartCard、時間軸接 useChartPeriod，
// 速覽把標題傳進 #header
const props = defineProps<{
  data: ReitPageResponse
  facet: 'nav' | 'distributions'
}>()

const yuan = (value: number | null) => reitYuan(value)
const perUnit = (value: number | null) => reitYuan(value, 4)

interface LineSpec { entries: LineChartEntry[]; series: LineSeriesSpec[]; format: (value: number | null) => string; perYear: number }
const spec = computed<LineSpec | null>(() => {
  if (props.facet === 'nav') {
    // 每月月底的收盤價與淨值：兩條線的距離就是折溢價
    const entries = (props.data.navMonths ?? []).map(month => ({ label: month.month, values: { close: { value: month.close }, nav: { value: month.nav } } }))
    return entries.length
      ? {
          entries,
          series: [
            { code: 'close', name: '收盤價', lineType: 'solid', symbol: 'circle', format: yuan },
            { code: 'nav', name: '每單位淨值', lineType: 'dashed', symbol: 'diamond', format: yuan }
          ],
          format: yuan,
          perYear: 12
        }
      : null
  }
  // 每次分配一根：一年幾根照近 12 個月實際分配的次數（近N年才是真的 N 年）
  const events = [...(props.data.distributions ?? [])].sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate))
  const entries = events.map(event => ({ label: event.exDividendDate, values: { value: { value: event.distributionPerUnit } } }))
  return entries.length
    ? {
        entries,
        series: [{ code: 'value', name: '每單位分配', type: 'bar', lineType: 'solid', symbol: 'rect', format: perUnit }],
        format: perUnit,
        perYear: Math.max(1, props.data.reit.trailing12MonthDistributionCount ?? 1)
      }
    : null
})
const entries = computed(() => spec.value?.entries ?? [])
const { period, shown } = useChartPeriod({ all: entries, keyOf: entry => entry.label ?? '', perYear: () => spec.value?.perYear ?? 1 })
</script>

<template>
  <SharedChartCard v-if="spec" :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart :entries="shown" :series="spec.series" palette="accent" unit="元" :format="spec.format" />
  </SharedChartCard>
</template>
