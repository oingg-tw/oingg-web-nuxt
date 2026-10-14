<script setup lang="ts">
import type { CustomPeriodRange } from '~/composables/stock/useCustomPeriodRange'
// 圖表期間的範圍滑桿（2026-10-14，使用者：「客製化時間操作那邊有點不順」，選了範圍滑桿）。邏輯與理由在 useCustomPeriodRange；
// 這裡只負責畫：刻度是這檔真的有的期別，每年第一期標年份。
//
// 無障礙：el-slider 的把手是 role="slider"，方向鍵／Home／End／PageUp／PageDown 都能調；兩個把手各有名字，aria-valuetext
// 念期別而不是索引數字。把手 28px（WCAG 2.5.8 的點擊目標 ≥ 24px）。
//
// ClientOnly：跟 SharedLookbackWindowSelect 同一個理由——Element 的 useId 計數器在伺服器與瀏覽器順序不同，hydration 會對不上。
// 伺服器先放同高的佔位。
const props = defineProps<{ period: CustomPeriodRange }>()
// 右上角選「自訂區間…」才出現（2026-10-14，使用者：「希望滑桿是在右上角選擇自訂時間區間再出現」）；兩點以下沒有東西可以選
const keys = computed(() => props.period.keys.value)
const visible = computed(() => props.period.active.value && keys.value.length > 2)
const range = computed({ get: () => props.period.range.value, set: (value: [number, number]) => { props.period.range.value = value } })

// 375 寬時年份標籤大約只排得下 6 個，超過就每隔幾年標一次
const MAX_MARKS = 6
const marks = computed(() => {
  const firstOfYear = keys.value.flatMap((key, index) => (index === 0 || key.slice(0, 4) !== keys.value[index - 1]!.slice(0, 4) ? [index] : []))
  const every = Math.ceil(firstOfYear.length / MAX_MARKS)
  const kept = firstOfYear.filter((_, i) => i % every === 0)
  // 開頭那一年只有一兩期時（2021 Q4 起算），「2021」會跟「2022」疊在一起：離下一個刻度不到平均間距的 3/4 就拿掉第一個（2330 杜邦 20 季從 2021 Q3 起算，375 寬實測會疊）
  if (kept.length > 2 && kept[1]! - kept[0]! < (keys.value.length / kept.length) * 0.75) kept.shift()
  return Object.fromEntries(kept.map(index => [index, keys.value[index]!.slice(0, 4)]))
})
const labelAt = (index: number) => props.period.labelOf(keys.value[index] ?? '')
</script>

<template>
  <div v-if="visible" class="shared-period-range-slider">
    <ClientOnly>
      <el-slider
        v-model="range"
        range
        :min="0"
        :max="keys.length - 1"
        :step="1"
        :marks="marks"
        :format-tooltip="labelAt"
        :format-value-text="labelAt"
        range-start-label="開始期別"
        range-end-label="結束期別"
        class="shared-period-range-slider__slider"
      />
      <template #fallback>
        <div class="shared-period-range-slider__placeholder" />
      </template>
    </ClientOnly>
    <p v-if="period.summary.value" class="shared-period-range-slider__summary">{{ period.summary.value }}</p>
  </div>
</template>

<style scoped>
.shared-period-range-slider {
  margin-top: 8px;
  /* 左右留白讓第一個與最後一個年份標籤不貼邊、把手不被卡片切掉 */
  padding: 0 16px;
}

.shared-period-range-slider__slider {
  --el-slider-button-size: 28px;
}

/* 年份刻度：16px 下限（Element 預設 14px） */
.shared-period-range-slider__slider :deep(.el-slider__marks-text) {
  font-size: 1rem;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

/* 標籤在滑軌下方，要留出它的高度，否則摘要那一行會疊上去 */
.shared-period-range-slider__slider,
.shared-period-range-slider__placeholder {
  height: 32px;
  margin-bottom: 28px;
}

.shared-period-range-slider__summary {
  margin: 0;
  text-align: right;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
  word-break: keep-all;
}
</style>
