<script setup lang="ts">
import { Close, Plus } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine'
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/utils/reorder'
import type { ScreenerResultRow } from '~/composables/useFilterSearch'

export interface ScreenerResultTableColumn {
  field: string
  label: string
}

const props = defineProps<{
  rows: ScreenerResultRow[]
  columns: ScreenerResultTableColumn[]
  // Server-side pagination now (bff-ts /screener and /screener/presets/{id}/run both take
  // page/pageSize) — `rows` above is already just this one page's worth, not the full
  // result set, so there's nothing left for this component to slice locally.
  page: number
  pageSize: number
  totalPages: number
}>()

const emit = defineEmits<{
  reorder: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: [triggerEl: HTMLElement]
  rowClick: [symbol: string]
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
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

function handleSortChange({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  sortState.value = prop && order ? { field: prop, order } : { field: null, order: null }
}

const sortedRows = computed(() => {
  const { field, order } = sortState.value
  if (!field || !order) return props.rows
  const factor = order === 'ascending' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const rawA = a.values[field]?.value
    const rawB = b.values[field]?.value
    const numA = rawA === null || rawA === undefined || rawA === '' ? null : Number(rawA)
    const numB = rawB === null || rawB === undefined || rawB === '' ? null : Number(rawB)
    if (numA === null && numB === null) return 0
    if (numA === null) return 1
    if (numB === null) return -1
    return (numA - numB) * factor
  })
})

// Sorting only ever sorts the current page's rows — the server doesn't take a sort
// param, and re-sorting across the full result set would mean fetching everything at once,
// defeating the point of paginating. An accepted limitation, not an oversight.
const tableRef = ref<TableInstance>()
let cleanupDrag: (() => void) | undefined

// See StockTable.vue for why this key-bump-on-reorder trick is needed: el-table's body
// rendering reads column order from an internal store that a keyed v-for reorder alone
// never re-registers, so the header would follow the drag but the body wouldn't.
const tableKey = ref(0)

// Drives the CSS on the currently-dragged and currently-hovered header cells (see
// headerClassFor and the .is-dragging/.is-drop-target rules below) — replaced SortableJS,
// which reordered the actual <th> elements live as you dragged over another one. Requested
// instead: the source column's position stays put during the drag, only a glowing border on
// whichever column you're hovering shows where it would land; the swap itself only happens
// on drop. Pragmatic Drag and Drop's element adapter is built for exactly that split (source
// position vs. drop-target feedback are two independent, composable pieces here, not one
// bundled "live reorder" behavior like SortableJS's).
const draggingField = ref<string | null>(null)
const dropTargetField = ref<string | null>(null)

function headerClassFor(column: ScreenerResultTableColumn): string {
  const classes = ['screener-result-table__draggable-header']
  if (draggingField.value === column.field) classes.push('is-dragging')
  if (dropTargetField.value === column.field) classes.push('is-drop-target')
  return classes.join(' ')
}

function attachDragReorder() {
  cleanupDrag?.()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return

  const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
  if (!headerRow) return

  const headerCells = Array.from(headerRow.querySelectorAll<HTMLElement>('th.screener-result-table__draggable-header'))

  // One draggable + one dropTargetForElements PER header cell — unlike SortableJS's single
  // Sortable.create() on the row (which drives every item from one place), Pragmatic wires
  // each cell independently; each closes over its own `field` from this same render pass, so
  // there's no need to re-derive "which column is this" from DOM position at drag time.
  cleanupDrag = combine(
    ...headerCells.flatMap((th, index) => {
      const field = orderedColumns.value[index]?.field
      if (!field) return []

      return [
        draggable({
          element: th,
          getInitialData: () => ({ field }),
          onDragStart: () => {
            draggingField.value = field
          },
          onDrop: () => {
            draggingField.value = null
          }
        }),
        dropTargetForElements({
          element: th,
          getData: () => ({ field }),
          canDrop: ({ source }) => source.data.field !== field,
          onDragEnter: () => {
            dropTargetField.value = field
          },
          onDragLeave: () => {
            if (dropTargetField.value === field) dropTargetField.value = null
          },
          onDrop: ({ source }) => {
            dropTargetField.value = null
            const sourceField = source.data.field as string
            if (sourceField === field) return
            const startIndex = orderedColumns.value.findIndex(column => column.field === sourceField)
            const finishIndex = orderedColumns.value.findIndex(column => column.field === field)
            if (startIndex === -1 || finishIndex === -1) return

            const updated = reorder({ list: orderedColumns.value, startIndex, finishIndex })
            orderedColumns.value = updated
            tableKey.value++
            emit('reorder', updated.map(column => column.field))
          }
        })
      ]
    })
  )
}

