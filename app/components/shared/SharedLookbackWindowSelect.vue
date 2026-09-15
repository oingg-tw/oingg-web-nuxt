<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'

// The lookback-window control shared by every stock-detail chart card — was six near-identical
// copies of a button-tab group, then a 近5年/近10年 dropdown, unified again 2026-09-14 to a
// 5-option 近1/2/3/5/8年 scale per direct request ("所有卡片的時間下拉選單統一 近 1 2 3 5 8年").
//
// `disabledYears` replaces the old single `tenYearInsufficient` boolean — now that there are 5
// options instead of 2, "insufficient data" isn't a single yes/no, it's per-option (a symbol with
// 3 years of real history should disable 近5年/近8年 but keep 近1/2/3年 selectable). Each caller
// computes its own `disabledYears` (which of the 5 LOOKBACK_YEARS its own backend `total` can't
// actually fill) using app/utils/lookback-window.ts's LOOKBACK_YEARS/LOOKBACK_WINDOW_YEARS.
defineProps<{
  modelValue: LookbackWindow
  disabledYears?: number[]
}>()

defineEmits<{
  'update:modelValue': [value: LookbackWindow]
}>()

const OPTIONS: { value: LookbackWindow; years: number }[] = LOOKBACK_YEARS.map(years => ({
  value: `近${years}年` as LookbackWindow,
  years
}))
</script>

<template>
  <el-select
    :model-value="modelValue"
    class="lookback-window-select"
    size="default"
    @update:model-value="(value: LookbackWindow) => $emit('update:modelValue', value)"
  >
    <el-option
      v-for="option in OPTIONS"
      :key="option.value"
      :label="disabledYears?.includes(option.years) ? `${option.value}（資料不足）` : option.value"
      :value="option.value"
      :disabled="disabledYears?.includes(option.years)"
    />
  </el-select>
</template>

<style scoped>
.lookback-window-select {
  width: 130px;
}
</style>
