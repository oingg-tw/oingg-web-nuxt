<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import type { FilterCategory } from '~/composables/useFilterSchema'
import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'
import type { ScreenerPreset } from '~/composables/useScreenerPresets'

const router = useRouter()
const { data: schema } = useFilterSchema()
const currentUser = useCurrentUser()
const { list, create, update, remove, run } = useScreenerPresets()
const { save: saveColumns } = useScreenerColumns()

// Each tab is an independent, backend-persisted preset (POST /screener/presets on
// creation) — switching tabs never re-fetches, since every tab keeps its own last-run
// results until its own "搜尋" is pressed again.
interface TabFilterSlot {
  id: number
  fieldId: string | null
  fieldLabel: string | null
  min: number | null
  max: number | null
  exclude: boolean
}

// Display columns (GET/PUT /screener/columns) are actually one global per-user slot on
// the backend, not per-preset — but the UI still treats each tab as remembering its own
// "last viewed" column set, purely client-side: right before a tab searches, its own
// columns get PUT to that shared slot and then that tab's run reflects them. Switching
// tabs never touches the backend at all, just re-displays whatever that tab cached.
interface ResultColumnChoice {
  field: string
  label: string
}

interface ScreenerTab {
  id: number
  name: string
  slots: TabFilterSlot[]
  columns: ResultColumnChoice[]
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  loading: boolean
  searched: boolean
  renaming: boolean
  renameDraft: string
}

// One shared picker dialog — `pickerMode` decides whether a selection fills a condition
// slot or adds a results column, both always on `activeTab`.
const pickerVisible = ref(false)
const pickerMode = ref<'condition' | 'column'>('condition')
const activeTab = ref<ScreenerTab | null>(null)
const activeSlotId = ref<number | null>(null)

function openConditionPicker(tab: ScreenerTab, slotId: number) {
  activeTab.value = tab
  activeSlotId.value = slotId
  pickerMode.value = 'condition'
  pickerVisible.value = true
}

function openColumnPicker(tab: ScreenerTab) {
  activeTab.value = tab
  pickerMode.value = 'column'
  pickerVisible.value = true
}

function handleSelect(fieldId: string, fieldLabel: string) {
  if (!activeTab.value) return

  if (pickerMode.value === 'condition') {
    const slot = activeTab.value.slots.find(item => item.id === activeSlotId.value)
    if (slot) {
      slot.fieldId = fieldId
      slot.fieldLabel = fieldLabel
    }
    return
  }

  if (!activeTab.value.columns.some(column => column.field === fieldId)) {
    activeTab.value.columns.push({ field: fieldId, label: fieldLabel })
  }
}

function handleRemoveColumn(tab: ScreenerTab, field: string) {
  tab.columns = tab.columns.filter(column => column.field !== field)
}

// Looked up by name/key rather than hardcoded, since the exact "<metricKey>.<fieldKey>"
// string depends on how the BFF's /filters catalog actually names it.
const ROE_PATTERN = /roe|股東權益報酬率|權益報酬率/i

function findRoeField(categories: FilterCategory[]) {
  for (const category of categories) {
    for (const metric of category.metrics) {
      for (const field of metric.fields) {
        if (
          ROE_PATTERN.test(field.key) ||
          ROE_PATTERN.test(field.name) ||
          ROE_PATTERN.test(metric.key) ||
          ROE_PATTERN.test(metric.name)
        ) {
          return { fieldId: `${metric.key}.${field.key}`, fieldLabel: field.name }
        }
      }
    }
  }
  return null
}

function labelForField(fieldId: string): string {
  if (!schema.value) return fieldId
  for (const category of schema.value.categories) {
    for (const metric of category.metrics) {
      for (const field of metric.fields) {
        if (`${metric.key}.${field.key}` === fieldId) return field.name
      }
    }
  }
  return fieldId
}

const MIN_EMPTY_SLOTS = 6

function buildSlots(filters: FilterCriterion[]): TabFilterSlot[] {
  let nextId = 0
  const filled = filters.map(filter => ({
    id: nextId++,
    fieldId: filter.field,
    fieldLabel: labelForField(filter.field),
    min: filter.min,
    max: filter.max,
    exclude: filter.exclude
  }))
  const empties = Array.from({ length: Math.max(MIN_EMPTY_SLOTS - filled.length, 1) }, () => ({
    id: nextId++,
    fieldId: null,
    fieldLabel: null,
    min: null,
    max: null,
    exclude: false
  }))
  return [...filled, ...empties]
}

