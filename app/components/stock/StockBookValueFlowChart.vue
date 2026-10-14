<script setup lang="ts">
import type { BookValueBreakdownEntry } from '#shared/types/stock-equity-composition'
// 每股淨值逐年變動的堆疊柱（2026-10-14 從 equity-source 頁抽出，使用者：拆頁後「一起開放」釘選——指標速覽畫得出圖才能釘）。
// 金額是元／股，已換算到目前的股數基準，逐年可以直接相比。六層的順序見 app/utils/book-value-flow.ts。
const props = defineProps<{ entries: BookValueBreakdownEntry[] }>()
const layers = computed(() => bookValueFlowLayers(props.entries))
</script>

<template>
  <StockStackedBarChart
    :categories="entries.map(entry => String(entry.fiscalYear))"
    :layers="layers"
    unit="元／股"
    :tooltip-header="index => `${entries[index]?.fiscalYear} 年　${entries[index]?.openingBvps} → ${entries[index]?.closingBvps} 元`"
  />
</template>
