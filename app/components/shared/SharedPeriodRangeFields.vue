<script setup lang="ts">
// 自訂區間的「從／到」兩個下拉＋一行摘要（2026-10-14 從 StockMetricHistoryChartInteractive 抽出，邏輯在 useCustomPeriodRange）。
// 放在圖下方：它們需要橫向空間，右上角放不下，而且是「打開之後」的內容不是入口——入口是近N年選單裡的「自訂區間…」。
// 真的 <label>、說得出口的「從」「到」，沒有只有圖示的控制項（「畫面每一塊要能用嘴巴指」）。
defineProps<{
  keys: string[]
  toKeys: string[]
  // key → 顯示文字（'2024Q1' → '2024 Q1'）
  labelOf: (key: string) => string
  summary?: string | null
}>()
const from = defineModel<string | null>('from', { required: true })
const to = defineModel<string | null>('to', { required: true })
</script>

<template>
  <div class="shared-period-range-fields">
    <label class="shared-period-range-fields__field">
      <span>從</span>
      <el-select v-model="from" size="default" class="shared-period-range-fields__select">
        <el-option v-for="key in keys" :key="key" :label="labelOf(key)" :value="key" />
      </el-select>
    </label>
    <label class="shared-period-range-fields__field">
      <span>到</span>
      <el-select v-model="to" size="default" class="shared-period-range-fields__select">
        <el-option v-for="key in toKeys" :key="key" :label="labelOf(key)" :value="key" />
      </el-select>
    </label>
    <p v-if="summary" class="shared-period-range-fields__summary">{{ summary }}</p>
  </div>
</template>

<style scoped>
.shared-period-range-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.shared-period-range-fields__field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.shared-period-range-fields__select {
  width: 9.5em;
}

.shared-period-range-fields__summary {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

/* Phone: the two dropdowns stack instead of squeezing side by side. */
@media (max-width: 480px) {
  .shared-period-range-fields {
    flex-direction: column;
    align-items: stretch;
  }

  .shared-period-range-fields__select {
    width: 100%;
  }
}
</style>
