<script setup lang="ts">
// 排序圖示（2026-10-21，使用者：「排序的icon 請統一用兩個三角形 有排序的時候只呈現一個三角形 往上 或是往下 這個 icon的規範請整個專案
// 統一」）：沒排序是上下兩個三角形，排序中只剩那個方向的一個、主色。自己畫表頭的表格用這個（SharedSheetGrid、SharedSortableTable）；
// Element Plus 的表格（el-table）畫的是它自己的兩個三角形，同一套規則寫在 element-plus.css 的「排序箭頭」，大小、間距、顏色跟這裡一樣。
// 改樣子兩邊一起改。純裝飾：排序狀態由表頭的 aria-sort 告訴輔助科技
defineProps<{ state: 'ascending' | 'descending' | null }>()
</script>

<template>
  <span class="sort-icon" :class="state && `is-${state}`" aria-hidden="true">
    <span class="sort-icon__caret sort-icon__caret--up" />
    <span class="sort-icon__caret sort-icon__caret--down" />
  </span>
</template>

<style scoped>
/* 各 5px 高、中間留 2px（同 el-table 那邊：2026-10-15「排序icon中間沒有任何間隔 看起來就像一個菱形」） */
.sort-icon {
  display: inline-flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  width: 10px;
  height: 12px;
  vertical-align: middle;
}

.sort-icon__caret {
  width: 0;
  height: 0;
  border: 5px solid transparent;
}

.sort-icon__caret--up {
  border-top-width: 0;
  border-bottom-color: var(--el-text-color-secondary);
}

.sort-icon__caret--down {
  border-bottom-width: 0;
  border-top-color: var(--el-text-color-secondary);
}

.is-ascending .sort-icon__caret--up {
  border-bottom-color: var(--el-color-primary);
}

.is-descending .sort-icon__caret--down {
  border-top-color: var(--el-color-primary);
}

/* 排序中只留那個方向的一個 */
.is-ascending .sort-icon__caret--down,
.is-descending .sort-icon__caret--up {
  display: none;
}
</style>
