<script setup lang="ts">
import { Plus, Close, Search } from '@element-plus/icons-vue'
import { ETF_UNRELIABLE_FIELDS, type EtfFilterState } from '~/composables/etf/useEtfScreener'

// Top PresetFolder's own slot content (etf-zone.vue) — the filter-condition editor for
// whichever filter preset is currently active. Deliberately simpler than screener.vue's own
// filter UI (screener.vue has NO categorical-filter component at all — every stock-screener
// field is numeric, so MoleculeRangeEditor.vue was never built to switch on a `kind`). ETF's
// own GET /etf-screener/filters DOES return categorical fields (market/assetClass/isActive/
// distributionFrequency/belowStatutoryThreshold), so this component handles both kinds itself
// rather than trying to force-fit the stock screener's numeric-only editor.
const filters = defineModel<EtfFilterState[]>('filters', { required: true })

const emit = defineEmits<{
  search: []
}>()

const filterSchema = useEtfFilterSchema()

// expenseRatio excluded from the add-filter picker — confirmed unreliable (real sitca-ts
// source-data issue, methodology mismatch vs FundClear, still open) — see
// useEtfScreener.ts's ETF_UNRELIABLE_FIELDS comment for the full story.
const usableFields = computed(() => (filterSchema.fields.value ?? []).filter(field => !ETF_UNRELIABLE_FIELDS.includes(field.field)))

const availableFieldsToAdd = computed(() => {
  const activeFields = new Set(filters.value.map(filter => filter.field))
  return usableFields.value.filter(field => !activeFields.has(field.field))
})

// Grouped by category per direct request 2026-09-11 (relayed cross-session by analysis-ts, once
// GET /etf-screener/filters itself started returning categories instead of one flat field list —
// see useEtfFilterSchema.ts's own comment). Categories with zero remaining addable fields (every
// field in them already active as a filter) are dropped instead of rendering as an empty, useless
// group header.
const availableFieldsByCategory = computed(() => {
  const availableKeys = new Set(availableFieldsToAdd.value.map(field => field.field))
  return (filterSchema.categories.value ?? [])
    .map(category => ({ ...category, fields: category.fields.filter(field => availableKeys.has(field.field)) }))
    .filter(category => category.fields.length > 0)
})

// Escalated from a flat <el-select> (with <el-option-group> per category) to a full dialog per
// direct follow-up ("改成 完整彈窗，為了人類用戶的UIUX") — same "outgrew a small anchored/inline
// control" escalation this app has made elsewhere (StockDetailActions.vue's 顯示設定 popover→
// dialog, screener.vue's own OrganismIndicatorPicker), not a literal copy of either: OrganismIndicatorPicker's
// 3-level category→metric→field/period structure doesn't apply here (ETF's schema is flat
// category→field, no metric or period concept), so this is its own simpler search + grouped-grid
// dialog rather than reusing that component.
const pickerVisible = ref(false)
const pickerSearch = ref('')

const filteredFieldsByCategory = computed(() => {
  const query = pickerSearch.value.trim().toLowerCase()
  if (!query) return availableFieldsByCategory.value
  return availableFieldsByCategory.value
    .map(category => ({ ...category, fields: category.fields.filter(field => field.label.toLowerCase().includes(query)) }))
    .filter(category => category.fields.length > 0)
})

function openPicker() {
  pickerSearch.value = ''
  pickerVisible.value = true
}

function selectField(fieldKey: string) {
  const schemaField = filterSchema.fields.value.find(field => field.field === fieldKey)
  if (!schemaField) return
  const next: EtfFilterState =
    schemaField.kind === 'numeric'
      ? { field: schemaField.field, kind: 'numeric', min: null, max: null }
      : { field: schemaField.field, kind: 'categorical', values: [] }
  filters.value = [...filters.value, next]
  pickerVisible.value = false
}

function removeFilter(field: string) {
  filters.value = filters.value.filter(filter => filter.field !== field)
}
</script>

