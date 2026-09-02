<script setup lang="ts">
import { Close, Plus } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine'
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/utils/reorder'
import type { ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { FilterCategory } from '~/composables/screener/useFilterSchema'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'

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
  // Full-result-set sort, confirmed live on symbol/metric fields (see useScreenerTabs.ts's
  // changeSort) — el-table's own vocabulary (not bff-ts's asc/desc) since this is purely
  // used to drive el-table's :default-sort, keeping the ascending/descending<->asc/desc
  // translation at the composable boundary instead of inside this component.
  sortField: string | null
  sortOrder: 'ascending' | 'descending' | null
  // /filters schema (not the result columns themselves — those don't carry unit) — used
  // purely to look up each displayed field's unit (see unitFor below) so percent metrics
  // can show a % suffix. column.field already matches the schema's own
  // "<metricKey>.<fieldKey>" id format (see locateFieldInSchema).
  categories: FilterCategory[]
}>()

// Only 'percent' gets special formatting right now (the actual request) — every other unit
// ('currency', 'times', 'ratio', 'days', 'score', or an unrecognized future value) just
// falls through to the bare value, unchanged.
function unitFor(field: string): string | undefined {
  return locateFieldInSchema(props.categories, field)?.field.unit
}

function formatValue(column: ScreenerResultTableColumn, raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—'
  return unitFor(column.field) === 'percent' ? `${raw}%` : raw
}

