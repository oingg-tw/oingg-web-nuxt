<script setup lang="ts">
import type { ScreenerTab } from '~/composables/screener/useScreenerTabs'

// Pure body content for a SharedPresetFolder — knows nothing about switching between
// column-presets, just renders whichever tab it's handed.
defineProps<{
  tab: ScreenerTab
}>()

const emit = defineEmits<{
  reorderColumns: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: [triggerEl: HTMLElement]
  rowClick: [symbol: string]
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
  // bff-ts's own vocabulary (asc/desc), not el-table's (ascending/descending) — translated
  // right here at the boundary (see toElOrder/fromElOrder below) so screener.vue can pass
  // this straight into useScreenerTabs.ts's changeSort without its own translation step,
  // same as pageChange/pageSizeChange above feed straight into changePage/changePageSize.
  sortChange: [field: string | null, order: 'asc' | 'desc' | null]
}>()

function toElOrder(order: 'asc' | 'desc' | null): 'ascending' | 'descending' | null {
  if (order === 'asc') return 'ascending'
  if (order === 'desc') return 'descending'
  return null
}

function fromElOrder(order: 'ascending' | 'descending' | null): 'asc' | 'desc' | null {
  if (order === 'ascending') return 'asc'
  if (order === 'descending') return 'desc'
  return null
}
</script>

<template>
  <div class="screener-result-body">
    <!-- No horizontal padding around the table on purpose — mobile screen width is scarce
         enough already that the table has to scroll internally past a few columns; a
         matching side margin here would just shrink that further for no benefit. Always
         rendered (not gated behind tab.searched) so columns can be set up via the trailing
         "+" header before the first search too — el-table just shows its own empty state
         until there's anything in tab.results. v-loading overlays a spinner without
         changing this block's height, so a search starting/finishing never shifts the page
         the way a separate "搜尋中" line did. -->
    <ScreenerOrganismResultTable
      v-loading="tab.loading"
      :rows="tab.results"
      :columns="tab.columns"
      :page="tab.page"
      :page-size="tab.pageSize"
      :total-pages="tab.totalPages"
      :sort-field="tab.sortField"
      :sort-order="toElOrder(tab.sortOrder)"
      class="screener-result-body__table"
      @reorder="fields => emit('reorderColumns', fields)"
      @remove-column="field => emit('removeColumn', field)"
      @add-column-click="triggerEl => emit('addColumnClick', triggerEl)"
      @row-click="symbol => emit('rowClick', symbol)"
      @page-change="page => emit('pageChange', page)"
      @page-size-change="pageSize => emit('pageSizeChange', pageSize)"
      @sort-change="(field, order) => emit('sortChange', field, fromElOrder(order))"
    />
    <p v-if="!tab.searched" class="screener-result-body__note">設定篩選條件即可自動搜尋</p>
    <!-- Defensive fallback, not an expected everyday state anymore — resolveDefaultColumnPresetId
         (client-side, useScreenerTabs.ts) and bff-ts's own null-fallback (server-side, now
         resolves to a curated "overview" ColumnPresetTemplate instead of returning nothing)
         both mean a real columnPresetId reaches the table in practice. Kept in case some edge
         case still slips through, so it reads as "no columns configured yet, here's the +"
         rather than a broken/empty-looking table (bare symbols, no data) if it ever does. -->
    <p v-else-if="tab.results.length > 0 && tab.columns.length === 0" class="screener-result-body__note">
      尚未設定顯示欄位，點擊右上角「+」新增要顯示的欄位
    </p>
  </div>
</template>

<style scoped>
.screener-result-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.screener-result-body__table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-result-body__note {
  margin: 8px 0 0;
  padding: 0 12px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
</style>
