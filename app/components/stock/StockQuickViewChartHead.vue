<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

// 指標速覽每張圖的標題列：名稱連到那一頁、後面接最新數值（2026-10-07「速覽 卡片 左上角的 後面 請放上數值」），右上角一顆 X 從
// 自選指標刪除（2026-10-23，使用者：「個股瀏覽的 shared-chart-card 右上角做一個 X 按下可以刪掉卡片與指標」）——跟下面表格的「刪除」
// 是同一件事，呼叫端接 removeRow（10 秒內可復原）。這一行原本在每一種圖的 #header 各寫一次，收成元件 X 才不會漏掉哪一種
defineProps<{ to: string; label: string; value: string }>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="quick-view-head">
    <h3 class="quick-view-head__title"><NuxtLink :to="to" class="hub-inline-link">{{ label }}</NuxtLink> <span class="quick-view-head__value">{{ value }}</span></h3>
    <button type="button" class="quick-view-head__remove" :aria-label="`從自選指標刪除 ${label}`" @click="emit('remove')">
      <el-icon aria-hidden="true"><Close /></el-icon>
    </button>
  </div>
</template>

<style scoped>
.quick-view-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-view-head__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 18px;
}

.quick-view-head__value {
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

/* 32px 見方，上下右往外推，不把標題列撐高（伺服器先畫的佔位卡也是這個元件，高度一樣）；觸控裝置 44px */
.quick-view-head__remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: -6px -8px -6px 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--el-text-color-secondary);
  font-size: 18px;
  cursor: pointer;
}

.quick-view-head__remove:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.quick-view-head__remove:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

@media (pointer: coarse) {
  .quick-view-head__remove {
    width: 44px;
    height: 44px;
    margin: -12px -14px -12px 0;
  }
}
</style>
