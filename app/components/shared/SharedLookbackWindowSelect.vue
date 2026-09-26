<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'

// The lookback-window control shared by every stock-detail chart card — was six near-identical
// copies of a button-tab group, then a 近5年/近10年 dropdown, unified again 2026-09-14 to a
// 5-option 近1/2/3/5/8年 scale per direct request ("所有卡片的時間下拉選單統一 近 1 2 3 5 8年").
//
// `insufficientYears` marks the windows this symbol cannot fill. It used to DISABLE them, and
// stopped doing so 2026-09-25: a greyed-out option tells the reader nothing, least of all whether
// the limit is the company's own age or a gap on our side — which is exactly what retiree-01
// refused to buy blind（「你連年數都不給我看，那我就是在賭，我不賭」）. The option stays selectable
// and the CHART's own place explains the shortfall in both numbers, via
// lookbackShortfallText().
//
// Client-only since 2026-09-19 (company-health started SSR'ing all of its cards): el-select's
// SSR output carries Element Plus's counter-based `useId()` ids on the listbox <ul> and every
// option <li>, and those counters run in a different order on the client than on the server once
// ~19 of these hydrate on one page — 86 attribute mismatches on this exact control, measured
// live. Vue never rectifies attribute mismatches, so the DOM kept the server ids while the
// client's aria-activedescendant pointed at ids that didn't exist — a real screen-reader defect
// for keyboard users of the dropdown, not just console noise. Nothing about an SSR'd dropdown
// helps a crawler or a no-JS visitor (it's inert without JS anyway), so the server renders a
// same-size placeholder showing the current window's label and the real control mounts after
// hydration with client-generated, self-consistent ids.
// `customLabel` 讓呼叫端在固定區間之外多掛一個選項（2026-09-26「圖表左下角的自訂區間與右上角的區間
// 選擇 邏輯重疊了」）。四個呼叫端裡只有 StockMetricHistoryChartInteractive 有自訂區間的 UI，所以做成
// 選填而不是內建——其餘三個傳了也沒有東西可以打開。
//
// 選到它時發 `custom` 而不是 `update:modelValue`：它不是一個觀察期間，是「改用另一種方式選期間」，
// 混進同一個事件會逼每個呼叫端都去辨認一個哨兵值。
const props = defineProps<{
  modelValue: LookbackWindow
  insufficientYears?: number[]
  customLabel?: string
  // 自訂區間生效時，下拉要顯示它而不是停在某個固定區間上——否則畫面在講「近5年」而圖是自訂的。
  customActive?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: LookbackWindow]
  custom: []
}>()

const CUSTOM = '__custom__'
const selected = computed(() => (props.customActive ? CUSTOM : props.modelValue))

const OPTIONS: { value: LookbackWindow; years: number }[] = LOOKBACK_YEARS.map(years => ({
  value: `近${years}年` as LookbackWindow,
  years
}))
</script>

<template>
  <ClientOnly>
    <el-select
      :model-value="selected"
      class="lookback-window-select"
      size="default"
      aria-label="觀察期間"
      @update:model-value="(value: string) => (value === CUSTOM ? $emit('custom') : $emit('update:modelValue', value as LookbackWindow))"
    >
      <el-option
        v-for="option in OPTIONS"
        :key="option.value"
        :label="insufficientYears?.includes(option.years) ? `${option.value}（資料不足）` : option.value"
        :value="option.value"
      />
      <el-option v-if="customLabel" :key="CUSTOM" :label="customLabel" :value="CUSTOM" />
    </el-select>
    <template #fallback>
      <span class="lookback-window-select lookback-window-select--placeholder">{{ modelValue }}</span>
    </template>
  </ClientOnly>
</template>

<style scoped>
.lookback-window-select {
  width: 130px;
}

/* Same box el-select draws at size="default" (32px tall, 1px border, 12px side padding), so the
   swap to the real control after hydration causes no layout shift. */
.lookback-window-select--placeholder {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  color: var(--el-text-color-regular);
  font-size: var(--el-font-size-base);
  line-height: 1;
  white-space: nowrap;
}
</style>
