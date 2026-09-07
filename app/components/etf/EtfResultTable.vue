<script setup lang="ts">
import type { useEtfScreener } from '~/composables/etf/useEtfScreener'
import { ETF_UNRELIABLE_FIELDS } from '~/composables/etf/useEtfScreener'

// Bottom PresetFolder's own slot content (etf-zone.vue) — column picker for the currently
// active column preset, plus the one shared results table every filter/column preset
// combination renders into. `screener` is the single `useEtfScreener()` instance the page
// creates once and passes down here — this component's own local state is only about WHICH
// columns to request, not the request/response/pagination mechanics themselves (those live in
// the composable, shared with EtfFilterEditor.vue's own sibling folder).
const columns = defineModel<string[]>('columns', { required: true })

const props = defineProps<{
  screener: ReturnType<typeof useEtfScreener>
}>()

const filterSchema = useEtfFilterSchema()

const usableFields = computed(() => (filterSchema.fields.value ?? []).filter(field => !ETF_UNRELIABLE_FIELDS.includes(field.field)))

function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!order) {
    props.screener.setSort(null, 'desc')
    return
  }
  props.screener.setSort(prop, order === 'ascending' ? 'asc' : 'desc')
}

function formatCellValue(field: string, value: string | number | boolean | null): string {
  if (value === null) return '－'
  const schemaField = filterSchema.fields.value?.find(item => item.field === field)
  if (schemaField?.kind === 'categorical') return String(value)
  if (typeof value !== 'number') return String(value)
  if (field === 'aum' || field === 'nav' || field === 'dcaAmount' || field === 'statutoryAumThreshold') {
    return value.toLocaleString('zh-TW')
  }
  // expenseRatio is excluded entirely (never reaches this formatter — see
  // ETF_UNRELIABLE_FIELDS), so every remaining numeric field here is a return* period; shown
  // with a % suffix per the schema's own label wording ("近1年報酬率" etc).
  return `${value}%`
}
</script>

<template>
  <div class="etf-result-table">
    <div class="etf-result-table__columns">
      <span class="etf-result-table__columns-label">顯示欄位</span>
      <el-select v-model="columns" multiple collapse-tags size="small" class="etf-result-table__column-select">
        <el-option v-for="field in usableFields" :key="field.field" :label="field.label" :value="field.field" />
      </el-select>
    </div>

    <p v-if="screener.errorMessage.value" class="etf-result-table__error">
      查詢失敗：{{ screener.errorMessage.value }}
    </p>

    <template v-else-if="screener.searched.value">
      <p class="etf-result-table__count">共 {{ screener.count.value }} 檔符合條件</p>
      <el-table v-loading="screener.pending.value" :data="screener.rows.value" size="small" @sort-change="onSortChange">
        <el-table-column label="代號" prop="symbol" min-width="90" fixed />
        <el-table-column label="名稱" prop="shortName" min-width="140" fixed />
        <el-table-column
          v-for="field in columns"
          :key="field"
          :label="filterSchema.fieldLabel(field)"
          :prop="field"
          align="right"
          min-width="120"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatCellValue(field, row.values[field] ?? null) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="screener.totalPages.value > 1"
        class="etf-result-table__pagination"
        layout="prev, pager, next"
        background
        :current-page="screener.page.value"
        :page-count="screener.totalPages.value"
        @current-change="screener.goToPage"
      />
    </template>
  </div>
</template>

<style scoped>
.etf-result-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.etf-result-table__columns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.etf-result-table__columns-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.etf-result-table__column-select {
  flex: 1;
}

.etf-result-table__error {
  color: var(--el-color-danger);
  font-size: 16px;
}

.etf-result-table__count {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.etf-result-table__pagination {
  justify-content: center;
}
</style>