function presetToTab(preset: ScreenerPreset): ScreenerTab {
  return {
    id: preset.id,
    name: preset.name,
    slots: buildSlots(preset.filters ?? []),
    // The backend has no per-preset column storage, so a freshly loaded tab (including
    // after a page reload) starts with no remembered columns until it's searched again
    // in this session.
    columns: [],
    results: [],
    resultColumns: [],
    loading: false,
    searched: false,
    renaming: false,
    renameDraft: preset.name
  }
}

const tabs = ref<ScreenerTab[]>([])
const activeTabId = ref('')
let hasLoadedTabs = false

async function addTab() {
  const name = `未命名 ${tabs.value.length + 1}`
  const initialFilters: FilterCriterion[] = []
  // Only the very first preset a user ever gets defaults to ROE > 30 — later tabs start
  // blank, since by then it's a deliberate new preset rather than the page's first run.
  if (!tabs.value.length && schema.value) {
    const roe = findRoeField(schema.value.categories)
    if (roe) initialFilters.push({ field: roe.fieldId, min: 30, max: null, exclude: false })
  }

  const preset = await create(name, initialFilters)
  if (!preset) {
    ElMessage.error('新增分頁失敗')
    return
  }
  const tab = presetToTab(preset)
  tabs.value.push(tab)
  activeTabId.value = String(tab.id)
}

async function removeTab(id: number) {
  // Belt-and-braces: the close icon is already hidden via :closable when this is the
  // last tab, but guard the handler too in case it's ever reachable another way.
  if (tabs.value.length <= 1) return

  const ok = await remove(id)
  if (!ok) {
    ElMessage.error('刪除分頁失敗')
    return
  }
  const index = tabs.value.findIndex(tab => tab.id === id)
  if (index === -1) return
  tabs.value.splice(index, 1)
  if (activeTabId.value === String(id)) {
    const fallback = tabs.value[Math.max(index - 1, 0)]
    activeTabId.value = fallback ? String(fallback.id) : ''
  }
  if (!tabs.value.length) await addTab()
}

function handleTabEdit(targetName: string | number | undefined, action: 'add' | 'remove') {
  if (action === 'add') {
    addTab()
    return
  }
  if (targetName !== undefined) removeTab(Number(targetName))
}

function startRename(tab: ScreenerTab) {
  tab.renameDraft = tab.name
  tab.renaming = true
}

async function commitRename(tab: ScreenerTab) {
  const trimmed = tab.renameDraft.trim()
  tab.renaming = false
  if (!trimmed || trimmed === tab.name) return
  const updated = await update(tab.id, { name: trimmed })
  tab.name = updated?.name ?? trimmed
}

function addSlot(tab: ScreenerTab) {
  const nextId = tab.slots.reduce((max, slot) => Math.max(max, slot.id), -1) + 1
  tab.slots.push({ id: nextId, fieldId: null, fieldLabel: null, min: null, max: null, exclude: false })
}

function clearSlot(tab: ScreenerTab, slotId: number) {
  const slot = tab.slots.find(item => item.id === slotId)
  if (!slot) return
  slot.fieldId = null
  slot.fieldLabel = null
  slot.min = null
  slot.max = null
  slot.exclude = false
}

async function handleSearch(tab: ScreenerTab) {
  if (!currentUser.value) {
    ElMessage.warning('請先登入後再使用選股篩選')
    return
  }

  tab.loading = true
  tab.searched = true
  try {
    const filters: FilterCriterion[] = tab.slots
      .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null)
      .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))

    // Sync this tab's own columns into the shared /screener/columns slot and this tab's
    // saved conditions before running it — GET .../run takes no params of its own, it
    // just reflects whatever was last PUT/PATCHed.
    await saveColumns(tab.columns.map(column => column.field))
    await update(tab.id, { filters })
    const result = await run(tab.id)
    if (result) {
      tab.results = result.results
      tab.resultColumns = result.columns
    } else {
      tab.results = []
      tab.resultColumns = []
    }
  } finally {
    tab.loading = false
  }
}

