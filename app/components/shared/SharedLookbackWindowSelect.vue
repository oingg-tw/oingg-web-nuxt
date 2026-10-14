<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import type { CustomPeriodRange } from '~/composables/stock/useCustomPeriodRange'

// The lookback-window control shared by every stock-detail chart card — was six near-identical
// copies of a button-tab group, then a 近5年/近10年 dropdown, unified again 2026-09-14 to a
// 5-option 近1/2/3/5/8年 scale per direct request ("所有卡片的時間下拉選單統一 近 1 2 3 5 8年").
//
// `insufficientYears` 是這一檔填不滿的視窗，**2026-09-30 起會 disabled**（直接指示）。理由與這件事
// 為什麼不再等於藏資訊，寫在 lookback-window.ts 的註解裡：年數現在印在圖的角落，而且呼叫端會用
// fitLookbackWindow() 自動收斂，讀者不會落在填不滿的視窗上。
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
// 最後一個選項永遠是「自訂區間…」，`period`（useCustomPeriodRange）是**必填**：有近N年的地方就一定有自訂區間，少接了 typecheck
// 會擋（2026-10-14，河流圖曾經只放了選單、沒有自訂，看不出來）。選到它就打開圖下方的滑桿（SharedPeriodRangeSlider）；選回某個
// 近N年就先收起滑桿再發 update:modelValue，所以呼叫端不用自己處理「離開自訂」。自訂生效時選單顯示它而不是停在某個近N年上——否則
// 角落寫「近5年」而圖畫的是自訂的那一段。
const props = defineProps<{
  modelValue: LookbackWindow
  insufficientYears?: number[]
  period: CustomPeriodRange
  // 這個選單有哪些區間，預設全站那組 1/2/3/5/8；月營收頁多一個 10（2026-10-11）
  years?: readonly number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LookbackWindow]
}>()

const CUSTOM = '__custom__'
const selected = computed(() => (props.period.active.value ? CUSTOM : props.modelValue))

function select(value: string) {
  if (value === CUSTOM) return props.period.start()
  props.period.stop()
  emit('update:modelValue', value as LookbackWindow)
}

const OPTIONS = computed(() => (props.years ?? LOOKBACK_YEARS).map(years => ({
  value: `近${years}年` as LookbackWindow,
  years
})))
</script>

<template>
  <ClientOnly>
    <el-select
      :model-value="selected"
      class="lookback-window-select"
      size="default"
      aria-label="觀察期間"
      @update:model-value="select"
    >
      <el-option
        v-for="option in OPTIONS"
        :key="option.value"
        :label="option.value"
        :value="option.value"
        :disabled="insufficientYears?.includes(option.years)"
      />
      <el-option :key="CUSTOM" :label="period.active.value ? '自訂區間' : '自訂區間…'" :value="CUSTOM" />
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
