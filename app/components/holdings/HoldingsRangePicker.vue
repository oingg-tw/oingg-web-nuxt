<script setup lang="ts">
// 持股各頁的「期間」選擇（報酬與大盤、已實現損益、績效統計、風險共用）。值存在 useHoldingsRange()，切頁不重設。
//
// 2026-10-19 改成一行（使用者：「holdings/risk 期間 這邊的 UI 佔用太多高度 請再設計」）：原本是標題、兩個上下各有標籤的日期欄、一排
// 四顆快捷鈕，桌機約 160px、手機將近 290px。比照圖表卡片的「觀察期間」（SharedChartCard）：一個選單列出快捷期間，最後一項
// 「自訂區間…」選了才在同一行出現兩個日期欄；選快捷期間時，旁邊一行小字寫出實際的起訖日期。
// 日期欄仍是原生 type="date"（2026-10-07 的理由：手機叫出系統的日期選擇器，桌機有鍵盤可操作的輸入）。
//
// pending：頁面在載入這段期間的資料時傳 true。載入完成後由下面的 status 念出「已顯示 X～Y」，讓螢幕閱讀器
// 使用者知道換了期間之後資料已經更新。
// days：這段期間用了幾個交易日（風險頁傳；業務中台 要求跟數字一起寫出，天數少時統計誤差大），寫在起訖日期後面。
const props = defineProps<{ pending?: boolean; days?: number }>()

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

// 「近一年」跟預設期間是同一支 holdingsLastYear（holdings-format.ts）：預設一打開一定是「近一年」
const SHORTCUTS = [
  { label: '近三個月', start: () => holdingsMonthsBefore(today, 3) },
  { label: '今年以來', start: () => `${today.slice(0, 4)}-01-01` },
  { label: '近一年', start: () => holdingsLastYear()[0] },
  { label: '近三年', start: () => holdingsMonthsBefore(today, 36) }
]
const CUSTOM = 'custom'

const activeShortcut = computed(() => range.value[1] === today ? SHORTCUTS.find(item => item.start() === range.value[0])?.label ?? null : null)
// 選了「自訂區間…」就留在自訂（就算日期剛好又等於某個快捷期間），直到再選快捷期間
const customChosen = ref(false)
const selected = computed(() => (customChosen.value || !activeShortcut.value ? CUSTOM : activeShortcut.value))
function select(value: string) {
  customChosen.value = value === CUSTOM
  const shortcut = SHORTCUTS.find(item => item.label === value)
  if (shortcut) range.value = [shortcut.start(), today]
}

const slash = (date: string) => date.replaceAll('-', '/')
const labelId = useId()
const status = computed(() => (props.pending ? '' : `已顯示 ${range.value[0]}～${range.value[1]} 的資料`))
</script>

<template>
  <div class="holdings-range" role="group" :aria-labelledby="labelId">
    <span :id="labelId" class="holdings-range__label">期間</span>
    <el-select :model-value="selected" class="holdings-range__select" aria-label="期間" @update:model-value="select">
      <el-option v-for="item in SHORTCUTS" :key="item.label" :label="item.label" :value="item.label" />
      <el-option label="自訂區間…" :value="CUSTOM" />
    </el-select>
    <span v-if="selected === CUSTOM" class="holdings-range__dates">
      <label class="holdings-range__field">從 <input v-model.lazy="from" type="date" class="holdings-range__input" :max="range[1]"></label>
      <label class="holdings-range__field">到 <input v-model.lazy="to" type="date" class="holdings-range__input" :min="range[0]" :max="today"></label>
    </span>
    <span v-else class="holdings-range__text">{{ slash(range[0]) }}～{{ slash(range[1]) }}</span>
    <span v-if="days" class="holdings-range__text">共 {{ days }} 個交易日</span>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.holdings-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.holdings-range__label {
  font-weight: 600;
}

.holdings-range__select {
  width: 140px;
}

.holdings-range__text {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.holdings-range__dates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.holdings-range__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular);
}

/* 高度跟旁邊的選單一樣：滑鼠 32px、觸控 44px（全站的 pointer: coarse 規則） */
.holdings-range__input {
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  font-size: 1rem;
}

@media (pointer: coarse) {
  .holdings-range__input {
    min-height: 44px;
  }
}
</style>