watch(
  currentUser,
  async user => {
    if (!user) {
      tabs.value = []
      activeTabId.value = ''
      hasLoadedTabs = false
      return
    }
    if (hasLoadedTabs) return
    hasLoadedTabs = true

    const presets = await list()
    if (presets.length) {
      tabs.value = presets.map(presetToTab)
    } else {
      await addTab()
    }
    activeTabId.value = tabs.value[0] ? String(tabs.value[0].id) : ''
  },
  { immediate: true }
)
</script>

<template>
  <div class="screener-page">
    <h1 class="screener-page__title">選股篩選</h1>

    <el-empty v-if="!currentUser" description="請先登入以使用選股篩選（篩選組合會依帳號儲存）" />

    <!-- Tabs come first: the workflow is filter once per tab, then use tabs mainly to
         switch which columns you're viewing the resulting list through. -->
    <el-tabs v-else v-model="activeTabId" type="card" editable class="screener-page__tabs" @edit="handleTabEdit">
      <el-tab-pane v-for="tab in tabs" :key="tab.id" :name="String(tab.id)" :closable="tabs.length > 1">
        <template #label>
          <span class="screener-tab__label" @dblclick.stop="startRename(tab)">
            <el-input
              v-if="tab.renaming"
              v-model="tab.renameDraft"
              size="small"
              class="screener-tab__rename-input"
              autofocus
              @click.stop
              @keyup.enter="commitRename(tab)"
              @blur="commitRename(tab)"
            />
            <span v-else>{{ tab.name }}</span>
          </span>
        </template>

        <div class="screener-page__grid">
          <StockFilterSlotCard
            v-for="(slot, index) in tab.slots"
            :key="slot.id"
            v-model:min="slot.min"
            v-model:max="slot.max"
            v-model:exclude="slot.exclude"
            :index="index"
            :field-label="slot.fieldLabel"
            @open-picker="openConditionPicker(tab, slot.id)"
            @clear="clearSlot(tab, slot.id)"
          />

          <button type="button" class="screener-page__add-slot" @click="addSlot(tab)">
            <el-icon><Plus /></el-icon>
            <span>新增條件</span>
          </button>
        </div>

        <div class="screener-page__actions">
          <el-button type="primary" :icon="Search" :loading="tab.loading" @click="handleSearch(tab)">搜尋</el-button>
        </div>

        <div class="screener-page__columns">
          <span class="screener-page__columns-label">顯示欄位</span>
          <el-tag v-for="column in tab.columns" :key="column.field" closable @close="handleRemoveColumn(tab, column.field)">
            {{ column.label }}
          </el-tag>
          <el-button :icon="Plus" size="small" text @click="openColumnPicker(tab)">新增欄位</el-button>
        </div>

        <template v-if="tab.searched">
          <el-table
            :data="tab.results"
            row-key="symbol"
            stripe
            class="screener-page__table"
            @row-click="row => router.push(`/stock/${row.symbol}`)"
          >
            <el-table-column prop="symbol" label="代號" width="100" fixed />
            <el-table-column
              v-for="column in tab.resultColumns"
              :key="column.field"
              :label="column.fieldName"
              align="right"
              min-width="120"
            >
              <template #default="{ row }">
                <span>{{ row.values[column.field] ?? '—' }}</span>
              </template>
            </el-table-column>
          </el-table>
          <p v-if="!tab.results.length" class="screener-page__result-note">沒有符合條件的股票</p>
        </template>
        <el-empty v-else description="設定篩選條件後按下搜尋" />
      </el-tab-pane>
    </el-tabs>

    <StockFilterIndicatorDialog
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      @select="handleSelect"
    />
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

.screener-page__columns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.screener-page__columns-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.screener-page__tabs {
  --el-tabs-header-height: 40px;
}

/* By default .el-tabs__header is `justify-content: space-between` and its nav-wrap
   stretches to fill the row, so the "+" new-tab button ends up pinned to the far right
   of the whole tab bar instead of sitting next to the last tab. Let nav-wrap size to its
   own content and left-align the two so "+" hugs the last tab. */
.screener-page__tabs :deep(.el-tabs__header) {
  justify-content: flex-start;
}

.screener-page__tabs :deep(.el-tabs__nav-wrap) {
  flex: initial;
}

.screener-tab__label {
  display: inline-flex;
  align-items: center;
}

.screener-tab__rename-input {
  width: 100px;
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
  margin: 12px 0;
}

.screener-page__table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-page__result-note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
