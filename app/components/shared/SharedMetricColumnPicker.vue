<script setup lang="ts">
// 從指標目錄挑一個欄位（2026-10-20，使用者：「holdings/columns 我要怎麼任意自行加上我要的指標 比如 ROE…能跟篩選那邊一樣可以
// 自由選擇嗎…抽成一個完整元件 讓 watchlist 也是走同樣邏輯」）。/watchlist 欄位設定的「＋ 新增欄位」與 /holdings/columns 的
// 「新增指標」共用（負責元件，見 CLAUDE.md）。裡面是篩選器同一個挑選器本體（搜尋＋分類→指標→期別），篩選器的條件面板也用它。
// 目錄自己讀；挑了就關掉，再把 field（例如 roe.TTM）與標籤（「股東權益報酬率（近四季）」）送出去。
// 重複與額度由各頁判斷：觀察清單照 field、自訂欄位照公式比對重複；額度一個是 watchlistColumns、一個是 customHoldingColumns。
// 取代 ScreenerIndicatorPicker：只有觀察清單在用，桌機錨定下拉那一半從沒用到，而且在渲染時依螢幕寬度選標記。
const open = defineModel<boolean>({ required: true })
defineProps<{ title: string }>()
const emit = defineEmits<{ select: [field: string, label: string] }>()

const { data: schema } = useFilterSchema()

function select(field: string, label: string) {
  open.value = false
  emit('select', field, label)
}
</script>

<template>
  <!-- 寬度寫在 CSS 的 --el-dialog-width、不用 width 屬性：屬性會變成行內樣式，手機滿版那條蓋不掉 -->
  <el-dialog v-model="open" :title="title" class="metric-column-picker" lock-scroll>
    <ScreenerIndicatorPickerBody v-loading="!schema.categories.length" :categories="schema.categories" :active="open" :hide-period="false" @select="select" />
  </el-dialog>
</template>

<style>
/* 不加 scoped：el-dialog teleport 到 body */
.el-dialog.metric-column-picker {
  --el-dialog-width: min(960px, 92vw);
}

.metric-column-picker .el-dialog__body {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

/* 桌機：拿掉本體的 720px 上限，每一欄 9.5 列 */
@media (min-width: 768px) {
  .el-dialog.metric-column-picker .indicator-dialog {
    max-width: none;
    --indicator-rows: 9.5;
  }
}

/* 手機滿版：外框固定是整個畫面，換分類、搜尋結果變少都不會讓它跳動，只有裡面固定高度的清單捲動。取消全站的 85vh 上限 */
@media (max-width: 767px) {
  .el-dialog.metric-column-picker {
    --el-dialog-width: 100%;
    height: 100%;
    max-height: none;
    margin: 0;
    border-radius: 0;
  }
}
</style>
