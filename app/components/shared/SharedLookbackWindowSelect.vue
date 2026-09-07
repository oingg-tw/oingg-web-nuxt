<script setup lang="ts">
// The 近5年/近10年 lookback-window control shared by every stock-detail chart card
// (StockMetricHistoryChart.vue, StockValuationRiverChart.vue, StockDupontChart.vue,
// StockDupontExtendedChart.vue, StockShareCapitalChart.vue, StockRevenueChart.vue) — was six
// near-identical copies of a button-tab group, each with its own `__tabs`/`__tab` CSS. Per
// direct request ("近五年近十年 的選項請改為使用下拉式選單") replaced with one shared dropdown
// rather than reimplementing the same el-select markup six times.
//
// When 近10年 wouldn't show anything the 近5年 window doesn't already (the backend's own `total`
// says so), the option is disabled — per direct follow-up ("希望是改成 下拉選單選項disabled"),
// superseding an earlier attempt that kept it selectable with a "（資料不足）" label suffix
// instead (reasoned that a disabled option has no explanation once revealed; kept the label
// suffix anyway so a disabled, grayed-out option still says WHY instead of just refusing clicks).
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
    <el-option :label="tenYearInsufficient ? '近10年（資料不足）' : '近10年'" value="近10年" :disabled="tenYearInsufficient" />
  </el-select>
</template>

<style scoped>
.lookback-window-select {
  width: 110px;
}
</style>
