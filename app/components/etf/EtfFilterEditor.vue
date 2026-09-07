<script setup lang="ts">
import { Plus, Close } from '@element-plus/icons-vue'
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

const pendingFieldToAdd = ref<string | null>(null)

function confirmAddFilter() {
  if (!pendingFieldToAdd.value) return
  const schemaField = filterSchema.fields.value?.find(field => field.field === pendingFieldToAdd.value)
  if (!schemaField) return
  const next: EtfFilterState =
    schemaField.kind === 'numeric'
      ? { field: schemaField.field, kind: 'numeric', min: null, max: null }
      : { field: schemaField.field, kind: 'categorical', values: [] }
  filters.value = [...filters.value, next]
  pendingFieldToAdd.value = null
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
      <el-select v-model="pendingFieldToAdd" placeholder="新增篩選條件" filterable size="small" class="etf-filter-editor__add-select">
        <el-option v-for="field in availableFieldsToAdd" :key="field.field" :label="field.label" :value="field.field" />
      </el-select>
      <el-button :icon="Plus" size="small" :disabled="!pendingFieldToAdd" @click="confirmAddFilter">新增</el-button>
      <el-button size="small" text :disabled="!filters.length" @click="filters = []; emit('search')">清除全部</el-button>
      <el-button type="primary" size="small" @click="emit('search')">搜尋</el-button>
    </div>
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
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.etf-filter-editor__sep {
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

.etf-filter-editor__add-select {
  width: 240px;
}
</style>
