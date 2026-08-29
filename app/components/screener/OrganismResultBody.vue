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
  addColumnClick: []
  rowClick: [symbol: string]
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
      class="screener-result-body__table"
      @reorder="fields => emit('reorderColumns', fields)"
      @remove-column="field => emit('removeColumn', field)"
      @add-column-click="emit('addColumnClick')"
      @row-click="symbol => emit('rowClick', symbol)"
    />
    <p v-if="tab.searched && !tab.results.length" class="screener-result-body__note">沒有符合條件的股票</p>
    <p v-else-if="!tab.searched" class="screener-result-body__note">設定篩選條件即可自動搜尋</p>
  </div>
</template>

<style scoped>
.screener-result-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
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
