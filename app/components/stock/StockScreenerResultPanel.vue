<script setup lang="ts">
import { Close, Plus } from '@element-plus/icons-vue'
import type { ColumnPresetOption, ScreenerTab } from '~/composables/useScreenerTabs'

const props = defineProps<{
  tab: ScreenerTab
  columnPresetOptions: ColumnPresetOption[]
  isGuest: boolean
}>()

const emit = defineEmits<{
  columnTabChange: [name: string | number]
  addColumnPreset: []
  removeColumnPreset: [name: string | number]
  reorderColumns: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: []
  rowClick: [symbol: string]
}>()

const columnTabName = computed(() => (props.tab.columnPresetId === null ? 'default' : String(props.tab.columnPresetId)))
</script>

<template>
  <div class="screener-result-panel">
    <!-- A plain dropdown, not tabs — these column-presets are a global catalog with no
         ownership tie to this (or any) filter tab, just a per-tab choice of which one to
         currently view results through. Column presets are a login-gated resource, so the
         guest tab skips this row entirely rather than showing a picker with nothing real
         to pick. -->
    <div v-if="!isGuest" class="screener-result-panel__column-select">
      <span class="screener-result-panel__column-select-label">顯示欄位</span>
      <el-select
        :model-value="columnTabName"
        size="small"
        class="screener-result-panel__column-select-control"
        popper-class="screener-result-panel__column-select-dropdown"
        @change="name => emit('columnTabChange', name)"
      >
        <el-option value="default" label="預設" />
        <el-option v-for="option in columnPresetOptions" :key="option.id" :value="String(option.id)" :label="option.name">
          <div class="screener-result-panel__column-option">
            <span class="screener-result-panel__column-option-name">{{ option.name }}</span>
            <el-icon
              class="screener-result-panel__column-option-remove"
              title="刪除欄位組合"
              @click.stop="emit('removeColumnPreset', option.id)"
            >
              <Close />
            </el-icon>
          </div>
        </el-option>
      </el-select>
      <el-button
        :icon="Plus"
        size="small"
        circle
        title="新增欄位組合"
        aria-label="新增欄位組合"
        @click="emit('addColumnPreset')"
      />
    </div>

    <!-- Always rendered (not gated behind tab.searched) so columns can be set up via the
         trailing "+" header before the first search too — el-table just shows its own
         empty state until there's anything in tab.results. v-loading overlays a spinner
         without changing this block's height, so a search starting/finishing never shifts
         the page the way a separate "搜尋中" line did. -->
    <StockScreenerResultTable
      v-loading="tab.loading"
      :rows="tab.results"
      :columns="tab.columns"
      class="screener-result-panel__table"
      @reorder="fields => emit('reorderColumns', fields)"
      @remove-column="field => emit('removeColumn', field)"
      @add-column-click="emit('addColumnClick')"
      @row-click="symbol => emit('rowClick', symbol)"
    />
    <p v-if="tab.searched && !tab.results.length" class="screener-result-panel__result-note">沒有符合條件的股票</p>
    <p v-else-if="!tab.searched" class="screener-result-panel__result-note">設定篩選條件即可自動搜尋</p>
  </div>
</template>

<style scoped>
/* The gap above this row is deliberately bigger than any other spacing in the pane —
   that's the only cue marking "篩選" (condition slots, in ScreenerPresetTabs) and "檢視"
   (this row plus the result table below) as two separate blocks. Plain whitespace, not a
   wrapping div. */
.screener-result-panel__column-select {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  margin-bottom: 8px;
}

.screener-result-panel__column-select-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.screener-result-panel__column-select-control {
  width: 180px;
}

/* el-select's small size drops to 12px, under the 16px minimum body-text floor — force
   it back up. Its dropdown teleports to <body>, out of scoped styles' reach entirely,
   hence popper-class + the matching unscoped rule below. */
.screener-result-panel__column-select-control :deep(.el-select__wrapper),
.screener-result-panel__column-select-control :deep(.el-select__placeholder) {
  font-size: 16px;
}

.screener-result-panel__column-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.screener-result-panel__column-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screener-result-panel__column-option-remove {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.screener-result-panel__column-option-remove:hover {
  color: var(--el-color-danger);
}

.screener-result-panel__table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-result-panel__result-note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
</style>

<style>
/* Unscoped on purpose — el-select teleports its dropdown to <body>, so a scoped (or
   :deep()) selector rooted in this component can never reach it. */
.screener-result-panel__column-select-dropdown .el-select-dropdown__item {
  font-size: 16px;
}
</style>
