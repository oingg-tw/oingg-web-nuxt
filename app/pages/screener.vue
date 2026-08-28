<script setup lang="ts">
import { Close, Plus } from '@element-plus/icons-vue'
import type { Directive } from 'vue'
import type { InputInstance } from 'element-plus'
import type { FilterCategory } from '~/composables/useFilterSchema'
import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'
import type { ScreenerPreset } from '~/composables/useScreenerPresets'

function labelNewTabButton(el: HTMLElement, label: string) {
  const button = el.querySelector<HTMLElement>('.el-tabs__new-tab')
  if (!button) return
  button.setAttribute('role', 'button')
  button.setAttribute('aria-label', label)
}

// El Plus's "+" new-tab control renders as a bare, unlabeled <div> (tabindex + click/Enter
// handlers only) — there's no prop or slot to attach role/aria-label to that wrapper, so
// patch it in imperatively instead. Vue's patcher only diffs attributes it's tracking, so
// an attribute set outside that stays put across re-renders as long as the node persists
// (it does here — `editable` never toggles, so the button is never torn down and rebuilt).
const vNewTabA11y: Directive<HTMLElement, string> = {
  mounted: (el, binding) => labelNewTabButton(el, binding.value),
  updated: (el, binding) => labelNewTabButton(el, binding.value)
}

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
//
// A slot's field is fixed at creation time — picked via StockFilterIndicatorDialog when
// adding it, never changed afterwards — so fieldId/fieldLabel are never null here; there
// are no more empty placeholder slots to fill in later.
interface TabFilterSlot {
  id: number
  fieldId: string
  fieldLabel: string
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

// One shared picker dialog — `pickerMode` decides whether a selection creates a new
// condition slot or adds a results column, both always on `activeTab`. Picking a field
// only ever *creates* something now (see handleSelect below) — there's no more "editing
// an existing slot's field" case, so this doesn't need to track which slot is active.
const pickerVisible = ref(false)
const pickerMode = ref<'condition' | 'column'>('condition')
const activeTab = ref<ScreenerTab | null>(null)

function openAddConditionPicker(tab: ScreenerTab) {
  activeTab.value = tab
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
    // Picking a field here always creates a brand-new condition — the field is fixed
    // for the rest of its life once added; only its range can change after this,
    // through the popover on its own pill.
    const nextId = tab.slots.reduce((max, slot) => Math.max(max, slot.id), -1) + 1
    tab.slots.push({ id: nextId, fieldId, fieldLabel, min: null, max: null, exclude: false })
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

// Column-presets are a global, per-user catalog with no ownership tie to any one filter
// preset — a filter preset holds only its conditions, a column-preset holds only a
// display configuration (which columns, i.e. what the table shows), and neither belongs
// to the other. Deliberately NOT rendered as a second row of tabs nested inside each
// filter tab's pane: tabs-within-tabs visually reads as "these column-presets belong to
// this filter tab," which would misrepresent them as scoped/exclusive when they're
// actually shared across every filter tab. A plain dropdown carries no such implication.
// Which one a given filter tab is currently *viewing* its results through is still
// tracked per filter tab (tab.columnPresetId) — that part is legitimately per-tab, it's
// just a selection, not ownership — matching the server's own per-preset "last viewed
// column-preset" memory. "預設" is an always-present option standing in for
// columnPresetId = null (the server's own fallback chain: this preset's last view → the
// user's isDefault column-preset → system built-ins).
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

function buildSlots(filters: FilterCriterion[]): TabFilterSlot[] {
  return filters.map((filter, index) => ({
    id: index,
    fieldId: filter.field,
    fieldLabel: labelForField(filter.field),
    min: filter.min,
    max: filter.max,
    exclude: filter.exclude
  }))
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

// No more 搜尋 button — a tab searches itself automatically whenever its actual filter
// criteria change (field, min, max, exclude; adding/removing an empty slot doesn't
// count). Debounced so typing a number doesn't fire a request per keystroke, and
// cancellable so a pending one doesn't fire after its tab is gone.
const AUTO_SEARCH_DELAY_MS = 600
const autoSearchControllers = new Map<number, { stopWatch: () => void; trigger: { cancel: () => void } }>()

function watchTabForAutoSearch(tab: ScreenerTab) {
  const trigger = debounce(() => {
    if (currentUser.value) handleSearch(tab)
  }, AUTO_SEARCH_DELAY_MS)

  const stopWatch = watch(
    () =>
      JSON.stringify(
        tab.slots.map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))
      ),
    () => trigger()
  )

  autoSearchControllers.set(tab.id, { stopWatch, trigger })
}

function stopAutoSearch(tabId: number) {
  const controller = autoSearchControllers.get(tabId)
  if (!controller) return
  controller.stopWatch()
  controller.trigger.cancel()
  autoSearchControllers.delete(tabId)
}

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
    watchTabForAutoSearch(tab)

