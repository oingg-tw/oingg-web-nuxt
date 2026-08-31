import type { FilterCategory } from '~/composables/useFilterSchema'
import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'
import type { ScreenerPreset } from '~/composables/useScreenerPresets'
import type { ScreenerTemplate } from '~/composables/useScreenerTemplates'

// Each tab is an independent, backend-persisted preset (POST /screener/presets on
// creation) — switching tabs never re-fetches, since every tab keeps its own last-run
// results until its own filters change again.
//
// A slot starts out empty (fieldId/fieldLabel null) — "新增條件" just appends one of these
// placeholders, it doesn't open anything. Tapping the placeholder's own field button is the
// one and only way to assign it a field, via ScreenerOrganismIndicatorPicker — the same
// dialog also handles swapping an already-assigned slot's field later. A slot with no field
// yet is filtered out of what actually gets sent to the search API (see handleSearch) and
// out of the auto-search watcher's dependency list, so adding one is inert until it's filled
// in.
export interface TabFilterSlot {
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
export interface ResultColumnChoice {
  field: string
  label: string
}

// One fetched column view — this tab's results/columns as seen through one particular
// column-preset. Cached per tab so flipping back and forth between column-preset tabs
// re-displays instantly instead of re-hitting the API every time. Page/pageSize/totalPages
// travel with it too, so returning to a column-preset you'd paged into earlier restores
// that same page instead of silently resetting to page 1.
interface ScreenerColumnView {
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  columns: ResultColumnChoice[]
  page: number
  pageSize: number
  totalPages: number
}

// Server-side pagination (bff-ts /screener and /screener/presets/{id}/run both take
// page/pageSize now) — page is 1-indexed. Every tab keeps its own, since each is an
// independent search against its own filters.
const DEFAULT_PAGE_SIZE = 20

export interface ScreenerTab {
  // UUID (real backend presets) or GUEST_TAB_ID (the local-only guest tab) — never a
  // sequential integer, see the comment on GUEST_TAB_ID below.
  id: string
  name: string
  slots: TabFilterSlot[]
  columns: ResultColumnChoice[]
  columnPresetId: string | null
  // Keyed by columnViewCacheKey(columnPresetId) — 'default' for null. tab.columns /
  // tab.results / tab.resultColumns always mirror whichever entry columnPresetId
  // currently points to; the cache is the source of truth for everything not currently
  // on screen, so re-selecting a previously-viewed column-preset is a pure local swap.
  columnViewCache: Record<string, ScreenerColumnView>
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  page: number
  pageSize: number
  totalPages: number
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
  id: string
  name: string
}

// Never a real backend preset id (those are UUID strings, see ScreenerTab.id above) — safe
// as a sentinel for the one local-only tab a signed-out visitor gets, since a plain word can
// never collide with a UUID's fixed hyphenated-hex format. Filtering works without an
// account; only saving a filter set as a named preset (which this tab never does) requires
// signing in.
export const GUEST_TAB_ID = 'guest'

function columnViewCacheKey(columnPresetId: string | null) {
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
  const authResolved = useAuthResolved()
  const { open: openLogin } = useLoginDialog()
  const { create, update, remove, run, runAnonymous, list, lastErrorMessage } = useScreenerPresets()
  const { list: listTemplates, apply: applyTemplate, lastErrorMessage: templateLastErrorMessage } = useScreenerTemplates()
  const {
    list: listColumnPresets,
    create: createColumnPreset,
    update: updateColumnPreset,
    remove: removeColumnPresetApi,
    lastErrorMessage: columnLastErrorMessage
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
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: 1,
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
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: 1,
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
  const activeTab = computed<ScreenerTab | null>(
    () => displayedTabs.value.find(tab => String(tab.id) === activeTabId.value) ?? null
  )
  let hasLoadedTabs = false

  // Writes the tab's current on-screen columns/results back into its own cache slot —
  // call this after anything that changes what's displayed for the active column-preset,
  // so switching away and back reflects the latest edit without needing to refetch.
  function cacheCurrentColumnView(tab: ScreenerTab) {
    tab.columnViewCache[columnViewCacheKey(tab.columnPresetId)] = {
      results: tab.results,
      resultColumns: tab.resultColumns,
      columns: tab.columns,
      page: tab.page,
      pageSize: tab.pageSize,
      totalPages: tab.totalPages
    }
  }

  // No more 搜尋 button — a tab searches itself automatically whenever its actual filter
  // criteria change (field, min, max, exclude; adding/removing an empty slot doesn't
  // count). Debounced so typing a number doesn't fire a request per keystroke, and
  // cancellable so a pending one doesn't fire after its tab is gone.
  const autoSearchControllers = new Map<string, { stopWatch: () => void; trigger: { cancel: () => void } }>()

  function watchTabForAutoSearch(tab: ScreenerTab) {
    // handleSearch itself branches on whether this is the guest tab (anonymous request, no
    // login required) or a real preset-backed tab (login required, and already re-checked
    // there) — no need to gate on currentUser here too.
    const trigger = debounce(() => handleSearch(tab), AUTO_SEARCH_DELAY_MS)

    const stopWatch = watch(
      () =>
        JSON.stringify(
          tab.slots
            .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null)
            .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))
        ),
      () => trigger()
    )

