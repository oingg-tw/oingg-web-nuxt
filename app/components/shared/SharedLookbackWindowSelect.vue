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
  <ClientOnly>
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
