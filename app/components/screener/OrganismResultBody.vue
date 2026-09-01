<script setup lang="ts">
import type { ScreenerTab } from '~/composables/useScreenerTabs'

// Pure body content for a SharedPresetFolder (or, for the guest tab, rendered on its own
// with no folder at all — column presets are a login-gated resource) — knows nothing about
// switching between column-presets, just renders whichever tab it's handed.
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
}>()
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
      class="screener-result-body__table"
      @reorder="fields => emit('reorderColumns', fields)"
      @remove-column="field => emit('removeColumn', field)"
      @add-column-click="triggerEl => emit('addColumnClick', triggerEl)"
      @row-click="symbol => emit('rowClick', symbol)"
      @page-change="page => emit('pageChange', page)"
      @page-size-change="pageSize => emit('pageSizeChange', pageSize)"
    />
    <p v-if="!tab.searched" class="screener-result-body__note">設定篩選條件即可自動搜尋</p>
    <!-- bff-ts removed the hardcoded system default columns (2026-09-01) — a tab still on
         "預設" (columnPresetId null) with no user isDefault column-preset now genuinely comes
         back with real result rows but an empty columns/values, not the old built-in
         price/PER/PBR/dividend-yield set, until the planned PresetTemplate-style official
         default ships. Without this, that reads as a broken/empty-looking table (bare symbols,
         no data) rather than what it actually is — nudges toward the same "+" this note's
         sibling above already points at for the pre-search case. -->
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
