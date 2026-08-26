<script setup lang="ts">
import { Close, Delete, Plus } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import Sortable from 'sortablejs'
import type { Stock, StockColumnDef, StockColumnKey, StockTableExtraColumn } from '~/composables/useStocks'
import { formatStockValue } from '~/composables/useStocks'

const props = withDefaults(
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

// Local display order, drag-reorderable independently of whatever order the parent's
// `columns` prop happens to be in. Kept in sync when columns are added/removed upstream
// (e.g. the screener's +/x buttons) without losing the current drag order for the rest.
const orderedColumns = ref<StockColumnDef[]>([...props.columns])

watch(
  () => props.columns,
  next => {
    const stillPresent = orderedColumns.value.filter(column => next.some(c => c.key === column.key))
    const added = next.filter(column => !stillPresent.some(c => c.key === column.key))
    orderedColumns.value = [...stillPresent, ...added]
  }
)

const tableRef = ref<TableInstance>()
let sortable: Sortable | undefined

// el-table registers its `<el-table-column>` children into an internal column store at
// mount time; reordering the `orderedColumns` array that drives the `v-for` moves each
// column's Vue instance (so the header text — rendered by that instance's own #header
// slot — correctly follows the drag), but el-table's body rendering reads column order
// from that internal store, which a keyed reorder never re-registers. Bumping this key
// forces el-table (and its column children) to fully remount after a reorder so the
// store rebuilds from scratch in the new order — the reliable fix for that gap.
const tableKey = ref(0)

function attachSortable() {
  sortable?.destroy()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return

  // el-table can render up to three header rows (fixed-left / main / fixed-right) — only
  // the main, non-fixed one holds the draggable data columns.
  const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
  if (!headerRow) return

  sortable = Sortable.create(headerRow, {
    animation: 150,
    draggable: 'th.stock-table__draggable-header',
    onEnd(evt) {
      const { oldIndex, newIndex, item, from } = evt
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

      // Sortable already moved `item` in the real DOM; put it back so Vue's next render
      // starts from a consistent state, then apply the same move to the reactive array.
      from.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)

      const updated = [...orderedColumns.value]
      const [moved] = updated.splice(oldIndex, 1)
      updated.splice(newIndex, 0, moved!)
      orderedColumns.value = updated
      tableKey.value++
    }
  })
}

onMounted(attachSortable)

// The remount destroys the old header DOM (and the Sortable instance bound to it), so
// re-attach once the new table has rendered.
watch(tableKey, () => nextTick(attachSortable))

onUnmounted(() => {
  sortable?.destroy()
})
</script>

<template>
  <el-table
    :key="tableKey"
    ref="tableRef"
    class="stock-table"
    :data="stocks"
    row-key="code"
    stripe
    @row-click="row => router.push(`/stock/${row.code}`)"
  >
    <el-table-column prop="code" label="代號" width="90" fixed sortable />
    <el-table-column prop="name" label="名稱" min-width="120" fixed sortable />
    <el-table-column
      v-for="column in orderedColumns"
      :key="column.key"
      :prop="column.key"
      align="right"
      min-width="110"
      sortable
      label-class-name="stock-table__draggable-header"
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

.stock-table :deep(th.stock-table__draggable-header) {
  cursor: grab;
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