    autoSearchControllers.set(tab.id, { stopWatch, trigger })
  }

  function stopAutoSearch(tabId: string) {
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

  // `page` omitted means "this is a real search" (filters changed, or the tab's first ever
  // run) — resets to page 1 and, for a signed-in tab, PATCHes filters and re-syncs columns.
  // Passing `page` explicitly (see changePage below) means "just paginating the same
  // result set" — skips the filter PATCH/column sync entirely (nothing about the search
  // itself changed) and keeps every other cached column view intact instead of dropping
  // them, since the underlying stock list hasn't changed, only which page of it is shown.
  async function handleSearch(tab: ScreenerTab, page?: number) {
    // Empty placeholder slots (fieldId still null, waiting on ScreenerOrganismIndicatorPicker)
    // never reach the API — they're not a real criterion yet.
    const filters: FilterCriterion[] = tab.slots
      .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null)
      .map(slot => ({
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

    const targetPage = page ?? 1
    const isPageChangeOnly = page !== undefined

    // The guest tab isn't backed by any preset — POST /screener runs the filters directly,
    // no login and no PATCH/column-preset bookkeeping needed.
    if (isGuestTab(tab)) {
      tab.loading = true
      tab.searched = true
      try {
        const result = await withTimeout(
          runAnonymous(filters, { page: targetPage, pageSize: tab.pageSize }),
          12_000,
          '搜尋逾時'
        )
        if (result) {
          tab.results = result.results
          tab.resultColumns = result.columns
          tab.columns = result.columns.map(column => ({ field: column.field, label: column.fieldName }))
          tab.page = result.page
          tab.pageSize = result.pageSize
          tab.totalPages = result.totalPages
        } else {
          tab.results = []
          tab.resultColumns = []
          showErrorMessage(lastErrorMessage.value ?? '搜尋失敗，請稍後再試')
        }
      } catch (error) {
        if (import.meta.dev) console.error('[screener] guest search failed', error)
        showErrorMessage('搜尋失敗，請稍後再試')
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
          if (!isPageChangeOnly) {
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
          }

          const wasOnDefaultColumnPreset = tab.columnPresetId === null
          const result = await run(tab.id, tab.columnPresetId ?? undefined, { page: targetPage, pageSize: tab.pageSize })
          // Filters just (potentially) changed, so every other cached column view for this
          // tab could now be showing the wrong stock list — drop them all and keep just
          // this fresh one; the rest will refetch naturally next time they're switched to.
          // Skipped on a page-change-only call: the stock list itself hasn't changed, so
          // every other column-preset's cached view is still perfectly valid.
          if (!isPageChangeOnly) tab.columnViewCache = {}
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
            tab.page = result.page
            tab.pageSize = result.pageSize
            tab.totalPages = result.totalPages
            cacheCurrentColumnView(tab)
          } else {
            tab.results = []
            tab.resultColumns = []
            showErrorMessage(lastErrorMessage.value ?? '搜尋失敗，請稍後再試')
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
      showErrorMessage('搜尋失敗，請稍後再試')
    } finally {
      tab.loading = false
      if (import.meta.dev) console.timeEnd(debugLabel)
    }
  }

  async function changePage(tab: ScreenerTab, page: number) {
    if (page === tab.page) return
    await handleSearch(tab, page)
  }

  // Changing page size restarts at page 1 — "page 3 of 20/page" doesn't correspond to any
  // particular page once the size changes, so there's no sensible page to preserve.
  async function changePageSize(tab: ScreenerTab, pageSize: number) {
    if (pageSize === tab.pageSize) return
    tab.pageSize = pageSize
    await handleSearch(tab, 1)
  }

  // Switching which column-preset a tab is viewing needs a fresh run (different fields
  // need different data from the server) but never touches filters or PATCHes any
  // column-preset's own field list — that's the picker/header-driven editing flows below.
  // Already-fetched column views are cached per tab (see columnViewCache), so switching
  // back and forth between column-preset tabs never re-hits the API for one it's already
  // pulled down this session.
  async function switchColumnPreset(tab: ScreenerTab, columnPresetId: string | null) {
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
      tab.page = cached.page
      tab.pageSize = cached.pageSize
      tab.totalPages = cached.totalPages
      tab.searched = true
      return
    }

    tab.loading = true
    try {
      // Same page/pageSize as whatever this tab was already showing — switching which
      // columns are displayed doesn't change the underlying filtered stock list, so
      // staying on "page 3" (say) here is showing page 3 of that same list with different
      // fields, not restarting the search.
      const result = await run(tab.id, columnPresetId ?? undefined, { page: tab.page, pageSize: tab.pageSize })
      if (!result) {
        showErrorMessage(lastErrorMessage.value ?? '切換欄位組合失敗')
        return
      }
      tab.columnPresetId = columnPresetId
      tab.results = result.results
      tab.resultColumns = result.columns
      tab.columns = result.columns.map(column => ({ field: column.field, label: column.fieldName }))
      tab.page = result.page
      tab.pageSize = result.pageSize
      tab.totalPages = result.totalPages
      tab.searched = true
      cacheCurrentColumnView(tab)
    } catch (error) {
      if (import.meta.dev) console.error('[screener] failed to switch column view', error)
      showErrorMessage('切換欄位組合失敗')
    } finally {
      tab.loading = false
    }
  }

  async function handleColumnTabChange(tab: ScreenerTab, id: string) {
    await switchColumnPreset(tab, id === 'default' ? null : id)
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
      showErrorMessage(columnLastErrorMessage.value ?? '新增欄位組合失敗')
      return
    }
    columnPresetOptions.value.push({ id: created.id, name: created.name })
    await switchColumnPreset(tab, created.id)
  }

  async function renameColumnPreset(id: string, name: string) {
    const updated = await updateColumnPreset(id, { name })
    if (!updated) {
      showErrorMessage(columnLastErrorMessage.value ?? '重新命名失敗')
      return
    }
    const option = columnPresetOptions.value.find(item => item.id === id)
    if (option) option.name = updated.name
  }

  // Drag-reorder on the desktop tab list (see PresetFolder.vue) is a purely local, this-
  // session-only convenience — GET /screener/presets returns no order/position field to
  // persist against, so there's nothing to PATCH; the order just resets to whatever the
  // server returns on next load. Silently drops any id that isn't currently a real option
  // (the "預設" sentinel isn't draggable, so its string id shouldn't reach here at all, but
  // being defensive costs nothing).
  function reorderColumnPresets(ids: string[]) {
    const byId = new Map(columnPresetOptions.value.map(option => [option.id, option]))
    columnPresetOptions.value = ids.map(id => byId.get(id)).filter((option): option is ColumnPresetOption => !!option)
  }

  async function removeColumnPresetOption(tab: ScreenerTab, id: string) {
    const ok = await removeColumnPresetApi(id)
    if (!ok) {
      showErrorMessage(columnLastErrorMessage.value ?? '刪除欄位組合失敗')
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

  // One shared picker dialog — `pickerMode` decides whether a selection sets a condition
  // slot's field or adds a results column, both always on `pickerTargetTab` (distinct from
  // the page-level `activeTab` computed above: this tracks which tab the dialog itself is
  // currently pointed at, not which tab is on screen). In 'condition' mode it also needs
  // `pickerTargetSlotId` — the same dialog assigns a field to a fresh empty slot (see
  // addEmptySlot) and reassigns one on an already-filled slot; both are "pick a field for
  // this specific slot," never two different flows.
  const pickerVisible = ref(false)
  const pickerMode = ref<'condition' | 'column'>('condition')
  const pickerTargetTab = ref<ScreenerTab | null>(null)
  const pickerTargetSlotId = ref<number | null>(null)
  // The button that opened the picker — on desktop it's shown as a dropdown anchored to
  // this element instead of a fullscreen dialog (see OrganismIndicatorPicker's triggerEl
  // prop). Unused on mobile, which always stays fullscreen regardless of what this holds.
  const pickerTriggerEl = ref<HTMLElement | null>(null)

  // "新增條件" just appends a blank placeholder — nothing opens. The placeholder's own field
  // button is what opens the picker (openFieldPicker), matching whatever already-filled
  // pills use to change their field: one dialog, one way in, for both cases.
  function addEmptySlot(tab: ScreenerTab) {
    const nextId = tab.slots.reduce((max, slot) => Math.max(max, slot.id), -1) + 1
    tab.slots.push({ id: nextId, fieldId: null, fieldLabel: null, min: null, max: null, exclude: false })
  }

  function openFieldPicker(tab: ScreenerTab, slotId: number, triggerEl: HTMLElement) {
    pickerTargetTab.value = tab
    pickerTargetSlotId.value = slotId
    pickerTriggerEl.value = triggerEl
    pickerMode.value = 'condition'
    pickerVisible.value = true
  }

  function openColumnPicker(tab: ScreenerTab, triggerEl: HTMLElement) {
    pickerTargetTab.value = tab
    pickerTriggerEl.value = triggerEl
    pickerMode.value = 'column'
    pickerVisible.value = true
  }

  // The field already on the slot being edited, if any — so the picker dialog can jump
  // straight to that field's own 大/中/小 (category/metric) location instead of always
  // resetting to the first category. Null for a fresh empty slot (nothing to jump to yet)
  // and for the column picker (adding a column has no "current field" to speak of).
  const pickerCurrentFieldId = computed<string | null>(() => {
    if (pickerMode.value !== 'condition' || !pickerTargetTab.value) return null
    const slot = pickerTargetTab.value.slots.find(item => item.id === pickerTargetSlotId.value)
    return slot?.fieldId ?? null
  })

  async function handleSelect(fieldId: string, fieldLabel: string) {
    if (!pickerTargetTab.value) return
    const tab = pickerTargetTab.value

    if (pickerMode.value === 'condition') {
      const slot = tab.slots.find(item => item.id === pickerTargetSlotId.value)
      if (!slot) return
      // Assigning a *different* field than before — the old range no longer means anything
      // against a different metric, so it resets rather than carrying over.
      slot.fieldId = fieldId
      slot.fieldLabel = fieldLabel
      slot.min = null
      slot.max = null
      slot.exclude = false
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

  // Shared tail of both addTab and addTemplateTab below: turns an already-created (or
  // already-applied) ScreenerPreset into an on-screen tab. Reassigns tabs.value rather than
  // pushing in place: the preset is already saved server-side by the time either caller
  // reaches this, so if anything after this throws, tabs.value still ends up holding it.
  //
  // Returns the tab as read back out of tabs.value, NOT the raw object passed in — Vue only
  // tracks mutations made through the reactive proxy tabs.value wraps around each element,
  // created the first time that element is actually read through the array. Continuing to
  // mutate the original pre-registration object afterward (as this used to do, and as
  // createGuestTab's caller still did until the fix below) silently updates the underlying
  // data — a later, unrelated re-render would eventually show it correctly — but never
  // itself triggers one, so e.g. tab.loading flipping back to false after a search never
  // actually clears the spinner on screen. Callers must use the returned reference for
  // every mutation from here on, not their own local `tab`.
  function registerTab(tab: ScreenerTab): ScreenerTab {
    tabs.value = [...tabs.value, tab]
    activeTabId.value = String(tab.id)
    const registered = tabs.value[tabs.value.length - 1]!
    watchTabForAutoSearch(registered)
    return registered
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
      showErrorMessage(lastErrorMessage.value ?? '新增分頁失敗')
      return
    }

    try {
      const tab = registerTab(presetToTab(preset))
      tab.name = name
      tab.renameDraft = name

      await update(tab.id, { name })

      // Run it immediately so the default ROE condition actually filters right away
      // instead of waiting for the auto-search debounce or an edit to trigger it.
      await handleSearch(tab)
    } catch (error) {
      // The preset is already created on the backend at this point (a refresh would show
      // it) — this only means something went wrong turning it into a tab on screen, so
      // surface it instead of leaving a silent unhandled rejection.
      if (import.meta.dev) console.error('[screener] failed to add the new tab to the page', error)
      showErrorMessage('分頁已建立，但畫面顯示失敗，請重新整理')
    }
  }

  // Officially-maintained strategies (GET /screener/templates) a user can copy into their
  // own preset in one click — see useScreenerTemplates.ts. Fetched lazily, once, the first
  // time the new-tab dialog is opened (the catalog doesn't change within a session), rather
  // than on every page load.
  const templates = ref<ScreenerTemplate[]>([])
  const templatesLoading = ref(false)
  let hasLoadedTemplates = false

  async function loadTemplatesIfNeeded() {
    if (hasLoadedTemplates) return
    hasLoadedTemplates = true
    templatesLoading.value = true
    templates.value = await listTemplates()
    templatesLoading.value = false
  }

  // "+" now opens a dialog (see ScreenerOrganismNewPresetDialog) offering a choice between
  // this and addTemplateTab below, instead of always going straight to a blank tab.
  const newTabDialogVisible = ref(false)

  function openNewTabDialog() {
    // Same login gate addTab already had — both paths behind this dialog end up creating a
    // real backend-owned preset, so there's nothing useful to show a signed-out visitor yet.
    if (!currentUser.value) {
      openLogin()
      return
    }
    newTabDialogVisible.value = true
    loadTemplatesIfNeeded()
  }

  async function addTemplateTab(templateId: string) {
    if (!currentUser.value) {
      openLogin()
      return
    }

    const preset = await applyTemplate(templateId)
    if (!preset) {
      showErrorMessage(templateLastErrorMessage.value ?? '套用策略失敗')
      return
    }

    try {
      // Unlike addTab, no follow-up rename PATCH — the applied copy already carries the
      // template's own name (e.g. "巴菲特護城河"), which is exactly what should show here.
      const tab = registerTab(presetToTab(preset))
      await handleSearch(tab)
    } catch (error) {
      if (import.meta.dev) console.error('[screener] failed to add the template tab to the page', error)
      showErrorMessage('策略已套用，但畫面顯示失敗，請重新整理')
    }
  }

  async function renameTab(tab: ScreenerTab, name: string) {
    // The guest tab isn't a saved preset — there's nothing server-side to rename.
    if (isGuestTab(tab)) return
    const updated = await update(tab.id, { name })
    if (!updated) {
      showErrorMessage(lastErrorMessage.value ?? '重新命名失敗')
      return
    }
    tab.name = updated.name
  }

  // Same local-only reordering as reorderColumnPresets above — presets have no server-side
  // order field to persist against. The guest tab isn't draggable (see PresetFolder.vue), so
  // its GUEST_TAB_ID sentinel shouldn't reach here, but filtering defensively costs nothing.
  function reorderTabs(ids: string[]) {
    const byId = new Map(tabs.value.map(tab => [tab.id, tab]))
    tabs.value = ids.map(id => byId.get(id)).filter((tab): tab is ScreenerTab => !!tab)
  }

  async function removeTab(id: string) {
    // Belt-and-braces: the close icon is already hidden via :closable when this is the
    // last tab, but guard the handler too in case it's ever reachable another way.
    if (tabs.value.length <= 1) return

    const ok = await remove(id)
    if (!ok) {
      showErrorMessage(lastErrorMessage.value ?? '刪除分頁失敗')
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

  // Gated on authResolved, not just watching currentUser — currentUser starts null and a
  // real "signed out" resolution also leaves it null, so watching currentUser alone can't
  // tell "definitely a guest" apart from "haven't checked yet". Rendering the guest tab
  // before that distinction is known was a real reported bug: every signed-in reload showed
  // the guest tab (wrong name, wrong/no conditions, no results) for a moment, then swapped
  // to the real tabs once sign-in actually resolved — a visible full-content jitter, not
  // just a color flash like the theme one. tabsReady (exposed below) lets screener.vue show
  // a loading skeleton instead of the guest tab for that brief window, so signed-in users see
  // exactly one correct render instead of two.
  watch(
    [authResolved, currentUser],
    async ([resolved, user]) => {
      if (!resolved) return
      if (!user) {
        for (const tab of tabs.value) stopAutoSearch(tab.id)
        tabs.value = []
        columnPresetOptions.value = []
        hasLoadedTabs = false

        // A fresh local guest tab every time we drop to signed-out (including on first
        // load, since currentUser starts null until Firebase resolves) — filtering works
        // without an account; only saving it as a named preset requires signing in.
        stopAutoSearch(GUEST_TAB_ID)
        guestTab.value = createGuestTab()
        // Read back through guestTab.value rather than keeping the raw object returned
        // above — same reasoning as registerTab's own return value (see its comment):
        // mutating the pre-registration object directly never triggers a re-render.
        const tab = guestTab.value
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
    tabsReady: authResolved,
    displayedTabs,
    activeTabId,
    activeTab,
    columnPresetOptions,
    pickerVisible,
    pickerMode,
    pickerCurrentFieldId,
    pickerTriggerEl,
    addTab,
    newTabDialogVisible,
    openNewTabDialog,
    addTemplateTab,
    templates,
    templatesLoading,
    removeTab,
    renameTab,
    reorderTabs,
    removeSlot,
    addEmptySlot,
    openFieldPicker,
    openColumnPicker,
    handleSelect,
    handleColumnTabChange,
    changePage,
    changePageSize,
    addColumnPresetOption,
    removeColumnPresetOption,
    renameColumnPreset,
    reorderColumnPresets,
    handleReorderColumns,
    handleRemoveColumn,
    isGuestTab
  }
}
