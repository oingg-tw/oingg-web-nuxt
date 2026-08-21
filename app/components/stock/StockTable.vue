<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import type { Stock, StockColumnDef } from '~/composables/useStocks'
import { formatStockValue } from '~/composables/useStocks'

defineProps<{
  stocks: Stock[]
  columns: StockColumnDef[]
}>()

const emit = defineEmits<{
  remove: [code: string]
}>()
</script>

<template>
  <el-table class="stock-table" :data="stocks" row-key="code" stripe>
    <el-table-column prop="code" label="代號" width="90" fixed />
    <el-table-column prop="name" label="名稱" min-width="120" fixed />
    <el-table-column
      v-for="column in columns"
      :key="column.key"
      :label="`${column.label}${column.unit ? ` (${column.unit})` : ''}`"
      align="right"
      min-width="110"
    >
      <template #default="{ row }">
        <span
          v-if="column.key === 'change' || column.key === 'changePercent'"
          :class="row[column.key] > 0 ? 'is-up' : row[column.key] < 0 ? 'is-down' : ''"
        >
          {{ formatStockValue(row, column.key) }}
        </span>
        <span v-else>{{ formatStockValue(row, column.key) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="" width="60" align="center" fixed="right">
      <template #default="{ row }">
        <el-button
          :icon="Delete"
          circle
          text
          size="small"
          @click="emit('remove', row.code)"
        />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.is-up {
  color: var(--el-color-danger);
}

.is-down {
  color: var(--el-color-success);
}
</style>
