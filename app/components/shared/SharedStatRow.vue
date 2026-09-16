<script setup lang="ts">
// 卡片頂部的「摘要」列 — 抽成共用元件 2026-09-15 per直接要求（"這個所謂摘要，能統一呈現方式嗎？
// 我打算未來讓所有的卡片都比照"）：並列的 label-上/數字-下 統計格，用在圖表正上方，讓使用者
// 不用看圖就能先抓到幾個關鍵數字。目前已用在 StockPriceRevenueChart.vue（最新月營收／當月最後
// 收盤價）跟 StockBetaComparisonChart.vue（Beta 係數三個時間窗），往後任何卡片要在圖表上方放
// 幾個關鍵數字，都用這個元件，不要各自刻一份 label/value 的 CSS。
//
// 故意保持極簡（只有 label + value 兩層，沒有趨勢箭頭、沒有顏色語義、沒有次要說明文字）——這是
// 從兩次「摘要做得太複雜」的直接糾正學到的教訓（先是量尺+展開+基期揭露疊了太多層，被要求
// "必須簡化 打掉重練"）：這個元件只負責「排出一排 label/value」，數字怎麼算、要不要加註解、
// 需不需要點擊展開細節，全部留給呼叫端自己決定，不要把這些邏輯內建進來。
export interface StatItem {
  label: string
  value: string
}

defineProps<{
  stats: StatItem[]
}>()
</script>

<template>
  <div class="shared-stat-row">
    <div v-for="stat in stats" :key="stat.label" class="shared-stat-row__stat">
      <span class="shared-stat-row__label">{{ stat.label }}</span>
      <span class="shared-stat-row__value">{{ stat.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.shared-stat-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding: 4px 8px 8px;
}

.shared-stat-row__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 16px 是全站字級下限（見 feedback_16px_font_floor 記憶），這裡原本寫 14px 是真的違規——修正回
   跟全站一致的 16px（"要大於等於"，不是要嚴格大於 16px，用 16px 剛好卡在下限上）。 */
.shared-stat-row__label {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.shared-stat-row__value {
  font-size: 1.375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}
</style>
