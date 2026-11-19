<script setup lang="ts">
import type { BookValueBreakdownEntry } from '#shared/types/stock-equity-composition'
// 每股淨值逐年變動的堆疊柱（2026-10-14 從 equity-source 頁抽出，使用者：拆頁後「一起開放」釘選——指標速覽畫得出圖才能釘）。
// 金額是元／股，已換算到目前的股數基準，逐年可以直接相比。六層的順序見 app/utils/book-value-flow.ts。
const props = defineProps<{ entries: BookValueBreakdownEntry[] }>()
// 近N年與自訂區間（2026-11-19，使用者：「要讓每個選項預設都有12358年喔」）：逐年的圖也有 1、2、3、5、8 年，同其他有時間軸的圖。
// entries 由舊到新，一年一筆
const { period, shown } = useChartPeriod({ all: computed(() => props.entries), keyOf: entry => String(entry.fiscalYear), perYear: 1 })
const layers = computed(() => bookValueFlowLayers(shown.value))
</script>

<template>
  <!-- 外殼在 SharedChartCard（個股頁的圖一律在卡片裡，2026-10-14）；指標速覽把標題傳進 #header -->
  <SharedChartCard :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockStackedBarChart
      :categories="shown.map(entry => String(entry.fiscalYear))"
      :layers="layers"
      :others="BOOK_VALUE_FLOW_OTHERS"
      unit="元／股"
      total-name="淨值變動"
      :tooltip-header="index => `${shown[index]?.fiscalYear} 年　${shown[index]?.openingBvps} → ${shown[index]?.closingBvps} 元`"
    />
  </SharedChartCard>
</template>
