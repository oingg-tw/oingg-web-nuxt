<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import type { StockColumnDef, StockColumnKey, StockTableExtraColumn } from '~/composables/useStocks'

const { data: schema } = useFilterSchema()
const { columns } = useStocks()
const { results, loading, searched, search } = useFilterSearch()
const { slots, addSlot, clearSlot, criteria } = useFilterSlots()

const RESULT_COLUMN_KEYS: StockColumnKey[] = ['price', 'per', 'dividendYield', 'pbr']
const resultColumns = ref<StockColumnDef[]>(RESULT_COLUMN_KEYS.map(key => columns.find(column => column.key === key)!))
const extraColumns = ref<StockTableExtraColumn[]>([])

function handleSearch() {
  search(criteria.value)
}

function handleRemoveColumn(key: StockColumnKey) {
  resultColumns.value = resultColumns.value.filter(column => column.key !== key)
}

function handleRemoveExtraColumn(key: string) {
  extraColumns.value = extraColumns.value.filter(column => column.key !== key)
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

  if (!extraColumns.value.some(column => column.key === fieldId)) {
    extraColumns.value.push({ key: fieldId, label: fieldLabel })
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

    <StockTable
      v-if="searched"
      class="screener-page__table"
      :stocks="results"
      :columns="resultColumns"
      :extra-columns="extraColumns"
      :removable="false"
      customizable-columns
      @add-column-click="openColumnPicker"
      @remove-column="handleRemoveColumn"
      @remove-extra-column="handleRemoveExtraColumn"
    />
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
</style>