onMounted(attachDragReorder)
// Watches orderedColumns itself, not tableKey — each draggable/dropTarget closes over a
// `field` read from orderedColumns.value at attach time (unlike SortableJS's old
// Sortable.create(), which matched <th> elements by CSS selector live at drag time and
// never needed to know the column list in advance). Columns often populate asynchronously
// after this component's first mount, so attaching once via onMounted alone attached zero
// listeners against an empty list — confirmed live (every <th>'s draggable attribute stayed
// null). Watching orderedColumns covers both real triggers: props.columns changing
// upstream (synced into orderedColumns by the watcher above) and this component's own
// reorder-on-drop reassigning it.
watch(orderedColumns, () => nextTick(attachDragReorder))
onUnmounted(() => cleanupDrag?.())

// column.label already carries its period baked in as "名稱（期間）" (see formatFieldLabel
// in useFilterSchema.ts, the one place that ever assembles this) — a global toggle rather
// than fetching/storing period separately, since that exact suffix format is the only thing
// that needs stripping, not a real second data field. The switch itself lives in screener.vue,
// outside any column-preset tab — see useScreenerShowPeriod.ts for why.
const showPeriod = useScreenerShowPeriod()

function displayLabel(column: ScreenerResultTableColumn) {
  return showPeriod.value ? column.label : column.label.replace(/（[^（）]*）$/, '')
}
</script>

