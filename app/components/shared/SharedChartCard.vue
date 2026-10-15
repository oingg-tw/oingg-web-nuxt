<script setup lang="ts">
import type { ChartPeriod } from '~/composables/stock/useChartPeriod'
import type { LookbackWindow } from '~/utils/lookback-window'
// 個股頁上「一張圖」唯一的外殼（2026-10-14）。卡片、控制列、近N年＋自訂區間選單、範圍滑桿都只寫在這裡；圖元件只負責畫。
//
// 為什麼收成一個元件：使用者兩次說「統一改」後仍然漏改（自訂區間漏了河流圖、四張組成圖沒包卡片），問「怎麼改可以不要漏掉？」、
// 「這種東西只能從架構上去優化，就算自動跑檢查抓到，也慢了」。原本卡片由頁面包、選單與滑桿由每張圖各自接，漏一處畫面上看不出來。
// 現在選單與滑桿不是獨立元件，沒有「有近N年卻沒自訂」或「圖不在卡片裡」的寫法；改這些規則就改這一個檔案。
//
// - 圖一律在卡片裡（2026-10-14 杜邦試過不放卡片，使用者：「效果不好，請把圖都放進卡片中」）。
// - 控制列在圖的上方、正常排版、靠右（原本有的圖 absolute 貼到外層卡片的角，外層少了 position: relative 時選單就跑到頁首底下）。
//   窄卡片（指標速覽的格子、手機）上控制項各自撐滿一列（2026-10-07「quick-view 請避免手機板跑版，以mobile first重新設計」），用
//   container query：看的是卡片寬度不是視窗。
// - 近N年選項：這一檔填不滿的停用（2026-09-30 直接指示）；最後一個永遠是「自訂區間…」，選了才在圖下方出現範圍滑桿（「希望滑桿是在
//   右上角選擇自訂時間區間再出現」），選回某個近N年就收起。狀態在 useChartPeriod。
// - 選單與滑桿只在瀏覽器裡掛（ClientOnly）：Element 的 useId 計數器在伺服器與瀏覽器順序不同，一頁十幾個時 aria-activedescendant
//   會指向不存在的 id（2026-09-19 實測 86 個屬性不一致）。伺服器先放同尺寸的佔位，不會跳版。
// - 滑桿：把手是 role="slider"，方向鍵／Home／End／PageUp／PageDown 都能調，兩個把手各有名字、aria-valuetext 念期別；把手 28px
//  （WCAG 2.5.8 ≥ 24px）；刻度與摘要 16px。
const props = defineProps<{ period?: ChartPeriod }>()

const CUSTOM = '__custom__'
const selected = computed(() => (props.period?.active.value ? CUSTOM : props.period?.window.value))
// 選項全站同一組 LOOKBACK_YEARS（1／2／3／5／8 年）＋自訂區間
const options = LOOKBACK_YEARS.map(years => ({ value: `近${years}年` as LookbackWindow, years }))
function select(value: string) {
  if (!props.period) return
  if (value === CUSTOM) props.period.start()
  else props.period.setWindow(value as LookbackWindow)
}

const keys = computed(() => props.period?.keys.value ?? [])
// 兩點以下沒有東西可以選
const sliderVisible = computed(() => !!props.period?.active.value && keys.value.length > 2)
const range = computed({
  get: () => props.period?.range.value ?? [0, 0],
  set: (value: [number, number]) => {
    if (props.period) props.period.range.value = value
  }
})
// 每年第一期標年份；375 寬大約排得下 6 個，超過就每隔幾年標一次
const MAX_MARKS = 6
const marks = computed(() => {
  const list = keys.value
  const firstOfYear = list.flatMap((key, index) => (index === 0 || key.slice(0, 4) !== list[index - 1]!.slice(0, 4) ? [index] : []))
  const every = Math.ceil(firstOfYear.length / MAX_MARKS)
  const kept = firstOfYear.filter((_, i) => i % every === 0)
  // 開頭那一年只有一兩期時「2021」會跟「2022」疊在一起：離下一個刻度不到平均間距的 3/4 就拿掉第一個（2330 杜邦 20 季從 2021 Q3
  // 起算，375 寬實測會疊）
  if (kept.length > 2 && kept[1]! - kept[0]! < (list.length / kept.length) * 0.75) kept.shift()
  return Object.fromEntries(kept.map(index => [index, list[index]!.slice(0, 4)]))
})
const labelAt = (index: number) => props.period?.labelOf(keys.value[index] ?? '') ?? ''
</script>

