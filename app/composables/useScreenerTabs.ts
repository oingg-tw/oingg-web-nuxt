import type { FilterCategory } from '~/composables/useFilterSchema'
import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'
import type { ScreenerPreset } from '~/composables/useScreenerPresets'

// Each tab is an independent, backend-persisted preset (POST /screener/presets on
// creation) — switching tabs never re-fetches, since every tab keeps its own last-run
// results until its own filters change again.
//
// A slot's field is fixed at creation time — picked via StockFilterIndicatorDialog when
// adding it, never changed afterwards — so fieldId/fieldLabel are never null here; there
// are no more empty placeholder slots to fill in later.
export interface TabFilterSlot {
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
export interface ResultColumnChoice {
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

export interface ScreenerTab {
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

// Column-presets are a global, per-user catalog with no ownership tie to any one filter
// preset — a filter preset holds only its conditions, a column-preset holds only a
// display configuration (which columns, i.e. what the table shows), and neither belongs
// to the other. "預設" is an always-present option standing in for columnPresetId = null
// (the server's own fallback chain: this preset's last view → the user's isDefault
// column-preset → system built-ins).
export interface ColumnPresetOption {
  id: number
  name: string
}

// Never a real backend preset id (those are positive DB ids) — safe as a sentinel for the
// one local-only tab a signed-out visitor gets. Filtering works without an account; only
// saving a filter set as a named preset (which this tab never does) requires signing in.
export const GUEST_TAB_ID = -1

function columnViewCacheKey(columnPresetId: number | null) {
  return columnPresetId === null ? 'default' : String(columnPresetId)
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

const AUTO_SEARCH_DELAY_MS = 600

// Owns every screener tab's state — filter conditions, result rows, and which
// column-preset each tab is currently viewed through — plus the shared add-condition/
// add-column picker dialog. Composed by screener.vue with ScreenerPresetTabs (the tab
// strip + condition slots) and ScreenerResultPanel (the column-select + result table),
// which each mutate the same ScreenerTab objects returned here rather than round-tripping
// every field through props.
export function useScreenerTabs() {
  const { data: schema } = useFilterSchema()
  const currentUser = useCurrentUser()
  const { open: openLogin } = useLoginDialog()
  const { create, update, remove, run, runAnonymous, list } = useScreenerPresets()
  const {
    list: listColumnPresets,
    create: createColumnPreset,
    update: updateColumnPreset,
    remove: removeColumnPresetApi
  } = useScreenerColumnPresets()

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

  function createGuestTab(): ScreenerTab {
    const slots: TabFilterSlot[] = []
    if (schema.value) {
      const roe = findRoeField(schema.value.categories)
      if (roe) slots.push({ id: 0, fieldId: roe.fieldId, fieldLabel: roe.fieldLabel, min: 30, max: null, exclude: false })
    }
    return {
      id: GUEST_TAB_ID,
      name: '選股篩選',
      slots,
      columns: [],
      columnPresetId: null,
      columnViewCache: {},
      results: [],
      resultColumns: [],
      loading: false,
      searched: false,
      renaming: false,
      renameDraft: '選股篩選'
    }
  }

  function isGuestTab(tab: ScreenerTab) {
    return tab.id === GUEST_TAB_ID
  }

  const tabs = ref<ScreenerTab[]>([])
  const guestTab = ref<ScreenerTab | null>(null)
  // What the page actually renders as tabs: the signed-in user's real (backend-persisted)
  // tabs, or — signed out — just the one local guestTab. Kept as a single list so the
  // tabs markup doesn't need two near-duplicate branches.
  const displayedTabs = computed<ScreenerTab[]>(() => (currentUser.value ? tabs.value : guestTab.value ? [guestTab.value] : []))
  const activeTabId = ref('')
  let hasLoadedTabs = false

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

  // No more 搜尋 button — a tab searches itself automatically whenever its actual filter
  // criteria change (field, min, max, exclude; adding/removing an empty slot doesn't
  // count). Debounced so typing a number doesn't fire a request per keystroke, and
  // cancellable so a pending one doesn't fire after its tab is gone.
  const autoSearchControllers = new Map<number, { stopWatch: () => void; trigger: { cancel: () => void } }>()

  function watchTabForAutoSearch(tab: ScreenerTab) {
    // handleSearch itself branches on whether this is the guest tab (anonymous request, no
    // login required) or a real preset-backed tab (login required, and already re-checked
    // there) — no need to gate on currentUser here too.
    const trigger = debounce(() => handleSearch(tab), AUTO_SEARCH_DELAY_MS)

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

  // Any edit to a tab's columns (add/remove/reorder) pushes straight to its backing
  // column-preset immediately, rather than waiting for the next search — creating it
  // lazily on first use (i.e. the first edit made while still on "預設", since that one
  // has no real resource of its own to patch), patching it from then on.
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

  async function handleSearch(tab: ScreenerTab) {
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

    // The guest tab isn't backed by any preset — POST /screener runs the filters directly,
    // no login and no PATCH/column-preset bookkeeping needed.
    if (isGuestTab(tab)) {
      tab.loading = true
      tab.searched = true
      try {
        const result = await withTimeout(runAnonymous(filters), 12_000, '搜尋逾時')
        if (result) {
          tab.results = result.results
          tab.resultColumns = result.columns
          tab.columns = result.columns.map(column => ({ field: column.field, label: column.fieldName }))
        } else {
          tab.results = []
          tab.resultColumns = []
        }
      } catch (error) {
        if (import.meta.dev) console.error('[screener] guest search failed', error)
        ElMessage.error('搜尋失敗，請稍後再試')
      } finally {
        tab.loading = false
      }
      return
    }

    if (!currentUser.value) {
      ElMessage.warning('請先登入後再使用選股篩選')
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
    const debugLabel = `[screener] tab ${tab.id} search`
    if (import.meta.dev) console.time(debugLabel)
    try {
      // Every request inside this already has its own timeout (getIdToken at 10s, each
      // $fetch at 15s) that resolves to null/throws rather than hanging — but this outer
      // bound is a hard guarantee that tab.loading always clears within a fixed window no
      // matter what, even if something inside turns out not to be as airtight as intended.
      await withTimeout(
        (async () => {
          await update(tab.id, { filters })

          // Belt-and-braces: column edits already sync themselves immediately, this just
          // covers a tab that's already bound to a real column-preset (fields may be stale
          // server-side otherwise) and already known-accurate (see alreadySearched above).
          // Also skipped while still on "預設" (columnPresetId null) — tab.columns there is
          // just a read-only view of whatever the server resolved as the default, not
          // something the user configured, so syncing it would lazily create a brand-new
          // "顯示欄位 N" preset out of it and silently switch the tab off "預設" on the next
          // filter edit, even though no column was ever touched.
          if (alreadySearched && tab.columnPresetId !== null) {
            await syncColumnPreset(tab)
          }

          const wasOnDefaultColumnPreset = tab.columnPresetId === null
          const result = await run(tab.id, tab.columnPresetId ?? undefined)
          // Filters just (potentially) changed, so every other cached column view for this
          // tab could now be showing the wrong stock list — drop them all and keep just
          // this fresh one; the rest will refetch naturally next time they're switched to.
          tab.columnViewCache = {}
          if (result) {
            tab.results = result.results
            tab.resultColumns = result.columns
            // Reconcile with whatever the server actually applied — but only when the tab
            // was already pinned to a concrete column-preset (e.g. one that's since been
            // deleted server-side and fell back to something else). When the tab is
            // intentionally on "預設" (null), the server always resolves that to *some*
            // real id (this preset's last view, the user's isDefault column-preset, or a
            // system built-in) — adopting that id here would silently flip the tab away
            // from "預設" to whatever it resolved to on every filter edit, even though
            // nothing about columns changed.
            if (!wasOnDefaultColumnPreset) tab.columnPresetId = result.columnPresetId
            tab.columns = result.columns.map(column => ({ field: column.field, label: column.fieldName }))
            cacheCurrentColumnView(tab)
          } else {
            tab.results = []
            tab.resultColumns = []
          }
        })(),
        12_000,
        '搜尋逾時'
      )
    } catch (error) {
      // update()/createColumnPreset()/run() already catch their own request failures and
      // return null — reaching here means something more fundamental broke (e.g. a hung
      // Firebase token refresh past its timeout, or the 12s outer bound above firing), so
      // this is worth surfacing rather than leaving the user looking at a spinner that
      // quietly reset with no explanation.
      if (import.meta.dev) console.error('[screener] search failed', error)
      ElMessage.error('搜尋失敗，請稍後再試')
    } finally {
      tab.loading = false
      if (import.meta.dev) console.timeEnd(debugLabel)
    }
  }

  // Switching which column-preset a tab is viewing needs a fresh run (different fields
  // need different data from the server) but never touches filters or PATCHes any
  // column-preset's own field list — that's the picker/header-driven editing flows below.
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

  const columnPresetOptions = ref<ColumnPresetOption[]>([])

  async function addColumnPresetOption(tab: ScreenerTab) {
    if (!currentUser.value) {
      openLogin()
      return
    }

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

  // One shared picker dialog — `pickerMode` decides whether a selection creates a new
  // condition slot or adds a results column, both always on `activeTab`. Picking a field
  // only ever *creates* something now — there's no more "editing an existing slot's
  // field" case, so this doesn't need to track which slot is active.
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
    // placeholders until the next filter edit — only once this tab already has results
    // to refresh, so adding a column before ever searching doesn't force a premature
    // "set a filter first" warning. handleSearch already re-caches on completion; this
    // covers the case where nothing's been searched yet.
    if (tab.searched) await handleSearch(tab)
    else cacheCurrentColumnView(tab)
  }

  function removeSlot(tab: ScreenerTab, slotId: number) {
    tab.slots = tab.slots.filter(slot => slot.id !== slotId)
  }

  async function addTab() {
    // The "+" new-tab control is reachable before login (see ScreenerPresetTabs), since
    // creating a screener preset is exactly the action that should prompt registration.
    if (!currentUser.value) {
      openLogin()
      return
    }

    const name = `未命名 ${tabs.value.length + 1}`
    const initialFilters: FilterCriterion[] = []
    // Every new tab defaults to ROE > 30 as a starting condition.
    if (schema.value) {
      const roe = findRoeField(schema.value.categories)
      if (roe) initialFilters.push({ field: roe.fieldId, min: 30, max: null, exclude: false })
    }

    // POST /screener/presets no longer takes a name — the backend assigns its own default,
    // so the desired "未命名 N" label is applied with a separate rename PATCH right after.
    const preset = await create(initialFilters)
    if (!preset) {
      ElMessage.error('新增分頁失敗')
      return
    }

    try {
      const tab = presetToTab(preset)
      tab.name = name
      tab.renameDraft = name
      // Reassign rather than push: the created preset is already saved server-side at this
      // point, so if anything below throws, tabs.value should still end up holding it.
      tabs.value = [...tabs.value, tab]
      activeTabId.value = String(tab.id)
      watchTabForAutoSearch(tab)

      await update(tab.id, { name })

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

  // A tab only auto-searches when its filter criteria actually *change* (see
  // watchTabForAutoSearch) — nothing re-runs one whose filters are simply sitting there
  // unchanged, which is exactly the state every tab loaded from a reload starts in (and
  // there's no manual search button to fall back on). Losing the previous session's
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
        columnPresetOptions.value = []
        hasLoadedTabs = false

        // A fresh local guest tab every time we drop to signed-out (including on first
        // load, since currentUser starts null until Firebase resolves) — filtering works
        // without an account; only saving it as a named preset requires signing in.
        stopAutoSearch(GUEST_TAB_ID)
        const tab = createGuestTab()
        guestTab.value = tab
        watchTabForAutoSearch(tab)
        activeTabId.value = String(GUEST_TAB_ID)
        if (tab.slots.length) await handleSearch(tab)
        return
      }

      guestTab.value = null
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

  return {
    displayedTabs,
    activeTabId,
    columnPresetOptions,
    pickerVisible,
    pickerMode,
    addTab,
    removeTab,
    removeSlot,
    openAddConditionPicker,
    openColumnPicker,
    handleSelect,
    handleColumnTabChange,
    addColumnPresetOption,
    removeColumnPresetOption,
    handleReorderColumns,
    handleRemoveColumn,
    isGuestTab
  }
}