<template>
  <!-- Single root (rather than el-table/el-pagination as two siblings) so the class the
       parent passes in (screener-result-body__table) still falls through automatically —
       Vue only does that for a single-root component. -->
  <div class="screener-result-table-wrap">
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
        :label-class-name="headerClassFor(column)"
      >
        <template #header>
          <!-- Two separate flex children (not one wrapping span) so el-table's own sort
               caret — which it appends as a sibling AFTER whatever this slot renders, not
               inside it — can be visually reordered via CSS order (see
               .screener-result-table__draggable-header .cell below). Sort caret leads, then
               the label text, then remove last. -->
          <span class="screener-result-table__column-label">{{ displayLabel(column) }}</span>
          <el-icon
            class="screener-result-table__column-remove"
            title="移除欄位"
            @click.stop="emit('removeColumn', column.field)"
          >
            <Close />
          </el-icon>
        </template>
        <template #default="{ row }">
          <div class="screener-result-table__cell">
            <span>{{ row.values[column.field]?.value ?? '—' }}</span>
            <!-- The actual per-row asOfDate this specific number describes — different
                 symbols can legitimately show different dates for the same field (e.g. one
                 hasn't filed this quarter's report yet), so this can't be hoisted up to the
                 column header the way the period-type suffix above is. -->
            <span v-if="showPeriod && row.values[column.field]?.asOfDate" class="screener-result-table__cell-date">
              {{ row.values[column.field]!.asOfDate }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column width="48" align="center">
        <template #header>
          <el-button :icon="Plus" circle text size="small" title="新增欄位" @click.stop="emit('addColumnClick', $event.currentTarget as HTMLElement)" />
        </template>
      </el-table-column>
    </el-table>

    <!-- Shown whenever there are any results, not just once there's more than one page —
         the page-size dropdown ("sizes" in layout) needs to stay reachable even when the
         current filter only matches a handful of rows, otherwise there'd be no way to ask
         for a bigger page in the first place. prev/pager/next are still meaningless with a
         single page, but el-pagination disables/collapses those on its own; hiding the
         whole bar would take the size selector down with them. current-page/page-size are
         plain props here (not v-model) — this component doesn't own pagination state, the
         tab does (useScreenerTabs' changePage/changePageSize actually re-run the search),
         so a page/size change here just asks the parent for one rather than changing
         anything locally itself. No "total X 筆" in the layout — the API gives totalPages,
         not an exact overall row count, so :page-count (not :total) is what drives the
         pager. -->
    <el-pagination
      v-if="rows.length > 0"
      :current-page="page"
      :page-size="pageSize"
      class="screener-result-table__pagination"
      :page-sizes="[20, 50, 100]"
      :page-count="totalPages"
      layout="sizes, prev, pager, next"
      background
      @current-change="newPage => emit('pageChange', newPage)"
      @size-change="newPageSize => emit('pageSizeChange', newPageSize)"
    />
  </div>
</template>

<style scoped>
.screener-result-table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-result-table__pagination {
  justify-content: flex-end;
  padding: 12px;
  flex-wrap: wrap;
  /* Overrides Element Plus's own --el-pagination-* defaults (14px text, 32x32 buttons) —
     these vars are re-declared on .el-pagination's own root by the library itself, but this
     selector (two classes) beats that plain single-class rule on specificity alone, so no
     !important needed. 14px/32px clears the WCAG 2.5.8 AA floor (24px hit area) but sits
     below this project's 44px target for primary interactive controls (see
     docs/accessibility-guidelines.md §1.2); pager buttons are the main way to navigate
     results, so they get a real bump too — not all the way to 44px since prev/pager/next
     sit in one row together and a full-size jump there gets crowded, but comfortably above
     the bare-minimum default. */
  --el-pagination-font-size: 16px;
  --el-pagination-button-width: 36px;
  --el-pagination-button-height: 36px;
}

/* The page-size dropdown is an el-select — its visible text size comes from
   .el-select__wrapper's font-size, which Element Plus bakes in as a literal px value at
   build time (a Sass map lookup, not a --el-* custom property), so there's no CSS var to
   override here the way the pagination buttons above worked. .el-select__selected-item
   inherits from it, so setting it once on the wrapper covers the rendered text too. */
.screener-result-table__pagination :deep(.el-select__wrapper) {
  font-size: 16px;
}

.screener-result-table :deep(th.screener-result-table__draggable-header) {
  cursor: grab;
}

/* Dim the source column while it's being dragged — its position doesn't move (see
   attachDragReorder's own comment for why), so this is the only feedback that it's the one
   currently in motion. */
.screener-result-table :deep(th.screener-result-table__draggable-header.is-dragging) {
  opacity: 0.5;
}

/* The actual "where would this land" indicator, requested as "一個發光的border之類的" — inset
   box-shadow rather than a real border so it doesn't add to the cell's box size and shift
   anything else in the row. */
.screener-result-table :deep(th.screener-result-table__draggable-header.is-drop-target) {
  box-shadow: inset 0 0 0 2px var(--el-color-primary);
}

/* Flex row across the label, el-table's own sort caret, and the remove icon — see the
   template comment on #header for why the caret (rendered by el-table itself, not this
   component) needs an explicit `order` to land in front of the label rather than trailing
   after everything else. */
.screener-result-table :deep(th.screener-result-table__draggable-header .cell) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.screener-result-table :deep(th.screener-result-table__draggable-header .caret-wrapper) {
  order: 0;
}

.screener-result-table__column-label {
  order: 1;
}

.screener-result-table__column-remove {
  order: 2;
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.screener-result-table__column-remove:hover {
  color: var(--el-color-danger);
}

.screener-result-table__cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.3;
}

.screener-result-table__cell-date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
