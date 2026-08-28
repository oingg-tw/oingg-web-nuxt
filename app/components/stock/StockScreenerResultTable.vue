<script setup lang="ts">
import { Close, Plus } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import Sortable from 'sortablejs'
import type { ScreenerResultRow } from '~/composables/useFilterSearch'

export interface ScreenerResultTableColumn {
  field: string
  label: string
}

const props = defineProps<{
  rows: ScreenerResultRow[]
  columns: ScreenerResultTableColumn[]
}>()

const emit = defineEmits<{
  reorder: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: []
  rowClick: [symbol: string]
}>()

// Local display order, drag-reorderable independently of whatever order the parent's
// `columns` prop happens to be in — synced back up via `reorder` so the parent can
// persist it (this tab's backing column-preset), and kept in sync here when columns are
// added/removed upstream without losing the current drag order for the rest.
const orderedColumns = ref<ScreenerResultTableColumn[]>([...props.columns])

watch(
  () => props.columns,
  next => {
    const stillPresent = orderedColumns.value.filter(column => next.some(c => c.field === column.field))
    const added = next.filter(column => !stillPresent.some(c => c.field === column.field))
    orderedColumns.value = [...stillPresent, ...added]
  }
)

// Values arrive keyed by the literal "<metricKey>.<fieldKey>" string (not nested), so
// el-table's own path-based `sortable` can't resolve them — sort manually instead.
const sortState = ref<{ field: string | null; order: 'ascending' | 'descending' | null }>({
  field: null,
  order: null
})

function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  sortState.value = order ? { field: prop, order } : { field: null, order: null }
}

const sortedRows = computed(() => {
  const { field, order } = sortState.value
  if (!field || !order) return props.rows
  const factor = order === 'ascending' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const rawA = a.values[field]
    const rawB = b.values[field]
    const numA = rawA === null || rawA === undefined || rawA === '' ? null : Number(rawA)
    const numB = rawB === null || rawB === undefined || rawB === '' ? null : Number(rawB)
    if (numA === null && numB === null) return 0
    if (numA === null) return 1
    if (numB === null) return -1
    return (numA - numB) * factor
  })
})

const tableRef = ref<TableInstance>()
let sortable: Sortable | undefined

// See StockTable.vue for why this key-bump-on-reorder trick is needed: el-table's body
// rendering reads column order from an internal store that a keyed v-for reorder alone
// never re-registers, so the header would follow the drag but the body wouldn't.
const tableKey = ref(0)

function attachSortable() {
  sortable?.destroy()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return

  const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
  if (!headerRow) return

  sortable = Sortable.create(headerRow, {
    animation: 150,
    draggable: 'th.screener-result-table__draggable-header',
    onEnd(evt) {
      const { oldIndex, newIndex, item, from } = evt
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

      from.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)

      const updated = [...orderedColumns.value]
      const [moved] = updated.splice(oldIndex, 1)
      updated.splice(newIndex, 0, moved!)
      orderedColumns.value = updated
      tableKey.value++
      emit('reorder', updated.map(column => column.field))
    }
  })
}

onMounted(attachSortable)
watch(tableKey, () => nextTick(attachSortable))
onUnmounted(() => sortable?.destroy())
</script>

<template>
  <el-table
    :key="tableKey"
    ref="tableRef"
    class="screener-result-table"
    :data="sortedRows"
    row-key="symbol"
    stripe
    @sort-change="handleSortChange"
    @row-click="row => emit('rowClick', row.symbol)"
  >
    <el-table-column prop="symbol" label="代號" width="100" fixed sortable />
    <el-table-column
      v-for="column in orderedColumns"
      :key="column.field"
      align="right"
      min-width="120"
      sortable="custom"
      label-class-name="screener-result-table__draggable-header"
    >
      <template #header>
        <span class="screener-result-table__column-header">
          {{ column.label }}
          <el-icon
            class="screener-result-table__column-remove"
            title="移除欄位"
            @click.stop="emit('removeColumn', column.field)"
          >
            <Close />
          </el-icon>
        </span>
      </template>
      <template #default="{ row }">
        <span>{{ row.values[column.field] ?? '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column width="48" align="center">
      <template #header>
        <el-button :icon="Plus" circle text size="small" title="新增欄位" @click.stop="emit('addColumnClick')" />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.screener-result-table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-result-table :deep(th.screener-result-table__draggable-header) {
  cursor: grab;
}

.screener-result-table__column-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.screener-result-table__column-remove {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.screener-result-table__column-remove:hover {
  color: var(--el-color-danger);
}
</style>