const emit = defineEmits<{
  reorder: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: [triggerEl: HTMLElement]
  rowClick: [symbol: string]
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
  // Only ever emitted for symbol/metric columns — see handleSortChange below. field is null
  // when the user clicks a third time to clear a column's sort.
  sortChange: [field: string | null, order: 'ascending' | 'descending' | null]
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

// Symbol and every metric field are real backend sorts now (bff-ts, confirmed live
// 2026-09-01) — el-table just needs to tell the parent what was clicked, not reorder
// anything itself, so every such column stays sortable="custom" (see the template). "name"
// is the one exception: company name isn't part of analysis-ts's queryable screener data
// (bff-ts stitches it in per-request from a separate endpoint), so a full-result-set sort
// by name isn't something the backend can do without fetching every matching row first —
// scoped out for now. Its column is plain `sortable` instead, which el-table already
// handles entirely on its own (a real, working client-side sort of whatever page is
// currently loaded) — nothing for this handler to do for that column at all.
function handleSortChange({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  if (prop === 'name') return
  // el-table's third click (clearing a column's sort) still reports that column as `prop`
  // even though `order` comes back null — null out field too so "cleared" is a clean,
  // single null/null state throughout (changeSort, the tab, and default-sort below all key
  // off field+order agreeing on that).
  emit('sortChange', order ? prop : null, order)
}

const tableRef = ref<TableInstance>()
let cleanupDrag: (() => void) | undefined

// See StockTable.vue for why this key-bump-on-reorder trick is needed: el-table's body
// rendering reads column order from an internal store that a keyed v-for reorder alone
// never re-registers, so the header would follow the drag but the body wouldn't.
const tableKey = ref(0)

// Drives the CSS on the currently-dragged header cell and the current insertion point (see
// headerClassFor and the .is-dragging/.is-insert-before/.is-insert-after rules below) —
// replaced SortableJS, which reordered the actual <th> elements live as you dragged over
// another one. Requested instead: the source column's position stays put during the drag,
// only a glowing border shows where it would land; the swap itself only happens on drop.
// Pragmatic Drag and Drop's element adapter is built for exactly that split (source position
// vs. drop-target feedback are two independent, composable pieces here, not one bundled
// "live reorder" behavior like SortableJS's).
//
// Originally the whole hovered <th> lit up, reading as "swap with this column" — changed to
// a book-on-a-shelf model instead ("我想像的是會要插入的地方，該位置左邊div的右邊border發亮且
// 該位置右邊div的左邊border發亮"): dropInsertIndex is which gap between columns (0..length,
// in orderedColumns' original index space) the drag would insert into, tracked continuously
// as the pointer moves within whichever <th> it's over (left half of a column = the gap
// before it, right half = the gap after) — not just which column is currently under it.
const draggingField = ref<string | null>(null)
const dropInsertIndex = ref<number | null>(null)
// The dragged column's own index at drag-start — both gaps immediately touching it
// (dropInsertIndex === this, or === this + 1) are "insert right back where it already is",
// a no-op on drop (see the finishIndex === startIndex check below). Lighting up a border
// for those two positions was real but misleading feedback: nothing moves on release, yet
// the glow implied it would ("這是無效資訊。因為放手後東西還在原地"). Tracked separately from
// draggingField since computing an index from it on every drag frame would mean re-running
// findIndex on orderedColumns per pointer move for no reason — the index can't change mid-drag.
const dragStartIndex = ref<number | null>(null)

function headerClassFor(column: ScreenerResultTableColumn, index: number): string {
  const classes = ['screener-result-table__draggable-header']
  if (draggingField.value === column.field) classes.push('is-dragging')
  if (dropInsertIndex.value === index) classes.push('is-insert-before')
  if (dropInsertIndex.value === index + 1) classes.push('is-insert-after')
  return classes.join(' ')
}

// Which gap (left half of `element` -> the gap before `index`, right half -> the gap after)
// the pointer's current X position falls into, in orderedColumns' original index space
// (0..length) — shared between onDragEnter (so the very first frame over a column already
// has a real answer, not just once the pointer first moves within it) and onDrag.
function insertIndexFor(element: HTMLElement, clientX: number, index: number): number {
  const rect = element.getBoundingClientRect()
  return clientX < rect.left + rect.width / 2 ? index : index + 1
}

// Wraps insertIndexFor with the no-op check above — null means "don't highlight anything",
// used directly as dropInsertIndex's new value so onDrop (which already treats null as
// "nothing to do") stays correct with no separate check needed there.
function resolveInsertIndex(element: HTMLElement, clientX: number, index: number): number | null {
  const insertIndex = insertIndexFor(element, clientX, index)
  if (dragStartIndex.value !== null && (insertIndex === dragStartIndex.value || insertIndex === dragStartIndex.value + 1)) {
    return null
  }
  return insertIndex
}

// retriesLeft guards against a real timing gap: a single nextTick isn't always enough for
// Element Plus to have actually reflected label-class-name onto the real <th> DOM yet
// (confirmed live — headerCells still came back empty immediately after a nextTick that
// followed orderedColumns going from [] to a real list), so querying immediately here can
// silently find zero cells and skip attaching anything, with no further trigger to retry
// since orderedColumns itself doesn't change again. requestAnimationFrame instead of a
// second nextTick — gives a real paint cycle rather than guessing one more microtask is
// enough — capped so a genuinely-empty table (0 columns) doesn't spin forever.
function attachDragReorder(retriesLeft = 5) {
  cleanupDrag?.()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return

  const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
  if (!headerRow) return

  const headerCells = Array.from(headerRow.querySelectorAll<HTMLElement>('th.screener-result-table__draggable-header'))
  if (headerCells.length !== orderedColumns.value.length && retriesLeft > 0) {
    requestAnimationFrame(() => attachDragReorder(retriesLeft - 1))
    return
  }

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
            dragStartIndex.value = index
          },
          onDrop: () => {
            draggingField.value = null
            dragStartIndex.value = null
          }
        }),
        dropTargetForElements({
          element: th,
          getData: () => ({ field }),
          canDrop: ({ source }) => source.data.field !== field,
          onDragEnter: ({ location }) => {
            dropInsertIndex.value = resolveInsertIndex(th, location.current.input.clientX, index)
          },
          onDrag: ({ location }) => {
            dropInsertIndex.value = resolveInsertIndex(th, location.current.input.clientX, index)
          },
          onDragLeave: () => {
            if (dropInsertIndex.value === index || dropInsertIndex.value === index + 1) dropInsertIndex.value = null
          },
          onDrop: ({ source }) => {
            const targetIndex = dropInsertIndex.value
            dropInsertIndex.value = null
            if (targetIndex === null) return

            // Reads the source field from this drop target's own event data (set once at
            // drag-start via getInitialData), not draggingField — that ref is independently
            // cleared by the *source* element's own onDrop (a different callback, on the
            // draggable() below, not this dropTargetForElements()), and the two can fire in
            // either order, so relying on it here was a real race that silently dropped every
            // reorder (confirmed live: order never changed no matter where it was dropped).
            const sourceField = source.data.field as string
            const startIndex = orderedColumns.value.findIndex(column => column.field === sourceField)
            if (startIndex === -1) return

            // reorder()'s own finishIndex is in "list with the source already removed" index
            // space, not the original array's — inserting after a target that came later
            // than the source needs shifting left by one to compensate for the source's own
            // removal collapsing everything after it. See reorder.js's own splice/splice pair.
            const finishIndex = startIndex < targetIndex ? targetIndex - 1 : targetIndex
            if (finishIndex === startIndex) return

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

// "table欄位寬度在tab切分時會左右跳動...都是欄位往右邊飛 再左彈歸位" — el-table doesn't always
// re-run its own internal column-width calculation promptly after `data`/columns change (its
// automatic recalculation appears to be debounced/delayed rather than synchronous), so there
// was a real frame where columns briefly rendered at their un-constrained natural width
// (wider, reading as "flying right") before el-table's own later recalculation snapped them
// back to the actual table width. doLayout() is el-table's own public method for forcing
// that recalculation immediately — calling it explicitly after data/columns settle (post
// nextTick, so the DOM already reflects the new content) skips waiting on whatever internal
// schedule it would otherwise run on.
watch([orderedColumns, () => props.rows], () => nextTick(() => tableRef.value?.doLayout()))

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
      :data="rows"
      row-key="symbol"
      stripe
      :default-sort="sortField ? { prop: sortField, order: sortOrder } : undefined"
      @sort-change="handleSortChange"
      @row-click="row => emit('rowClick', row.symbol)"
    >
      <!-- Real backend sort (see handleSortChange) — sortable="custom" so el-table only
           reports the click instead of trying to reorder `rows` itself, which is already in
           whatever order the server returned it in. -->
      <el-table-column prop="symbol" label="代號" width="90" fixed sortable="custom" />
      <!-- Plain sortable: not backend-sortable (see handleSortChange's comment), so this is
           a genuine, working client-side sort of whichever page is currently loaded —
           el-table handles it entirely on its own, no comparator needed here. -->
      <!-- @row-click below navigates on mouse click for a large, convenient hit target, but
           el-table rows are plain <tr>s with no native keyboard/AT semantics — this link is
           what actually makes "open a stock from this table" reachable without a mouse
           (same /stock/{code} path the parent's own row-click handler already navigates to,
           see screener.vue). -->
      <el-table-column prop="name" label="名稱" width="110" fixed sortable>
        <template #default="{ row }">
          <NuxtLink :to="`/stock/${row.symbol}`" class="screener-result-table__name-link" @click.stop>{{ row.name }}</NuxtLink>
        </template>
      </el-table-column>
      <el-table-column
        v-for="(column, index) in orderedColumns"
        :key="column.field"
        align="right"
        min-width="120"
        sortable="custom"
        :label-class-name="headerClassFor(column, index)"
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
            role="button"
            tabindex="0"
            :title="`移除${displayLabel(column)}欄位`"
            :aria-label="`移除${displayLabel(column)}欄位`"
            @click.stop="emit('removeColumn', column.field)"
            @keydown.enter.stop.prevent="emit('removeColumn', column.field)"
            @keydown.space.stop.prevent="emit('removeColumn', column.field)"
          >
            <Close />
          </el-icon>
        </template>
        <template #default="{ row }">
          <div class="screener-result-table__cell">
            <span>{{ formatValue(column, row.values[column.field]?.value) }}</span>
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

.screener-result-table__name-link {
  color: inherit;
  text-decoration: none;
  display: block;
}

.screener-result-table__pagination {
  justify-content: center;
  padding: 12px;
  flex-wrap: wrap;
  /* Overrides Element Plus's own --el-pagination-* defaults (14px text, 32x32 buttons) —
     these vars are re-declared on .el-pagination's own root by the library itself, but this
     selector (two classes) beats that plain single-class rule on specificity alone, so no
     !important needed. 14px/32px clears the WCAG 2.5.8 AA floor (24px hit area) but sits
     below this project's 44px target for primary interactive controls (see
     docs/ui-ux/accessibility-guidelines.md §1.2); pager buttons are the main way to navigate
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

/* The actual "where would this land" indicator — inset box-shadow rather than a real border
   so it doesn't add to the cell's box size and shift anything else in the row. Book-on-a-
   shelf model ("該位置左邊div的右邊border發亮且該位置右邊div的左邊border發亮"): the gap the
   drag would insert into lights up from both sides, not the whole hovered column — a column
   right before the gap gets its own right edge lit (is-insert-after), the one right after
   gets its left edge lit (is-insert-before). Only one side lights up at either end of the
   row, where there's no neighbor on that side to pair with. */
.screener-result-table :deep(th.screener-result-table__draggable-header.is-insert-before) {
  box-shadow: inset 2px 0 0 0 var(--el-color-primary);
}

.screener-result-table :deep(th.screener-result-table__draggable-header.is-insert-after) {
  box-shadow: inset -2px 0 0 0 var(--el-color-primary);
}

/* Flex row across the label, el-table's own sort caret, and the remove icon — see the
   template comment on #header for why the caret (rendered by el-table itself, not this
   component) needs an explicit `order` to land in front of the label rather than trailing
   after everything else. */
.screener-result-table :deep(th.screener-result-table__draggable-header .cell) {
  display: flex;
  align-items: center;
  /* The column itself is align="right" (matches the right-aligned number cells below), but
     that only sets text-align on .cell — flex children ignore text-align entirely, so
     without this the header content stayed packed to the left regardless, visibly
     misaligned against its own column's data. */
  justify-content: flex-end;
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
