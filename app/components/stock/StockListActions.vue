<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

defineProps<{
  columns: readonly { key: string; label: string }[]
}>()

const visibleColumnKeys = defineModel<string[]>('visibleColumnKeys', { required: true })
</script>

<template>
  <el-popover placement="bottom-end" width="220" trigger="click">
    <template #reference>
      <!-- 圖示＋文字（2026-10-06）：原本是純圖示圓鈕，長輩看不出那是什麼 -->
      <el-button :icon="Setting">顯示欄位</el-button>
    </template>
    <fieldset class="stock-list-actions__picker">
      <legend class="stock-list-actions__picker-title">顯示欄位</legend>
      <el-checkbox-group v-model="visibleColumnKeys">
        <el-checkbox v-for="column in columns" :key="column.key" :value="column.key" :label="column.label" />
      </el-checkbox-group>
    </fieldset>
  </el-popover>
</template>

<style scoped>
.stock-list-actions__picker {
  margin: 0;
  padding: 0;
  border: 0;
}

.stock-list-actions__picker-title {
  margin: 0 0 8px;
  padding: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.stock-list-actions__picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stock-list-actions__picker :deep(.el-checkbox) {
  min-height: 44px;
}
</style>
