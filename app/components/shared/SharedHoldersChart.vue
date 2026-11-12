<script setup lang="ts">
import type { ShareholdingDistribution } from '#shared/types/screener-detail'

// 持有人結構的圖（ETF 面向、個股 /holders、指標速覽共用，2026-11-12 從 EtfFacetChart 抽出）：每週一根堆疊柱，五組的集保比例
const props = defineProps<{ weeks: ShareholdingDistribution['weeks'] }>()
const { period, shown } = useChartPeriod({ all: computed(() => props.weeks), keyOf: week => week.dataDate, perYear: 52 })
const layers = computed(() => (shown.value[0]?.groups ?? []).map((group, index) => ({ name: group.name, values: shown.value.map(week => week.groups[index]?.custodyPct ?? 0) })))
</script>

<template>
  <SharedChartCard :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockStackedBarChart
      :categories="shown.map(week => week.dataDate)"
      :layers="layers"
      unit="%"
      total-name="合計"
      :value-formatter="value => `${value.toFixed(2)}%`"
      :tooltip-header="index => `${shown[index]?.dataDate} 集保股權分散`"
    />
  </SharedChartCard>
</template>
