<script setup lang="ts">
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'

// 「摘要層固定顯示、細節按需展開」的最小共用骨架 — 抽成元件 2026-09-15 per直接要求（"我希望卡片的
// 呈現方式可以收斂。避免每個卡片都長出自己的樣子。"）：這個展開/收合按鈕（含 aria-expanded、箭頭
// 圖示、hover 樣式）原本各自長在 SharedPercentileGaugeExpand.vue 跟每張新卡片裡，抽出來之後
// SharedPercentileGaugeExpand.vue 改成在自己的量尺視覺之上疊這個元件（見那個檔案自己的改動），
// 新的「標的比較卡」（如 StockBetaComparisonChart.vue 的股價 vs 加權指數走勢圖）直接用這個元件
// 包摘要數字＋展開後的完整圖表，不用重新刻一次按鈕。
//
// 兩個 slot：default（永遠顯示的摘要內容，例如量尺或兩個並列數字）、expanded（只有展開時才顯示
// 的細節內容，例如完整走勢圖）。不管 default slot 放什麼，都不是這個元件的責任 —
// 這個元件只負責「展開狀態」本身跟展開/收合的觸發 UI。
//
// 卡片軌元件選型規範 2.4.4：永遠不是彈窗，只是這張卡片自己往下長高；多張卡片可以同時展開，
// 彼此不需要協調（每個實例只管自己的 expanded 狀態）。
withDefaults(
  defineProps<{
    expanded: boolean
    expandLabel?: string
    collapseLabel?: string
  }>(),
  {
    expandLabel: '展開看詳情',
    collapseLabel: '收合'
  }
)

defineEmits<{
  'update:expanded': [value: boolean]
}>()
</script>

<template>
  <slot />

  <button type="button" class="expand-toggle" :aria-expanded="expanded" @click="$emit('update:expanded', !expanded)">
    {{ expanded ? collapseLabel : expandLabel }}
    <el-icon><component :is="expanded ? ArrowUp : ArrowDown" /></el-icon>
  </button>

  <template v-if="expanded">
    <slot name="expanded" />
  </template>
</template>

<style scoped>
.expand-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
  background: transparent;
  font-size: 15px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.expand-toggle:hover {
  background: var(--el-fill-color-light);
}
</style>
