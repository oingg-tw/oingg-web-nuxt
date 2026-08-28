<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import type { InputInstance } from 'element-plus'
import type { FilterCategory } from '~/composables/useFilterSchema'
import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'
import type { ScreenerPreset } from '~/composables/useScreenerPresets'

const router = useRouter()
const { data: schema } = useFilterSchema()
const currentUser = useCurrentUser()
const { list, create, update, remove, run } = useScreenerPresets()
const {
  list: listColumnPresets,
  create: createColumnPreset,
  update: updateColumnPreset,
  remove: removeColumnPresetApi
} = useScreenerColumnPresets()

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

// Display columns are their own saved resource (/screener/column-presets), separate from
// filter presets. Each screener tab gets its own backing column-preset, created lazily
// the first time the tab has any columns to show — `columnPresetId` tracks it so later
// edits PATCH the same one instead of creating duplicates. The server also remembers a
// preset's last-viewed columnPresetId on its own, so after any run this gets reconciled
// to whatever the server says was actually applied (which may already be set from a
// previous session, even before this tab has been searched here).
interface ResultColumnChoice {
  field: string
  label: string
}

// One fetched column view — this tab's results/columns as seen through one particular
// column-preset. Cached per tab so flipping back and forth between column-preset tabs
// re-displays instantly instead of re-hitting the API every time.
interface ScreenerColumnView {
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  columns: ResultColumnChoice[]
}

interface ScreenerTab {
  id: number
  name: string
  slots: TabFilterSlot[]
  columns: ResultColumnChoice[]
  columnPresetId: number | null
  // Keyed by columnViewCacheKey(columnPresetId) — 'default' for null. tab.columns /
  // tab.results / tab.resultColumns always mirror whichever entry columnPresetId
  // currently points to; the cache is the source of truth for everything not currently
  // on screen, so re-selecting a previously-viewed column-preset is a pure local swap.
  columnViewCache: Record<string, ScreenerColumnView>
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  loading: boolean
  searched: boolean
  renaming: boolean
  renameDraft: string
}

function columnViewCacheKey(columnPresetId: number | null) {
  return columnPresetId === null ? 'default' : String(columnPresetId)
}

