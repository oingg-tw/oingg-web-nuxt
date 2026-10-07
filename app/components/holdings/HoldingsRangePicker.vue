<script setup lang="ts">
// 持股各頁的「期間」選擇（報酬與大盤、已實現損益、績效統計、風險共用）。值存在 useHoldingsRange()，切頁不重設。
//
// 2026-10-07 改成兩個原生日期輸入＋快捷按鈕（使用者：「盤點所有 holdings 畫面，設計 mobile first 以及滿足 a11y」）。
// 原本的 el-date-picker daterange 輸入框寬 350px、下拉面板 756px，手機上整頁左右滑、面板根本用不了；快捷選項
// 是 14px、日期格 32×30px。原生 type="date" 在手機叫出系統的日期選擇器，桌機也有鍵盤可操作的輸入，兩個欄位
// 各有自己的標籤（原本兩格都被念成「期間」）。
//
// pending：頁面在載入這段期間的資料時傳 true。載入完成後由下面的 status 念出「已顯示 X～Y」，讓螢幕閱讀器
// 使用者知道換了期間之後資料已經更新（原本換期間後什麼都不念）。
const props = defineProps<{ pending?: boolean }>()

const range = useHoldingsRange()
const today = holdingsTaipeiDate()

// 起訖互相夾住：開始不晚於結束、結束不晚於今天。輸入不完整（瀏覽器給空字串）時不動既有的值。
const from = computed({
  get: () => range.value[0],
  set: (value: string) => { if (value && value <= range.value[1]) range.value = [value, range.value[1]] }
})
const to = computed({
  get: () => range.value[1],
  set: (value: string) => { if (value && value >= range.value[0] && value <= today) range.value = [range.value[0], value] }
})

// 台北日期字串往前推 N 個月（月底對不上時落在該月最後一天，例如 05-31 往前三個月是 02-28）
function monthsBefore(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(year, month - 1 - months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

const SHORTCUTS = [
  { label: '近三個月', start: () => monthsBefore(today, 3) },
  { label: '近一年', start: () => monthsBefore(today, 12) },
  { label: '今年以來', start: () => `${today.slice(0, 4)}-01-01` },
  { label: '近三年', start: () => monthsBefore(today, 36) }
]

const activeShortcut = computed(() => range.value[1] === today ? SHORTCUTS.find(item => item.start() === range.value[0])?.label ?? null : null)

const status = computed(() => (props.pending ? '' : `已顯示 ${range.value[0]}～${range.value[1]} 的資料`))
</script>

<template>
  <fieldset class="holdings-range">
    <legend class="holdings-range__legend">期間</legend>
    <div class="holdings-range__dates">
      <label class="holdings-range__field">
        <span>開始日期</span>
        <input v-model.lazy="from" type="date" class="holdings-range__input" :max="range[1]">
      </label>
      <label class="holdings-range__field">
        <span>結束日期</span>
        <input v-model.lazy="to" type="date" class="holdings-range__input" :min="range[0]" :max="today">
      </label>
    </div>
    <div class="holdings-range__shortcuts" role="group" aria-label="快速選擇期間">
      <button
        v-for="item in SHORTCUTS"
        :key="item.label"
        type="button"
        class="holdings-range__shortcut"
        :aria-pressed="activeShortcut === item.label"
        @click="range = [item.start(), today]"
      >
        {{ item.label }}
      </button>
    </div>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </fieldset>
</template>

<style scoped>
.holdings-range {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.holdings-range__legend {
  padding: 0;
  margin-bottom: 8px;
  font-weight: 600;
}

.holdings-range__dates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 12px;
  max-width: 420px;
}

.holdings-range__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-regular);
}

.holdings-range__input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  font-size: 1rem;
}

.holdings-range__shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.holdings-range__shortcut {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

/* 目前的期間剛好是某個快捷選項：實心底＋粗體，不只靠顏色 */
.holdings-range__shortcut[aria-pressed='true'] {
  border-color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
}
</style>
