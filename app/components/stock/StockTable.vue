<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import type { Stock, StockColumnDef } from '~/composables/useStocks'
import { formatStockValue } from '~/composables/useStocks'

withDefaults(
  defineProps<{
    stocks: Stock[]
    columns: StockColumnDef[]
    removable?: boolean
  }>(),
  { removable: true }
)

const emit = defineEmits<{
  remove: [code: string]
}>()

const router = useRouter()
</script>

<template>
  <el-table
    class="stock-table"
    :data="stocks"
    row-key="code"
    stripe
    @row-click="row => router.push(`/stock/${row.code}`)"
  >
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
    <el-table-column v-if="removable" label="" width="60" align="center" fixed="right">
      <template #default="{ row }">
        <el-button
          :icon="Delete"
          circle
          text
          size="small"
          @click.stop="emit('remove', row.code)"
        />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.stock-table :deep(.el-table__row) {
  cursor: pointer;
}

.is-up {
  color: var(--el-color-danger);
}

.is-down {
  color: var(--el-color-success);
}
</style>
