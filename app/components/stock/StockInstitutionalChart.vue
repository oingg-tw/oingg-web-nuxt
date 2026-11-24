<script setup lang="ts">
import type { InstitutionalMonth } from '#shared/utils/trading-flows'

// 三大法人頁的圖（2026-11-24）：每月買賣超的加總，外資、投信、自營商三層疊起來，賣超疊在零軸下面，合計線是三大法人合計。
// 手機一張圖最多兩條線，所以三類用堆疊柱，不畫三條線
const props = defineProps<{ months: InstitutionalMonth[] }>()
const { period, shown } = useChartPeriod({ all: computed(() => props.months), keyOf: month => month.month, perYear: 12 })
// 整個月沒有值的那一類畫成 0（表格寫「－」）
const layers = computed(() => ([['foreignNetBuyLots', '外資'], ['investmentTrustNetBuyLots', '投信'], ['dealerNetBuyLots', '自營商']] as const)
  .map(([key, name]) => ({ name, values: shown.value.map(month => Math.round(month[key] ?? 0)) })))
</script>

<template>
  <SharedChartCard :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockStackedBarChart
      :categories="shown.map(month => month.month)"
      :layers="layers"
      unit="張"
      total-name="三大法人合計"
      :value-formatter="value => signedLots(value)"
      :tooltip-header="index => `${shown[index]?.month}　合計${netBuyText(shown[index]?.totalNetBuyLots ?? null)}`"
    />
  </SharedChartCard>
</template>
