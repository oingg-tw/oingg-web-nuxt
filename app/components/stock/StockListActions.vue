<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import type { StockColumnDef, StockColumnKey } from '~/composables/useStocks'

defineProps<{
  columns: StockColumnDef[]
}>()

const visibleColumnKeys = defineModel<StockColumnKey[]>('visibleColumnKeys', { required: true })
</script>

<template>
  <el-popover placement="bottom-end" width="200" trigger="click">
    <template #reference>
      <el-button :icon="Setting" circle title="顯示欄位" />
    </template>
    <div class="stock-list-actions__picker">
      <p class="stock-list-actions__picker-title">顯示欄位</p>
      <el-checkbox-group v-model="visibleColumnKeys">
        <el-checkbox v-for="column in columns" :key="column.key" :value="column.key" :label="column.label" />
      </el-checkbox-group>
    </div>
  </el-popover>
</template>

<style scoped>
.stock-list-actions__picker-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stock-list-actions__picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
