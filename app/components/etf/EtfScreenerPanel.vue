<script setup lang="ts">
import { Plus, Close } from '@element-plus/icons-vue'
import { ETF_UNRELIABLE_FIELDS, type EtfFilterState } from '~/composables/etf/useEtfScreener'

// New per direct request ("叫BFF 動起來" — bff-ts shipped POST /etf-screener + GET
// /etf-screener/filters + GET /market/etf-ranking) after confirming this app previously had an
// ETF RANKING (EtfRankingCard.vue, real data) but no ETF SCREENING/FILTERING at all — this fills
// that specific gap. Deliberately simpler than screener.vue's own filter UI (screener.vue has NO
// categorical-filter component at all — every stock-screener field is numeric, so
// MoleculeRangeEditor.vue was never built to switch on a `kind`). ETF's own /etf-screener/filters
// DOES return categorical fields (market/assetClass/isActive/distributionFrequency/
// belowStatutoryThreshold), so this component handles both kinds itself rather than trying to
// force-fit the stock screener's numeric-only editor.
//
// No backend-persisted filter/column presets exist for ETF (bff-ts's own description only
// mentioned these 3 endpoints, no /etf-screener/presets or /etf-screener/column-presets) — see
// useEtfScreener.ts's own comment. Filters/columns reset on page reload; add persistence later
// only if/when that resource actually ships.
const filterSchema = useEtfFilterSchema()
const screener = useEtfScreener()

// expenseRatio/return1y excluded from every user-facing field list (filter picker AND column
// picker) — confirmed unreliable 2026-09-07 by bff-ts/analysis-ts (real sitca-ts source data
// issue, not a display bug), see ETF_UNRELIABLE_FIELDS's own comment. Fields the schema itself
// still returns (bff-ts hasn't removed them from GET /etf-screener/filters), just hidden here
// until the fix lands.
const usableFields = computed(() => (filterSchema.fields.value ?? []).filter(field => !ETF_UNRELIABLE_FIELDS.includes(field.field)))

const availableFieldsToAdd = computed(() => {
  const activeFields = new Set(screener.filters.value.map(filter => filter.field))
  return usableFields.value.filter(field => !activeFields.has(field.field))
})

const pendingFieldToAdd = ref<string | null>(null)

function confirmAddFilter() {
  if (!pendingFieldToAdd.value) return
  const schemaField = filterSchema.fields.value?.find(field => field.field === pendingFieldToAdd.value)
  if (!schemaField) return
  const next: EtfFilterState =
    schemaField.kind === 'numeric'
      ? { field: schemaField.field, kind: 'numeric', min: null, max: null }
      : { field: schemaField.field, kind: 'categorical', values: [] }
  screener.addFilter(next)
  pendingFieldToAdd.value = null
}

const columnOptions = computed(() => usableFields.value)

const sortableColumns = computed(() => screener.columns.value)

function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!order) {
    screener.setSort(null, 'desc')
    return
  }
  screener.setSort(prop, order === 'ascending' ? 'asc' : 'desc')
}

function formatCellValue(field: string, value: string | number | boolean | null): string {
  if (value === null) return '－'
  const schemaField = filterSchema.fields.value?.find(item => item.field === field)
  if (schemaField?.kind === 'categorical') return String(value)
  if (typeof value !== 'number') return String(value)
  if (field === 'aum' || field === 'nav' || field === 'dcaAmount' || field === 'statutoryAumThreshold') {
    return value.toLocaleString('zh-TW')
  }
  // expenseRatio/return* — shown as-is with a % suffix per the schema's own label wording
  // ("總費用率"/"近1年報酬率" etc); this value's exact scale (e.g. whether it's already a
  // percent number or needs ×100) hasn't been independently cross-checked against a known
  // real fund's public figure — if a number here looks implausible, that's worth confirming
  // with analysis-ts/sitca-ts directly rather than rescaling client-side on a guess.
  return `${value}%`
}

