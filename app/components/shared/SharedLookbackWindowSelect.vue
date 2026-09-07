<script setup lang="ts">
// The 近5年/近10年 lookback-window control shared by every stock-detail chart card
// (StockMetricHistoryChart.vue, StockValuationRiverChart.vue, StockDupontChart.vue,
// StockDupontExtendedChart.vue, StockShareCapitalChart.vue, StockRevenueChart.vue) — was six
// near-identical copies of a button-tab group, each with its own `__tabs`/`__tab` CSS. Per
// direct request ("近五年近十年 的選項請改為使用下拉式選單") replaced with one shared dropdown
// rather than reimplementing the same el-select markup six times.
//
// When 近10年 wouldn't show anything the 近5年 window doesn't already (the backend's own `total`
// says so), the OPTION stays selectable but its label gets a "（資料不足）" suffix instead of
// being disabled outright — an `el-select` option has no reliable per-item hover-tooltip across
// touch and desktop the way the old button's `title` attribute did, and a disabled option is a
// dead end with no explanation at all once revealed. The result is the same in the end
// (selecting it re-fetches the identical data), just explained inline instead of blocked.
defineProps<{
  modelValue: '近5年' | '近10年'
  tenYearInsufficient?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: '近5年' | '近10年']
}>()
</script>

<template>
  <el-select
    :model-value="modelValue"
    class="lookback-window-select"
    size="default"
    @update:model-value="(value: '近5年' | '近10年') => $emit('update:modelValue', value)"
  >
    <el-option label="近5年" value="近5年" />
    <el-option :label="tenYearInsufficient ? '近10年（資料不足）' : '近10年'" value="近10年" />
  </el-select>
</template>

<style scoped>
.lookback-window-select {
  width: 110px;
}
</style>
