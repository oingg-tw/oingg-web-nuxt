<script setup lang="ts">
import { Close, Delete, Plus } from '@element-plus/icons-vue'
import type { Stock, StockColumnDef, StockColumnKey, StockTableExtraColumn } from '~/composables/useStocks'
import { formatStockValue } from '~/composables/useStocks'

withDefaults(
  defineProps<{
    stocks: Stock[]
    columns: StockColumnDef[]
    removable?: boolean
    customizableColumns?: boolean
    extraColumns?: StockTableExtraColumn[]
  }>(),
  { removable: true, customizableColumns: false, extraColumns: () => [] }
)

const emit = defineEmits<{
  remove: [code: string]
  addColumnClick: []
  removeColumn: [key: StockColumnKey]
  removeExtraColumn: [key: string]
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
      align="right"
      min-width="110"
    >
      <template #header>
        <span class="stock-table__column-header">
          {{ `${column.label}${column.unit ? ` (${column.unit})` : ''}` }}
          <el-icon
            v-if="customizableColumns"
            class="stock-table__column-remove"
            title="移除欄位"
            @click.stop="emit('removeColumn', column.key)"
          >
            <Close />
          </el-icon>
        </span>
      </template>
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
    <!-- Metrics picked from the /filters catalog (same as the condition dialog); the
         screener backend doesn't return per-stock values for these yet, so they show
         a placeholder until that response shape exists. -->
    <el-table-column
      v-for="column in extraColumns"
      :key="column.key"
      align="right"
      min-width="110"
    >
      <template #header>
        <span class="stock-table__column-header">
          {{ column.label }}
          <el-icon
            class="stock-table__column-remove"
            title="移除欄位"
            @click.stop="emit('removeExtraColumn', column.key)"
          >
            <Close />
          </el-icon>
        </span>
      </template>
      <template #default>
        <span class="stock-table__placeholder">—</span>
      </template>
    </el-table-column>
    <el-table-column v-if="customizableColumns" width="48" align="center">
      <template #header>
        <el-button
          :icon="Plus"
          circle
          text
          size="small"
          title="新增欄位"
          @click.stop="emit('addColumnClick')"
        />
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

.stock-table__column-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stock-table__column-remove {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.stock-table__column-remove:hover {
  color: var(--el-color-danger);
}

.stock-table__placeholder {
  color: var(--el-text-color-placeholder);
}

.is-up {
  color: var(--el-color-danger);
}

.is-down {
  color: var(--el-color-success);
}
</style>
