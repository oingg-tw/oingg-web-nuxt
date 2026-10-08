<script setup lang="ts">
import { Plus, Close, Search } from '@element-plus/icons-vue'
import type { EtfFilterState } from '~/composables/etf/useEtfScreener'

// 上面那個 PresetFolder 的內容（etf-zone.vue）：目前條件組的條件編輯器。比個股篩選的條件 UI 簡單、也不共用它：個股的欄位全是
// 數值，ETF 的 GET /etf-screener/filters 另有類別型欄位（market／assetClass／isActive／distributionFrequency／
// belowStatutoryThreshold），所以這裡自己處理兩種。
const filters = defineModel<EtfFilterState[]>('filters', { required: true })

const emit = defineEmits<{
  search: []
}>()

const filterSchema = useEtfFilterSchema()

const usableFields = computed(() => filterSchema.fields.value ?? [])

const availableFieldsToAdd = computed(() => {
  const activeFields = new Set(filters.value.map(filter => filter.field))
  return usableFields.value.filter(field => !activeFields.has(field.field))
})

// 依型錄的分類分組（2026-09-11，schema 從平的清單改成分類）；已經全部用掉的分類不列
const availableFieldsByCategory = computed(() => {
  const availableKeys = new Set(availableFieldsToAdd.value.map(field => field.field))
  return (filterSchema.categories.value ?? [])
    .map(category => ({ ...category, fields: category.fields.filter(field => availableKeys.has(field.field)) }))
    .filter(category => category.fields.length > 0)
})

// 從平的 <el-select> 升級成完整對話框（「改成 完整彈窗，為了人類用戶的UIUX」）。不是抄 OrganismIndicatorPicker：ETF 的 schema 是
// 平的 category→field，沒有指標／期別那一層，所以自己做一個較簡單的搜尋＋分組格。
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
          <el-input-number v-model="filter.min" placeholder="最小" :controls="false" :aria-label="`${filterSchema.fieldLabel(filter.field)} 最小值`" />
          <span class="etf-filter-editor__sep">～</span>
          <el-input-number v-model="filter.max" placeholder="最大" :controls="false" :aria-label="`${filterSchema.fieldLabel(filter.field)} 最大值`" />
          <span v-if="filterSchema.fields.value?.find(f => f.field === filter.field)?.unit" class="etf-filter-editor__unit">
            {{ filterSchema.fields.value?.find(f => f.field === filter.field)?.unit }}
          </span>
        </template>
        <el-select
          v-else
          v-model="filter.values"
          multiple
          collapse-tags
          :aria-label="filterSchema.fieldLabel(filter.field)"
          placeholder="選擇條件"
          class="etf-filter-editor__select"
        >
          <el-option
            v-for="value in filterSchema.fields.value?.find(field => field.field === filter.field)?.values ?? []"
            :key="value"
            :label="value"
            :value="value"
          />
        </el-select>

        <el-button :icon="Close" circle text :aria-label="`移除${filterSchema.fieldLabel(filter.field)}條件`" @click="removeFilter(filter.field)" />
      </div>
    </div>

    <div class="etf-filter-editor__add">
      <el-button :icon="Plus" @click="openPicker">新增篩選條件</el-button>
      <el-button text :disabled="!filters.length" @click="filters = []; emit('search')">清除全部</el-button>
      <el-button type="primary" @click="emit('search')">搜尋</el-button>
    </div>

    <el-dialog v-model="pickerVisible" title="新增篩選條件" width="min(560px, 92vw)" align-center>
      <el-input
        v-model="pickerSearch"
        placeholder="搜尋欄位名稱"
        aria-label="搜尋欄位名稱"
        clearable
        :prefix-icon="Search"
        class="etf-filter-editor__picker-search"
      />
      <div class="etf-filter-editor__picker-body">
        <template v-for="category in filteredFieldsByCategory" :key="category.categoryKey">
          <h3 class="etf-filter-editor__picker-category">{{ category.categoryDisplayName }}</h3>
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
        <p v-if="!filteredFieldsByCategory.length" class="etf-filter-editor__picker-empty" role="status">找不到符合的欄位</p>
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

/* 限高＋自己捲：五個分類一律全展開（沒有手風琴），對話框才不會長過視窗。 */
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

/* 真正的 <button>，不是 click-div——全站可點選的挑選項目都照 AA 基準做。 */
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