<template>
  <el-card shadow="never" class="shared-chart-card">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <div v-if="$slots.controls || period" class="shared-chart-card__controls">
      <slot name="controls" />
      <ClientOnly v-if="period">
        <el-select :model-value="selected" class="shared-chart-card__window" size="default" aria-label="觀察期間" @update:model-value="select">
          <el-option
            v-for="option in options"
            :key="option.value"
            :label="option.value"
            :value="option.value"
            :disabled="period.insufficientYears.value.includes(option.years)"
          />
          <el-option :key="CUSTOM" :label="period.active.value ? '自訂區間' : '自訂區間…'" :value="CUSTOM" />
        </el-select>
        <template #fallback>
          <span class="shared-chart-card__window shared-chart-card__window--placeholder">{{ period.window.value }}</span>
        </template>
      </ClientOnly>
    </div>
    <slot />
    <div v-if="sliderVisible && period" class="shared-chart-card__range">
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
          class="shared-chart-card__slider"
        />
        <template #fallback>
          <div class="shared-chart-card__slider" />
        </template>
      </ClientOnly>
      <p v-if="period.summary.value" class="shared-chart-card__summary">{{ period.summary.value }}</p>
    </div>
    <slot name="footer" />
  </el-card>
</template>

<style scoped>
.shared-chart-card {
  container-type: inline-size;
  min-width: 0;
  margin-bottom: 16px;
}

.shared-chart-card :deep(.el-card__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}

/* 窄卡片：期別切換與近N年各自撐滿一列，三顆期別等寬 */
.shared-chart-card__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.shared-chart-card__controls :deep(.el-radio-group) {
  display: flex;
  width: 100%;
}

.shared-chart-card__controls :deep(.el-radio-button) {
  flex: 1;
}

.shared-chart-card__controls :deep(.el-radio-button__inner) {
  width: 100%;
  justify-content: center;
}

.shared-chart-card__window {
  width: 100%;
}

/* 卡片夠寬：靠右排成一列 */
@container (min-width: 520px) {
  .shared-chart-card__controls {
    justify-content: flex-end;
  }

  .shared-chart-card__controls :deep(.el-radio-group) {
    display: inline-flex;
    width: auto;
  }

  .shared-chart-card__controls :deep(.el-radio-button) {
    flex: none;
  }

  .shared-chart-card__controls :deep(.el-radio-button__inner) {
    width: auto;
  }

  .shared-chart-card__window {
    width: 130px;
  }
}

/* el-select 在 size="default" 畫的同一個框（32px 高、1px 邊、左右 12px），掛上真的選單時不跳版 */
.shared-chart-card__window--placeholder {
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

.shared-chart-card__range {
  margin-top: 8px;
  /* 左右留白讓第一個與最後一個年份標籤不貼邊、把手不被卡片切掉 */
  padding: 0 16px;
}

/* 標籤在滑軌下方，要留出它的高度，否則摘要那一行會疊上去 */
.shared-chart-card__slider {
  --el-slider-button-size: 28px;
  height: 32px;
  margin-bottom: 28px;
}

.shared-chart-card__slider :deep(.el-slider__marks-text) {
  font-size: 1rem;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.shared-chart-card__summary {
  margin: 0;
  text-align: right;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
  word-break: keep-all;
}
</style>