<template>
  <div class="etf-filter-editor">
    <div v-if="filters.length" class="etf-filter-editor__list">
      <div v-for="filter in filters" :key="filter.field" class="etf-filter-editor__row">
        <span class="etf-filter-editor__label">{{ filterSchema.fieldLabel(filter.field) }}</span>

        <template v-if="filter.kind === 'numeric'">
          <el-input-number v-model="filter.min" placeholder="最小" :controls="false" size="small" />
          <span class="etf-filter-editor__sep">～</span>
          <el-input-number v-model="filter.max" placeholder="最大" :controls="false" size="small" />
          <span v-if="filterSchema.fields.value?.find(f => f.field === filter.field)?.unit" class="etf-filter-editor__unit">
            {{ filterSchema.fields.value?.find(f => f.field === filter.field)?.unit }}
          </span>
        </template>
        <el-select
          v-else
          v-model="filter.values"
          multiple
          collapse-tags
          placeholder="選擇條件"
          size="small"
          class="etf-filter-editor__select"
        >
          <el-option
            v-for="value in filterSchema.fields.value?.find(field => field.field === filter.field)?.values ?? []"
            :key="value"
            :label="value"
            :value="value"
          />
        </el-select>

        <el-button :icon="Close" circle size="small" text @click="removeFilter(filter.field)" />
      </div>
    </div>

    <div class="etf-filter-editor__add">
      <el-button :icon="Plus" size="small" @click="openPicker">新增篩選條件</el-button>
      <el-button size="small" text :disabled="!filters.length" @click="filters = []; emit('search')">清除全部</el-button>
      <el-button type="primary" size="small" @click="emit('search')">搜尋</el-button>
    </div>

    <el-dialog v-model="pickerVisible" title="新增篩選條件" width="min(560px, 92vw)" align-center>
      <el-input
        v-model="pickerSearch"
        placeholder="搜尋欄位名稱"
        clearable
        :prefix-icon="Search"
        class="etf-filter-editor__picker-search"
      />
      <div class="etf-filter-editor__picker-body">
        <template v-for="category in filteredFieldsByCategory" :key="category.categoryKey">
          <p class="etf-filter-editor__picker-category">{{ category.categoryDisplayName }}</p>
          <div class="etf-filter-editor__picker-grid">
            <button
              v-for="field in category.fields"
              :key="field.field"
              type="button"
              class="etf-filter-editor__picker-item"
              @click="selectField(field.field)"
            >
              {{ field.label }}
            </button>
          </div>
        </template>
        <p v-if="!filteredFieldsByCategory.length" class="etf-filter-editor__picker-empty">找不到符合的欄位</p>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.etf-filter-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.etf-filter-editor__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.etf-filter-editor__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.etf-filter-editor__label {
  min-width: 110px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.etf-filter-editor__sep {
  color: var(--el-text-color-placeholder);
}

.etf-filter-editor__unit {
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.etf-filter-editor__select {
  width: 260px;
}

.etf-filter-editor__add {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.etf-filter-editor__picker-search {
  margin-bottom: 16px;
}

/* Capped height + own scroll, same reasoning StockDetailActions.vue's own 顯示卡片 picker gives
   for its own max-height — keeps the dialog itself from growing taller than the viewport once
   every category is expanded at once (no accordion here, all 5 always visible, ETF's field count
   is small enough that this is still just one modest scroll, not a wall of content). */
.etf-filter-editor__picker-body {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}

.etf-filter-editor__picker-category {
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.etf-filter-editor__picker-category:not(:first-child) {
  margin-top: 20px;
}

.etf-filter-editor__picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

/* Real <button>s, not click-divs — same AA-standing-bar discipline as every other clickable
   picker item in this app (see StockGuruBadgeCategoryCard.vue's own chip grid). */
.etf-filter-editor__picker-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.etf-filter-editor__picker-item:hover,
.etf-filter-editor__picker-item:focus-visible {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.etf-filter-editor__picker-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-placeholder);
}
</style>