    // Run it immediately so the default ROE condition actually filters right away
    // instead of waiting for the auto-search debounce or an edit to trigger it.
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
  stopAutoSearch(id)
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

function removeSlot(tab: ScreenerTab, slotId: number) {
  tab.slots = tab.slots.filter(slot => slot.id !== slotId)
}

async function handleSearch(tab: ScreenerTab) {
  if (!currentUser.value) {
    ElMessage.warning('請先登入後再使用選股篩選')
    return
  }

  const filters: FilterCriterion[] = tab.slots.map(slot => ({
    field: slot.fieldId,
    min: slot.min,
    max: slot.max,
    exclude: slot.exclude
  }))

  // The backend requires at least one filter (`filters` must be non-empty) — block here
  // instead of round-tripping to hit that same rejection.
  if (!filters.length) {
    ElMessage.warning('請至少設定一個篩選條件')
    return
  }

  // Captured before the flag flips below: was this tab already searched at least once
  // this session, i.e. does tab.columns actually reflect its backing column-preset's real
  // fields? On a tab's very first search (freshly loaded from a reload, or a brand-new
  // tab before its first run), tab.columns is still the empty placeholder from
  // presetToTab — syncing that would PATCH a real, non-null column-preset down to zero
  // columns, wiping out whatever it actually had saved server-side.
  const alreadySearched = tab.searched

  tab.loading = true
  tab.searched = true
  try {
    await update(tab.id, { filters })

    // Belt-and-braces: column edits already sync themselves immediately, this just covers
    // a tab that's already bound to a real column-preset (fields may be stale server-side
    // otherwise) and already known-accurate (see alreadySearched above). Also skipped
    // while still on "預設" (columnPresetId null) — tab.columns there is just a read-only
    // view of whatever the server resolved as the default, not something the user
    // configured, so syncing it would lazily create a brand-new "顯示欄位 N" preset out of
    // it and silently switch the tab off "預設" on the next filter edit, even though no
    // column was ever touched.
    if (alreadySearched && tab.columnPresetId !== null) await syncColumnPreset(tab)

    const wasOnDefaultColumnPreset = tab.columnPresetId === null
    const result = await run(tab.id, tab.columnPresetId ?? undefined)
    // Filters just (potentially) changed, so every other cached column view for this tab
    // could now be showing the wrong stock list — drop them all and keep just this fresh
    // one; the rest will refetch naturally next time they're actually switched to.
    tab.columnViewCache = {}
    if (result) {
      tab.results = result.results
      tab.resultColumns = result.columns
      // Reconcile with whatever the server actually applied — but only when the tab was
      // already pinned to a concrete column-preset (e.g. one that's since been deleted
      // server-side and fell back to something else). When the tab is intentionally on
      // "預設" (null), the server always resolves that to *some* real id (this preset's
      // last view, the user's isDefault column-preset, or a system built-in) — adopting
      // that id here would silently flip the second-row tab away from "預設" to whatever
      // it resolved to on every filter edit, even though nothing about columns changed.
      if (!wasOnDefaultColumnPreset) tab.columnPresetId = result.columnPresetId
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

// A tab only auto-searches when its filter criteria actually *change* (see
// watchTabForAutoSearch) — nothing re-runs one whose filters are simply sitting there
// unchanged, which is exactly the state every tab loaded from a reload starts in (and
// there's no manual 搜尋 button anymore to fall back on). Losing the previous session's
// cached results across a refresh is fine; leaving the tab permanently blank until some
// unrelated edit happens to fire the watcher is not — so fetch once here whenever a tab
// becomes active and hasn't been searched yet this session. Skips tabs with no filter set
// so switching to (or reloading into) a genuinely empty tab doesn't immediately pop the
// "請至少設定一個篩選條件" warning.
watch(activeTabId, id => {
  if (!id) return
  const tab = tabs.value.find(item => String(item.id) === id)
  if (!tab || tab.searched || tab.loading) return
  if (!tab.slots.length) return
  handleSearch(tab)
})

watch(
  currentUser,
  async user => {
    if (!user) {
      for (const tab of tabs.value) stopAutoSearch(tab.id)
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
      for (const tab of tabs.value) watchTabForAutoSearch(tab)
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
    <el-tabs
      v-else
      v-model="activeTabId"
      type="card"
      editable
      class="screener-page__tabs"
      v-new-tab-a11y="'新增分頁'"
      @edit="handleTabEdit"
    >
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
            v-for="slot in tab.slots"
            :key="slot.id"
            v-model:min="slot.min"
            v-model:max="slot.max"
            v-model:exclude="slot.exclude"
            :field-label="slot.fieldLabel"
            @remove="removeSlot(tab, slot.id)"
          />

          <button type="button" class="screener-page__add-slot" @click="openAddConditionPicker(tab)">
            <el-icon><Plus /></el-icon>
            <span>新增條件</span>
          </button>
        </div>

        <!-- A plain dropdown, not tabs — these column-presets are a global catalog with
             no ownership tie to this (or any) filter tab, just a per-tab choice of which
             one to currently view results through. -->
        <div class="screener-page__column-select">
          <span class="screener-page__column-select-label">顯示欄位</span>
          <el-select
            :model-value="columnTabName(tab)"
            size="small"
            class="screener-page__column-select-control"
            popper-class="screener-page__column-select-dropdown"
            @change="name => handleColumnTabChange(tab, name)"
          >
            <el-option value="default" label="預設" />
            <el-option v-for="option in columnPresetOptions" :key="option.id" :value="String(option.id)" :label="option.name">
              <div class="screener-page__column-option">
                <span class="screener-page__column-option-name">{{ option.name }}</span>
                <el-icon
                  class="screener-page__column-option-remove"
                  title="刪除欄位組合"
                  @click.stop="removeColumnPresetOption(tab, option.id)"
                >
                  <Close />
                </el-icon>
              </div>
            </el-option>
          </el-select>
          <el-button
            :icon="Plus"
            size="small"
            circle
            title="新增欄位組合"
            aria-label="新增欄位組合"
            @click="addColumnPresetOption(tab)"
          />
        </div>

        <!-- Always rendered (not gated behind tab.searched) so columns can be set up via
             the trailing "+" header before the first search too — el-table just shows its
             own empty state until there's anything in tab.results. v-loading overlays a
             spinner without changing this block's height, so a search starting/finishing
             never shifts the page the way a separate "搜尋中" line did. -->
        <StockScreenerResultTable
          v-loading="tab.loading"
          :rows="tab.results"
          :columns="tab.columns"
          class="screener-page__table"
          @reorder="fields => handleReorderColumns(tab, fields)"
          @remove-column="field => handleRemoveColumn(tab, field)"
          @add-column-click="openColumnPicker(tab)"
          @row-click="symbol => router.push(`/stock/${symbol}`)"
        />
        <p v-if="tab.searched && !tab.results.length" class="screener-page__result-note">沒有符合條件的股票</p>
        <p v-else-if="!tab.searched" class="screener-page__result-note">設定篩選條件即可自動搜尋</p>
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
  width: 100%;
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

/* The gap above this row is deliberately bigger than any other spacing in the pane —
   that's the only cue marking "篩選" (condition slots above) and "檢視" (this row plus
   the result table below) as two separate blocks. Plain whitespace, not a wrapping div. */
.screener-page__column-select {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  margin-bottom: 8px;
}

.screener-page__column-select-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.screener-page__column-select-control {
  width: 180px;
}

/* el-select's small size drops to 12px, under the 16px minimum body-text floor — force
   it back up. Its dropdown teleports to <body>, out of scoped styles' reach entirely,
   hence popper-class + the matching unscoped rule below. */
.screener-page__column-select-control :deep(.el-select__wrapper),
.screener-page__column-select-control :deep(.el-select__placeholder) {
  font-size: 16px;
}

.screener-page__column-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.screener-page__column-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screener-page__column-option-remove {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.screener-page__column-option-remove:hover {
  color: var(--el-color-danger);
}

/* By default .el-tabs__header is `justify-content: space-between` and its nav-wrap
   stretches to fill the row, so the "+" new-tab button ends up pinned to the far right
   of the whole tab bar instead of sitting next to the last tab. Let nav-wrap size to its
   own content and left-align the two so "+" hugs the last tab. */
.screener-page__tabs :deep(.el-tabs__header) {
  justify-content: flex-start;
  border-bottom: none;
}

.screener-page__tabs :deep(.el-tabs__nav-wrap) {
  flex: initial;
}

/* Chrome's tab strip rather than a boxed card: drop the card type's border around the
   whole nav and the shared edges between items, and give each tab real breathing room
   from its neighbors instead of sitting flush against them — so the row reads as a
   line of flat, individually-rounded buttons with a "+" always trailing at the end. */
.screener-page__tabs :deep(.el-tabs__nav) {
  border: none !important;
  border-radius: 0;
  gap: 6px;
}

/* Every tab keeps a real outline at rest — without one, an unselected tab is just
   floating text with no visual cue that it's a clickable button at all. */
.screener-page__tabs :deep(.el-tabs__item) {
  margin: 0 !important;
  border: 1px solid var(--el-border-color) !important;
  border-radius: 8px;
  color: var(--el-text-color-regular);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.screener-page__tabs :deep(.el-tabs__item:hover) {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-hover);
  color: var(--el-text-color-primary);
}

.screener-page__tabs :deep(.el-tabs__item.is-active) {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  font-weight: 600;
}

.screener-page__tabs :deep(.el-tabs__item:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

/* Its own bordered button (matching the tabs it sits beside), sized up from El Plus's
   default 20px so it isn't the one washed-out element in an otherwise clear row of
   buttons — and set a little apart from the last tab, the way Chrome's "+" is. */
.screener-page__tabs :deep(.el-tabs__new-tab) {
  width: 28px;
  height: 28px;
  margin: 0 0 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  color: var(--el-text-color-regular);
  font-size: 16px;
}

.screener-page__tabs :deep(.el-tabs__new-tab:hover) {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.screener-page__tabs :deep(.el-tabs__new-tab:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

/* El Plus's card-tab close icon defaults to width:0 (hidden) and grows to 14px on hover
   or when active, shifting the tab's width/padding as it does. Reserve that space at all
   times and only toggle opacity instead, so hovering never changes tab width. Kept dimly
   visible at rest (not opacity: 0) — fully invisible meant a double-click landing near the
   tab's right edge silently deleted it on the first click, with no visual cue for what was
   actually clicked. */
.screener-page__tabs :deep(.el-tabs__item.is-closable) {
  padding-left: 13px !important;
  padding-right: 13px !important;
}

.screener-page__tabs :deep(.el-tabs__item.is-closable .is-icon-close) {
  width: 14px !important;
  opacity: 0.35;
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* Stacked top-to-bottom instead of wrapping chips, each pill spanning the full row
   width — see the matching filter-pill__label override in StockFilterSlotCard.vue that
   lets the label segment grow to fill that width instead of staying content-sized. */
@media (max-width: 767px) {
  .screener-page__grid {
    flex-direction: column;
    align-items: stretch;
  }
}

.screener-page__add-slot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 12px;
  border: 1px dashed var(--el-border-color);
  /* Matches the filter pills' squarish rounded corners rather than a capsule shape. */
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}

.screener-page__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.screener-page__table :deep(.el-table__row) {
  cursor: pointer;
}

.screener-page__result-note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
</style>

<style>
/* Unscoped on purpose — el-select teleports its dropdown to <body>, so a scoped (or
   :deep()) selector rooted in this component can never reach it. */
.screener-page__column-select-dropdown .el-select-dropdown__item {
  font-size: 16px;
}
</style>