onMounted(() => {
  screener.search()
})
</script>

<template>
  <div class="etf-screener-panel">
    <div class="etf-screener-panel__filters">
      <p class="etf-screener-panel__section-title">篩選條件</p>

      <div v-if="screener.filters.value.length" class="etf-screener-panel__filter-list">
        <div v-for="filter in screener.filters.value" :key="filter.field" class="etf-screener-panel__filter-row">
          <span class="etf-screener-panel__filter-label">{{ filterSchema.fieldLabel(filter.field) }}</span>

          <template v-if="filter.kind === 'numeric'">
            <el-input-number v-model="filter.min" placeholder="最小" :controls="false" size="small" />
            <span class="etf-screener-panel__filter-sep">～</span>
            <el-input-number v-model="filter.max" placeholder="最大" :controls="false" size="small" />
          </template>
          <el-select
            v-else
            v-model="filter.values"
            multiple
            collapse-tags
            placeholder="選擇條件"
            size="small"
            class="etf-screener-panel__filter-select"
          >
            <el-option
              v-for="value in filterSchema.fields.value?.find(field => field.field === filter.field)?.values ?? []"
              :key="value"
              :label="value"
              :value="value"
            />
          </el-select>

          <el-button :icon="Close" circle size="small" text @click="screener.removeFilter(filter.field)" />
        </div>
      </div>

      <div class="etf-screener-panel__add-filter">
        <el-select v-model="pendingFieldToAdd" placeholder="新增篩選條件" filterable size="small" class="etf-screener-panel__add-select">
          <el-option v-for="field in availableFieldsToAdd" :key="field.field" :label="field.label" :value="field.field" />
        </el-select>
        <el-button :icon="Plus" size="small" :disabled="!pendingFieldToAdd" @click="confirmAddFilter">新增</el-button>
        <el-button size="small" text :disabled="!screener.filters.value.length" @click="screener.resetFilters(); screener.search()">
          清除全部
        </el-button>
      </div>

      <div class="etf-screener-panel__columns">
        <p class="etf-screener-panel__section-title">顯示欄位</p>
        <el-select v-model="screener.columns.value" multiple collapse-tags size="small" class="etf-screener-panel__column-select">
          <el-option v-for="field in columnOptions" :key="field.field" :label="field.label" :value="field.field" />
        </el-select>
      </div>

      <el-button type="primary" :loading="screener.pending.value" @click="screener.search()">搜尋</el-button>
    </div>

    <p v-if="screener.errorMessage.value" class="etf-screener-panel__error">
      查詢失敗：{{ screener.errorMessage.value }}
    </p>

    <template v-else-if="screener.searched.value">
      <p class="etf-screener-panel__count">共 {{ screener.count.value }} 檔符合條件</p>
      <el-table
        v-loading="screener.pending.value"
        :data="screener.rows.value"
        size="small"
        @sort-change="onSortChange"
      >
        <el-table-column label="代號" prop="symbol" min-width="90" fixed />
        <el-table-column label="名稱" prop="shortName" min-width="140" fixed />
        <el-table-column
          v-for="field in sortableColumns"
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
        class="etf-screener-panel__pagination"
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
.etf-screener-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.etf-screener-panel__filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.etf-screener-panel__section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.etf-screener-panel__filter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.etf-screener-panel__filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.etf-screener-panel__filter-label {
  min-width: 110px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.etf-screener-panel__filter-sep {
  color: var(--el-text-color-placeholder);
}

.etf-screener-panel__filter-select {
  width: 260px;
}

.etf-screener-panel__add-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.etf-screener-panel__add-select {
  width: 240px;
}

.etf-screener-panel__columns {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.etf-screener-panel__column-select {
  width: 100%;
}

.etf-screener-panel__error {
  color: var(--el-color-danger);
  font-size: 16px;
}

.etf-screener-panel__count {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.etf-screener-panel__pagination {
  justify-content: center;
}
</style>