// Writes the tab's current on-screen columns/results back into its own cache slot —
// call this after anything that changes what's displayed for the active column-preset,
// so switching away and back reflects the latest edit without needing to refetch.
function cacheCurrentColumnView(tab: ScreenerTab) {
  tab.columnViewCache[columnViewCacheKey(tab.columnPresetId)] = {
    results: tab.results,
    resultColumns: tab.resultColumns,
    columns: tab.columns
  }
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

// Any edit to a tab's columns (add/remove/reorder) pushes straight to its backing
// column-preset immediately, rather than waiting for the next 搜尋 — creating it lazily
// on first use (i.e. the first edit made while still on "預設", since that one has no
// real resource of its own to patch), patching it from then on.
async function syncColumnPreset(tab: ScreenerTab) {
  const fields = tab.columns.map(column => column.field)
  if (tab.columnPresetId === null) {
    if (!fields.length) return
    const name = `顯示欄位 ${columnPresetOptions.value.length + 1}`
    const created = await createColumnPreset(name, fields)
    if (!created) return
    columnPresetOptions.value.push({ id: created.id, name: created.name })
    tab.columnPresetId = created.id
    return
  }
  await updateColumnPreset(tab.columnPresetId, { fields })
}

async function handleSelect(fieldId: string, fieldLabel: string) {
  if (!activeTab.value) return
  const tab = activeTab.value

  if (pickerMode.value === 'condition') {
    const slot = tab.slots.find(item => item.id === activeSlotId.value)
    if (slot) {
      slot.fieldId = fieldId
      slot.fieldLabel = fieldLabel
    }
    return
  }

  if (tab.columns.some(column => column.field === fieldId)) return
  tab.columns.push({ field: fieldId, label: fieldLabel })
  await syncColumnPreset(tab)
  // Fetch data for the newly added column right away instead of leaving it showing
  // placeholders until the next manual search — only once this tab already has results
  // to refresh, so adding a column before ever searching doesn't force a premature
  // "set a filter first" warning. handleSearch already re-caches on completion; this
  // covers the case where nothing's been searched yet.
  if (tab.searched) await handleSearch(tab)
  else cacheCurrentColumnView(tab)
}

async function handleRemoveColumn(tab: ScreenerTab, field: string) {
  tab.columns = tab.columns.filter(column => column.field !== field)
  tab.resultColumns = tab.resultColumns.filter(column => column.field !== field)
  cacheCurrentColumnView(tab)
  await syncColumnPreset(tab)
}

async function handleReorderColumns(tab: ScreenerTab, fields: string[]) {
  const byField = new Map(tab.columns.map(column => [column.field, column]))
  tab.columns = fields.map(field => byField.get(field)).filter((column): column is ResultColumnChoice => !!column)
  cacheCurrentColumnView(tab)
  await syncColumnPreset(tab)
}

// Column-presets are a global, per-user catalog (not scoped to one screener preset), so
// this same list of options is shown as a second row of tabs inside every filter tab's
// pane — but which one is selected is tracked per filter tab (tab.columnPresetId),
// matching the server's own per-preset "last viewed column-preset" memory. "預設" is an
// always-present, non-closable option standing in for columnPresetId = null (the
// server's own fallback chain: this preset's last view → the user's isDefault
// column-preset → system built-ins).
interface ColumnPresetOption {
  id: number
  name: string
}

const columnPresetOptions = ref<ColumnPresetOption[]>([])

function columnTabName(tab: ScreenerTab) {
  return tab.columnPresetId === null ? 'default' : String(tab.columnPresetId)
}

// Switching which column-preset a tab is viewing needs a fresh run (different fields
// need different data from the server) but never touches filters or PATCHes any
// column-preset's own field list — that's the picker/header-driven editing flows above.
// Already-fetched column views are cached per tab (see columnViewCache), so switching
// back and forth between column-preset tabs never re-hits the API for one it's already
// pulled down this session.
async function switchColumnPreset(tab: ScreenerTab, columnPresetId: number | null) {
  // Only skip as a genuine no-op — matching the target AND already having fetched
  // something for it. Otherwise a tab that was never actually searched yet (e.g. right
  // after a reload, still sitting at its initial columnPresetId: null/empty columns) would
  // silently do nothing when clicking "預設", since that already "matches" its unfetched
  // starting state — showing nothing but 代號 forever until some other tab is clicked first.
  if (columnPresetId === tab.columnPresetId && tab.searched) return

  const cacheKey = columnViewCacheKey(columnPresetId)
  const cached = tab.columnViewCache[cacheKey]
  if (cached) {
    tab.columnPresetId = columnPresetId
    tab.results = cached.results
    tab.resultColumns = cached.resultColumns
    tab.columns = cached.columns
    tab.searched = true
    return
  }

  tab.loading = true
  try {
    const result = await run(tab.id, columnPresetId ?? undefined)
    if (!result) {
      ElMessage.error('切換欄位組合失敗')
      return
    }
    tab.columnPresetId = columnPresetId
    tab.results = result.results
    tab.resultColumns = result.columns
    tab.columns = result.columns.map(column => ({ field: column.field, label: column.fieldName }))
    tab.searched = true
    cacheCurrentColumnView(tab)
  } catch (error) {
    if (import.meta.dev) console.error('[screener] failed to switch column view', error)
    ElMessage.error('切換欄位組合失敗')
  } finally {
    tab.loading = false
  }
}

async function handleColumnTabChange(tab: ScreenerTab, name: string | number) {
  await switchColumnPreset(tab, name === 'default' ? null : Number(name))
}

async function addColumnPresetOption(tab: ScreenerTab) {
  const name = `欄位組合 ${columnPresetOptions.value.length + 1}`
  const created = await createColumnPreset(name, [])
  if (!created) {
    ElMessage.error('新增欄位組合失敗')
    return
  }
  columnPresetOptions.value.push({ id: created.id, name: created.name })
  await switchColumnPreset(tab, created.id)
}

async function removeColumnPresetOption(tab: ScreenerTab, name: string | number) {
  const id = Number(name)
  const ok = await removeColumnPresetApi(id)
  if (!ok) {
    ElMessage.error('刪除欄位組合失敗')
    return
  }
  columnPresetOptions.value = columnPresetOptions.value.filter(option => option.id !== id)

  // Deleting is global — any tab that had this selected falls back to 預設, but only the
  // tab this was actually clicked from needs an immediate refetch; the rest reconcile
  // next time they're searched or switched to.
  const wasActive = tab.columnPresetId === id
  for (const otherTab of tabs.value) {
    if (otherTab.columnPresetId === id) otherTab.columnPresetId = null
  }
  if (wasActive) await switchColumnPreset(tab, null)
}

function handleColumnTabEdit(tab: ScreenerTab, targetName: string | number | undefined, action: 'add' | 'remove') {
  if (action === 'add') {
    addColumnPresetOption(tab)
    return
  }
  if (targetName !== undefined && targetName !== 'default') removeColumnPresetOption(tab, targetName)
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
    // The preset itself carries its last-viewed column-preset id (confirmed via a real
    // run response), so this survives a reload even before the tab is searched again —
    // only the actual column tags stay empty until then, since GET /screener/presets
    // doesn't also echo back that column-preset's own field list.
    columns: [],
    columnPresetId: preset.lastColumnPresetId ?? null,
    columnViewCache: {},
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
  // Every new tab defaults to ROE > 30 as a starting condition.
  if (schema.value) {
    const roe = findRoeField(schema.value.categories)
    if (roe) initialFilters.push({ field: roe.fieldId, min: 30, max: null, exclude: false })
  }

  const preset = await create(name, initialFilters)
  if (!preset) {
    ElMessage.error('新增分頁失敗')
    return
  }

  try {
    const tab = presetToTab(preset)
    // Reassign rather than push: the created preset is already saved server-side at this
    // point, so if anything below throws, tabs.value should still end up holding it.
    tabs.value = [...tabs.value, tab]
    activeTabId.value = String(tab.id)

    // Run it immediately so the default ROE condition actually filters right away
    // instead of just sitting there waiting for a manual 搜尋 click.
    await handleSearch(tab)
  } catch (error) {
    // The preset is already created on the backend at this point (a refresh would show
    // it) — this only means something went wrong turning it into a tab on screen, so
    // surface it instead of leaving a silent unhandled rejection.
    if (import.meta.dev) console.error('[screener] failed to add the new tab to the page', error)
    ElMessage.error('分頁已建立，但畫面顯示失敗，請重新整理')
  }
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

// Collected by Vue into an array since it's bound inside the tabs v-for — at most one
// entry exists at a time (see the exclusivity guard below), so [0] is always the input
// currently being edited, if any.
const renameInputRef = ref<InputInstance[]>([])

function startRename(tab: ScreenerTab) {
  // Only one tab can be renaming at once, otherwise this ref would collect more than one
  // input and .focus() below wouldn't know which to target.
  for (const other of tabs.value) {
    if (other !== tab) other.renaming = false
  }
  tab.renameDraft = tab.name
  tab.renaming = true
  // `autofocus` on a v-if-toggled el-input isn't reliably applied by the browser, and
  // without real focus the @blur below never fires on an outside click — leaving rename
  // mode stuck open. Focus it explicitly once it's actually mounted.
  nextTick(() => renameInputRef.value[0]?.focus())
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

  const filters: FilterCriterion[] = tab.slots
    .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null)
    .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))

  // The backend requires at least one filter (`filters` must be non-empty) — block here
  // instead of round-tripping to hit that same rejection.
  if (!filters.length) {
    ElMessage.warning('請至少設定一個篩選條件')
    return
  }

  tab.loading = true
  tab.searched = true
  try {
    await update(tab.id, { filters })

    // Belt-and-braces: column edits already sync themselves immediately, this just
    // covers a tab that's never had one and still has nothing configured (in which case
    // the run below falls through to whatever the server already has on file, or its
    // system defaults).
    await syncColumnPreset(tab)

    const result = await run(tab.id, tab.columnPresetId ?? undefined)
    // Filters just (potentially) changed, so every other cached column view for this tab
    // could now be showing the wrong stock list — drop them all and keep just this fresh
    // one; the rest will refetch naturally next time they're actually switched to.
    tab.columnViewCache = {}
    if (result) {
      tab.results = result.results
      tab.resultColumns = result.columns
      // Reconcile with whatever the server actually applied — it may already remember a
      // columnPresetId for this tab from a previous session even if we didn't send one.
      tab.columnPresetId = result.columnPresetId
      tab.columns = result.columns.map(column => ({ field: column.field, label: column.fieldName }))
      cacheCurrentColumnView(tab)
    } else {
      tab.results = []
      tab.resultColumns = []
    }
  } catch (error) {
    // update()/createColumnPreset()/run() already catch their own request failures and
    // return null — reaching here means something more fundamental broke (e.g. a hung
    // Firebase token refresh past its timeout), so this is worth surfacing rather than
    // leaving the user looking at a spinner that quietly reset with no explanation.
    if (import.meta.dev) console.error('[screener] search failed', error)
    ElMessage.error('搜尋失敗，請稍後再試')
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
      columnPresetOptions.value = []
      hasLoadedTabs = false
      return
    }
    if (hasLoadedTabs) return
    hasLoadedTabs = true

    const [presets, columnPresets] = await Promise.all([list(), listColumnPresets()])
    columnPresetOptions.value = columnPresets.map(preset => ({ id: preset.id, name: preset.name }))

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
              ref="renameInputRef"
              v-model="tab.renameDraft"
              size="small"
              class="screener-tab__rename-input"
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

        <!-- A second row of tabs, scoped to this filter tab, for switching which saved
             column-preset the table below is viewing. The options themselves are a
             global per-user catalog (same list in every filter tab's pane), but which
             one is selected here is tracked per filter tab. -->
        <el-tabs
          :model-value="columnTabName(tab)"
          type="card"
          editable
          class="screener-page__tabs screener-page__column-tabs"
          @tab-change="name => handleColumnTabChange(tab, name)"
          @edit="(name, action) => handleColumnTabEdit(tab, name, action)"
        >
          <el-tab-pane name="default" label="預設" :closable="false" />
          <el-tab-pane v-for="option in columnPresetOptions" :key="option.id" :name="String(option.id)" :label="option.name" />
        </el-tabs>

        <!-- Always rendered (not gated behind tab.searched) so columns can be set up via
             the trailing "+" header before the first search too — el-table just shows its
             own empty state until there's anything in tab.results. -->
        <StockScreenerResultTable
          :rows="tab.results"
          :columns="tab.columns"
          class="screener-page__table"
          @reorder="fields => handleReorderColumns(tab, fields)"
          @remove-column="field => handleRemoveColumn(tab, field)"
          @add-column-click="openColumnPicker(tab)"
          @row-click="symbol => router.push(`/stock/${symbol}`)"
        />
        <p v-if="tab.searched && !tab.results.length" class="screener-page__result-note">沒有符合條件的股票</p>
        <p v-else-if="!tab.searched" class="screener-page__result-note">設定篩選條件後按下搜尋</p>
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

.screener-page__tabs {
  --el-tabs-header-height: 40px;
}

.screener-page__column-tabs {
  --el-tabs-header-height: 32px;
  margin-bottom: 8px;
}

.screener-page__column-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
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

/* El Plus's card-tab close icon defaults to width:0 (hidden) and grows to 14px on hover
   or when active, shifting the tab's width/padding as it does. Reserve that space at all
   times and only toggle opacity instead, so hovering never changes tab width. */
.screener-page__tabs :deep(.el-tabs__item.is-closable) {
  padding-left: 13px !important;
  padding-right: 13px !important;
}

.screener-page__tabs :deep(.el-tabs__item.is-closable .is-icon-close) {
  width: 14px !important;
  opacity: 0;
}

.screener-page__tabs :deep(.el-tabs__item.is-closable:hover .is-icon-close),
.screener-page__tabs :deep(.el-tabs__item.is-closable.is-active .is-icon-close) {
  opacity: 1;
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
