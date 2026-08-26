<script setup lang="ts">
import { Close, Plus, Search } from '@element-plus/icons-vue'

const router = useRouter()
const { data: schema } = useFilterSchema()
const { results, resultColumns, loading, searched, search } = useFilterSearch()
const { save: saveColumns } = useScreenerColumns()
const { slots, addSlot, clearSlot, criteria } = useFilterSlots()

// The result columns are arbitrary "<metricKey>.<fieldKey>" strings from the /filters
// catalog (see useFilterSchema) — there's no fixed Stock shape on this page anymore, the
// BFF only ever returns exactly the columns last saved via PUT /screener/columns.
interface ResultColumnChoice {
  field: string
  label: string
}

const columns = ref<ResultColumnChoice[]>([])

function handleRemoveColumn(field: string) {
  columns.value = columns.value.filter(column => column.field !== field)
}

async function handleSearch() {
  await saveColumns(columns.value.map(column => column.field))
  await search(criteria.value)
}

// One shared picker dialog, driven by the same /filters catalog everywhere it's used —
// `pickerMode` decides whether a selection fills a condition slot or adds a results column.
const pickerVisible = ref(false)
const pickerMode = ref<'condition' | 'column'>('condition')
const activeSlotId = ref<number | null>(null)

function openConditionPicker(id: number) {
  activeSlotId.value = id
  pickerMode.value = 'condition'
  pickerVisible.value = true
}

function openColumnPicker() {
  pickerMode.value = 'column'
  pickerVisible.value = true
}

function handleSelect(fieldId: string, fieldLabel: string) {
  if (pickerMode.value === 'condition') {
    if (activeSlotId.value === null) return
    const slot = slots.value.find(item => item.id === activeSlotId.value)
    if (slot) {
      slot.fieldId = fieldId
      slot.fieldLabel = fieldLabel
    }
    return
  }

  if (!columns.value.some(column => column.field === fieldId)) {
    columns.value.push({ field: fieldId, label: fieldLabel })
  }
}
</script>

<template>
  <div class="screener-page">
    <h1 class="screener-page__title">選股篩選</h1>

    <div class="screener-page__grid">
      <StockFilterSlotCard
        v-for="(slot, index) in slots"
        :key="slot.id"
        v-model:min="slot.min"
        v-model:max="slot.max"
        v-model:exclude="slot.exclude"
        :index="index"
        :field-label="slot.fieldLabel"
        @open-picker="openConditionPicker(slot.id)"
        @clear="clearSlot(slot.id)"
      />

      <button type="button" class="screener-page__add-slot" @click="addSlot">
        <el-icon><Plus /></el-icon>
        <span>新增條件</span>
      </button>
    </div>

    <div class="screener-page__actions">
      <el-button type="primary" :icon="Search" :loading="loading" @click="handleSearch">搜尋</el-button>
    </div>

    <StockFilterIndicatorDialog
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      @select="handleSelect"
    />

    <template v-if="searched">
      <el-table
        :data="results"
        row-key="symbol"
        stripe
        class="screener-page__table"
        @row-click="row => router.push(`/stock/${row.symbol}`)"
      >
        <el-table-column prop="symbol" label="代號" width="100" fixed />
        <el-table-column v-for="column in columns" :key="column.field" align="right" min-width="120">
          <template #header>
            <span class="screener-page__column-header">
              {{ column.label }}
              <el-icon
                class="screener-page__column-remove"
                title="移除欄位"
                @click.stop="handleRemoveColumn(column.field)"
              >
                <Close />
              </el-icon>
            </span>
          </template>
          <template #default="{ row }">
            <span>{{ row.values[column.field] ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column width="48" align="center">
          <template #header>
            <el-button :icon="Plus" circle text size="small" title="新增欄位" @click.stop="openColumnPicker" />
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!results.length" class="screener-page__result-note">沒有符合條件的股票</p>
      <p v-else class="screener-page__result-note">
        顯示欄位：{{ resultColumns.map(c => c.fieldName).join('、') || '（尚未設定顯示欄位）' }}
      </p>
    </template>
    <el-empty v-else description="設定篩選條件後按下搜尋" />
  </div>
</template>

<style scoped>
.screener-page {
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.screener-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.screener-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.screener-page__add-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 96px;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 13px;
}

.screener-page__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.screener-page__actions {
  display: flex;
  justify-content: flex-end;
}

.screener-page__table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-page__column-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.screener-page__column-remove {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.screener-page__column-remove:hover {
  color: var(--el-color-danger);
}

.screener-page__result-note {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
