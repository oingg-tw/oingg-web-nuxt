<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import type { StockColumnKey } from '~/composables/useStocks'

const { data: schema } = useFilterSchema()
const { columns } = useStocks()
const { results, loading, searched, search } = useFilterSearch()
const { slots, addSlot, clearSlot, criteria } = useFilterSlots()

const RESULT_COLUMN_KEYS: StockColumnKey[] = ['price', 'per', 'dividendYield', 'pbr']
const resultColumns = computed(() => RESULT_COLUMN_KEYS.map(key => columns.find(column => column.key === key)!))

const pickerVisible = ref(false)
const activeSlotId = ref<number | null>(null)

function openPicker(id: number) {
  activeSlotId.value = id
  pickerVisible.value = true
}

function handleSelectIndicator(fieldId: string, fieldLabel: string) {
  if (activeSlotId.value === null) return
  const slot = slots.value.find(item => item.id === activeSlotId.value)
  if (slot) {
    slot.fieldId = fieldId
    slot.fieldLabel = fieldLabel
  }
}

function handleSearch() {
  search(criteria.value)
}
</script>

<template>
  <div class="filter-page">
    <h1 class="filter-page__title">選股篩選</h1>

    <div class="filter-page__grid">
      <StockFilterSlotCard
        v-for="(slot, index) in slots"
        :key="slot.id"
        v-model:min="slot.min"
        v-model:max="slot.max"
        v-model:exclude="slot.exclude"
        :index="index"
        :field-label="slot.fieldLabel"
        @open-picker="openPicker(slot.id)"
        @clear="clearSlot(slot.id)"
      />

      <button type="button" class="filter-page__add-slot" @click="addSlot">
        <el-icon><Plus /></el-icon>
        <span>新增條件</span>
      </button>
    </div>

    <div class="filter-page__actions">
      <el-button type="primary" :icon="Search" :loading="loading" @click="handleSearch">搜尋</el-button>
    </div>

    <StockFilterIndicatorDialog
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      @select="handleSelectIndicator"
    />

    <StockTable
      v-if="searched"
      class="filter-page__table"
      :stocks="results"
      :columns="resultColumns"
      :removable="false"
    />
    <el-empty v-else description="設定篩選條件後按下搜尋" />
  </div>
</template>

<style scoped>
.filter-page {
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.filter-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.filter-page__add-slot {
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

.filter-page__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.filter-page__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
