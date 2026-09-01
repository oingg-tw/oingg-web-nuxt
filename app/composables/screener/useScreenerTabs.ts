import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import type { FilterCategory } from '~/composables/screener/useFilterSchema'
import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'

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
  // Scoped to the column view (not the tab as a whole) because a metric sortField only
  // makes sense against the fields that column-preset actually shows — carrying it over to
  // a different column-preset's fetch risks asking bff-ts to sort by a field that request's
  // columns don't include. Reset to null rather than carried forward on a switch to an
  // uncached view (see switchColumnPreset).
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
}

// Server-side pagination (bff-ts /screener and /screener/presets/{id}/run both take
// page/pageSize now) — page is 1-indexed. Every tab keeps its own, since each is an
// independent search against its own filters.
const DEFAULT_PAGE_SIZE = 20

export interface ScreenerTab {
  // UUID (a real backend-persisted preset) — never a sequential integer.
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
  // Full-result-set sort (bff-ts, confirmed live 2026-09-01) — symbol or a metric field key
  // only; "name" isn't backend-sortable (see ScreenerSortParams in useScreenerPresets.ts) and
  // stays a client-only, page-local sort in OrganismResultTable.vue instead.
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
  loading: boolean
  searched: boolean
  renaming: boolean
  renameDraft: string
}

// Column-presets are a global, per-user catalog with no ownership tie to any one filter
// preset — a filter preset holds only its conditions, a column-preset holds only a
// display configuration (which columns, i.e. what the table shows), and neither belongs
// to the other.
//
// No more "預設" sentinel tab standing in for columnPresetId = null — removed 2026-09-01
// per bff-ts's own read (they'd just shipped null resolving server-side to a real curated
// "overview" preset, which made the client's separate always-there empty tab redundant, not
// load-bearing): once a user has ≥1 saved ColumnPreset, isDefault on a real, owned preset
// already answers "what opens first" better than a magic tab that never actually held
// anything of its own. null now only ever flows to the API for the true zero-preset case
// (a fresh account, or briefly before the first list() resolves) — see
// resolveDefaultColumnPresetId below, which every tab-bootstrap path runs through instead of
// defaulting to null whenever the user actually has a preset to fall back to.
export interface ColumnPresetOption {
  id: string
  name: string
  isDefault: boolean
}

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
  const { create, update, remove, run, list, lastErrorMessage } = useScreenerPresets()
  const { list: listTemplates, apply: applyTemplate, lastErrorMessage: templateLastErrorMessage } = useScreenerTemplates()
  const {
    list: listColumnPresets,
    create: createColumnPreset,
    update: updateColumnPreset,
    remove: removeColumnPresetApi,
    listTemplates: listColumnPresetTemplates,
    applyTemplate: applyColumnPresetTemplateApi,
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
      // doesn't also echo back that column-preset's own field list. Falls through to
      // resolveDefaultColumnPresetId (not straight to null) so a brand-new tab, or one this
      // account has never viewed before, opens on the user's own isDefault column-preset
      // when they have one, instead of landing on nothing.
      columns: [],
      columnPresetId: preset.lastColumnPresetId ?? resolveDefaultColumnPresetId(),
      columnViewCache: {},
      results: [],
      resultColumns: [],
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: 1,
      sortField: null,
      sortOrder: null,
      loading: false,
      searched: false,
      renaming: false,
      renameDraft: preset.name
    }
  }

  // useState, not plain ref — this data needs to survive a client-side navigation away from
  // /screener and back (a plain ref resets to its initial value on every remount, since
  // useScreenerTabs() itself reruns from scratch each time screener.vue mounts). Without
  // this, every return to the page re-triggered a full backend refetch and, worse, silently
  // lost every auto-search watcher registered on the previous mount (they're tied to that
  // mount's own effect scope, which Vue disposes on unmount) — auto-search would just stop
  // working after the first navigation away and back. See tabsBootstrapped below and
  // hasLoadedTabs' own comment for the matching pieces of this fix.
  const tabs = useState<ScreenerTab[]>('screener-tabs', () => [])
  const activeTabId = useState('screener-active-tab-id', () => '')
  const activeTab = computed<ScreenerTab | null>(
    () => tabs.value.find(tab => String(tab.id) === activeTabId.value) ?? null
  )
  // Also useState, for the same reason as tabs above — a plain closure variable here
  // was the original, more subtle version of the same bug: it alone reset to false on every
  // remount, silently triggering a redundant Promise.all([list(), listColumnPresets()])
  // refetch (and briefly, a real empty-shell render) even though tabs.value already held the
  // correct data — the bootstrap watcher below re-registers each tab's auto-search watcher on
  // that shortcut path, closing the other half of the gap.
  const hasLoadedTabs = useState('screener-tabs-has-loaded', () => false)

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
      totalPages: tab.totalPages,
      sortField: tab.sortField,
      sortOrder: tab.sortOrder
    }
  }

  // No more 搜尋 button — a tab searches itself automatically whenever its actual filter
  // criteria change (field, min, max, exclude; adding/removing an empty slot doesn't
  // count). Debounced so typing a number doesn't fire a request per keystroke, and
  // cancellable so a pending one doesn't fire after its tab is gone.
  const autoSearchControllers = new Map<string, { stopWatch: () => void; trigger: { cancel: () => void } }>()

  function watchTabForAutoSearch(tab: ScreenerTab) {
    // handleSearch itself re-checks currentUser before doing anything — no need to gate on
    // it here too.
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
  // column-preset immediately, rather than waiting for the next search — creating it lazily
  // on first use (i.e. the first edit made while columnPresetId is still null — the true
  // zero-preset case, since resolveDefaultColumnPresetId already assigns a real one whenever
  // the account has any), patching it from then on.
  async function syncColumnPreset(tab: ScreenerTab) {
    const fields = tab.columns.map(column => column.field)
    if (tab.columnPresetId === null) {
      if (!fields.length) return
      const name = `顯示欄位 ${columnPresetOptions.value.length + 1}`
      const created = await createColumnPreset(name, fields)
      if (!created) return
      columnPresetOptions.value.push({ id: created.id, name: created.name, isDefault: created.isDefault })
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
            // Also skipped while columnPresetId is still null (the true zero-preset case) —
            // tab.columns there is just a read-only view of whatever the server resolved as
            // the default, not something the user configured, so syncing it would lazily
            // create a brand-new "顯示欄位 N" preset out of it and silently pin the tab to a
            // concrete id on the next filter edit, even though no column was ever touched.
            if (alreadySearched && tab.columnPresetId !== null) {
              await syncColumnPreset(tab)
            }
          }

          const hadNullColumnPresetId = tab.columnPresetId === null
          const result = await run(
            tab.id,
            tab.columnPresetId ?? undefined,
            { page: targetPage, pageSize: tab.pageSize },
            tab.sortField && tab.sortOrder ? { field: tab.sortField, order: tab.sortOrder } : undefined
          )
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
            // deleted server-side and fell back to something else). When columnPresetId was
            // null going in (the true zero-preset case), the server always resolves that to
            // *some* real id (this preset's last view, the user's isDefault column-preset,
            // or the curated overview) — adopting that id here would silently pin the tab to
            // a concrete preset on every filter edit, even though nothing about columns
            // changed and resolveDefaultColumnPresetId is what should own that decision.
            if (!hadNullColumnPresetId) tab.columnPresetId = result.columnPresetId
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

  // Full-result-set sort (symbol/metric fields — see ScreenerSortParams). Restarts at page
  // 1 like changePageSize above: a new sort order reshuffles which rows land on which page,
  // so whatever page number was showing before has no guaranteed relationship to what
  // should show now. Passing page explicitly here (not omitted) is also what keeps this a
  // "page-change-only" call in handleSearch — a sort change touches neither filters nor
  // column-preset fields, so there's nothing there worth re-syncing.
  async function changeSort(tab: ScreenerTab, field: string | null, order: 'asc' | 'desc' | null) {
    if (field === tab.sortField && order === tab.sortOrder) return
    tab.sortField = field
    tab.sortOrder = order
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
    // after a reload, still sitting at its initial columnPresetId/empty columns) would
    // silently do nothing when switching to that same id, since that already "matches" its
    // unfetched starting state — showing nothing but 代號 forever until some other tab is
    // clicked first.
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
      tab.sortField = cached.sortField
      tab.sortOrder = cached.sortOrder
      tab.searched = true
      return
    }

    // Not carrying the current sortField/sortOrder into a not-yet-cached column view — a
    // metric sortField only makes sense against fields THAT column-preset actually shows,
    // and this switch doesn't know whether the old one still applies. Resetting is the safe
    // default (see ScreenerColumnView's own comment); symbol sort would survive a carry-over
    // fine, but there's no way to tell the two cases apart here without knowing the new
    // column-preset's field list in advance.
    tab.sortField = null
    tab.sortOrder = null

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
    await switchColumnPreset(tab, id)
  }

  // useState, matching tabs above — same remount-persistence reasoning.
  const columnPresetOptions = useState<ColumnPresetOption[]>('screener-column-preset-options', () => [])

  // What a tab should open to when it has no columnPresetId of its own yet (a fresh preset,
  // or one whose lastColumnPresetId came back null) — the user's own isDefault preset if
  // they've marked one, else whichever one happens to be first, else genuinely null for the
  // true zero-preset case (a brand-new account, or before list() has resolved). Every
  // tab-bootstrap path (presetToTab below, and removeColumnPresetOption's own fallback when
  // the active preset gets deleted) runs through this instead of hardcoding null, now that
  // there's no "預設" tab left to represent that state in the UI.
  function resolveDefaultColumnPresetId(excludeId?: string): string | null {
    const options = columnPresetOptions.value.filter(option => option.id !== excludeId)
    return options.find(option => option.isDefault)?.id ?? options[0]?.id ?? null
  }

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
    columnPresetOptions.value.push({ id: created.id, name: created.name, isDefault: created.isDefault })
    await switchColumnPreset(tab, created.id)
  }

  // Officially-curated column sets (GET /screener/column-preset-templates) a user can copy
  // into their own column-preset in one click — see useScreenerColumnPresets.ts. Same
  // fetched-lazily-once pattern as the filter templates above (loadTemplatesIfNeeded).
  const columnPresetTemplates = ref<ColumnPresetTemplate[]>([])
  const columnPresetTemplatesLoading = ref(false)
  let hasLoadedColumnPresetTemplates = false

  async function loadColumnPresetTemplatesIfNeeded() {
    if (hasLoadedColumnPresetTemplates) return
    hasLoadedColumnPresetTemplates = true
    columnPresetTemplatesLoading.value = true
    columnPresetTemplates.value = await listColumnPresetTemplates()
    columnPresetTemplatesLoading.value = false
  }

  // "+" now opens a dialog (see ScreenerOrganismNewColumnPresetDialog) offering a choice
  // between this (blank, same as addColumnPresetOption above) and an official curated
  // column set — mirrors ScreenerOrganismNewPresetDialog's own choose/browse pattern for
  // filter presets (see newTabDialogVisible above).
  //
  // Plain closure variable, not a ref/useState — this only needs to survive from
  // openNewColumnPresetDialog to whichever single choice the user makes moments later in
  // the now-open dialog, not across a remount the way tabs/columnPresetOptions above do.
  const newColumnPresetDialogVisible = ref(false)
  let pendingColumnPresetTab: ScreenerTab | null = null

  function openNewColumnPresetDialog(tab: ScreenerTab) {
    // Same login gate addColumnPresetOption already has — opening the dialog itself is
    // harmless, but every choice behind it ends up creating a real backend-owned column
    // preset, so there's nothing useful to show a signed-out visitor yet.
    if (!currentUser.value) {
      openLogin()
      return
    }
    pendingColumnPresetTab = tab
    newColumnPresetDialogVisible.value = true
    loadColumnPresetTemplatesIfNeeded()
  }

  async function confirmCustomColumnPreset() {
    if (!pendingColumnPresetTab) return
    await addColumnPresetOption(pendingColumnPresetTab)
  }

  async function applyColumnPresetTemplate(key: string) {
    if (!pendingColumnPresetTab) return
    const tab = pendingColumnPresetTab
    const applied = await applyColumnPresetTemplateApi(key)
    if (!applied) {
      showErrorMessage(columnLastErrorMessage.value ?? '套用欄位組合失敗')
      return
    }
    // Applying an official template is a strong "this is what I want to see" signal — mark
    // it as this account's isDefault column-preset too (the apply endpoint's own response
    // doesn't set this on its own, confirmed live), so future tabs/opens land on it via
    // resolveDefaultColumnPresetId instead of an arbitrary "first one". isDefault is
    // exclusive server-side, so unset it on every other locally-held option to match — but
    // only once the PATCH actually confirms, not optimistically: a failed PATCH still leaves
    // the template applied and active on this tab, just pushed as a plain non-default entry,
    // honest about not being account-wide-default yet.
    const markedDefault = await updateColumnPreset(applied.id, { isDefault: true })
    if (markedDefault) {
      columnPresetOptions.value = [
        ...columnPresetOptions.value.map(option => ({ ...option, isDefault: false })),
        { id: applied.id, name: applied.name, isDefault: true }
      ]
    } else {
      columnPresetOptions.value.push({ id: applied.id, name: applied.name, isDefault: false })
    }
    await switchColumnPreset(tab, applied.id)
  }

  async function renameColumnPreset(id: string, name: string) {
    // Applied optimistically before the request resolves — PresetFolder.vue already exits
    // its inline-rename input the instant Enter is pressed, so without this the tab visibly
    // snapped back to the OLD name for the round-trip and only jumped to the new one once
    // the response landed. Reverted below if the request actually fails.
    const option = columnPresetOptions.value.find(item => item.id === id)
    const previousName = option?.name
    if (option) option.name = name

    const updated = await updateColumnPreset(id, { name })
    if (!updated) {
      if (option && previousName !== undefined) option.name = previousName
      showErrorMessage(columnLastErrorMessage.value ?? '重新命名失敗')
      return
    }
    if (option) option.name = updated.name
  }

  // Drag-reorder on the desktop tab list (see PresetFolder.vue) is a purely local, this-
  // session-only convenience — GET /screener/presets returns no order/position field to
  // persist against, so there's nothing to PATCH; the order just resets to whatever the
  // server returns on next load. Silently drops any id that isn't currently a real option —
  // defensive, costs nothing.
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

    // Deleting is global — any tab that had this selected falls back to whichever remaining
    // preset is isDefault (or the first one, or null if that was the last one left) via
    // resolveDefaultColumnPresetId, but only the tab this was actually clicked from needs an
    // immediate refetch; the rest reconcile next time they're searched or switched to.
    const wasActive = tab.columnPresetId === id
    const fallbackId = resolveDefaultColumnPresetId()
    for (const otherTab of tabs.value) {
      if (otherTab.columnPresetId === id) otherTab.columnPresetId = fallbackId
    }
    if (wasActive) await switchColumnPreset(tab, fallbackId)
  }

  // Switching a condition's period (via the range editor's period switcher, see
  // periodSiblingsOf in useFilterSchema.ts) rather than picking an unrelated field —
  // fieldLabel is already period-agnostic (just the metric name) so it doesn't need
  // updating, and unlike handleSelect this deliberately leaves min/max/exclude alone: it's a
  // refinement of the same condition, not a fresh one. Mutating slot.fieldId directly is
  // enough to trigger auto-search, since watchTabForAutoSearch already tracks it.
  function changeSlotPeriod(tab: ScreenerTab, slotId: number, fieldId: string) {
    const slot = tab.slots.find(item => item.id === slotId)
    if (!slot) return
    slot.fieldId = fieldId
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
  // mutate the original pre-registration object afterward (as this used to do) silently
  // updates the underlying data — a later, unrelated re-render would eventually show it
  // correctly — but never itself triggers one, so e.g. tab.loading flipping back to false
  // after a search never actually clears the spinner on screen. Callers must use the
  // returned reference for
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
    // Same optimistic-then-reconcile pattern as renameColumnPreset above, and for the same
    // reason: PresetFolder.vue's rename input is already gone by the time this resolves, so
    // the tab needs to already be showing `name`, not the pre-rename one, for that gap.
    const previousName = tab.name
    tab.name = name

    const updated = await update(tab.id, { name })
    if (!updated) {
      tab.name = previousName
      showErrorMessage(lastErrorMessage.value ?? '重新命名失敗')
      return
    }
    tab.name = updated.name
  }

  // Same local-only reordering as reorderColumnPresets above — presets have no server-side
  // order field to persist against.
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
  // tell "definitely signed out" apart from "haven't checked yet". Rendering the real
  // (empty) shell before that distinction is known would flash "no presets" for an instant
  // even for a signed-in user, before their actual tabs load — tabsReady (exposed below)
  // lets screener.vue show a loading skeleton instead for that brief window.
  // Separate from authResolved on purpose — authResolved only means "we know who's signed
  // in", not "their tabs are actually loaded and assigned yet". Exposing authResolved
  // directly as tabsReady let the skeleton disappear the instant sign-in resolved, before the
  // Promise.all([list(), listColumnPresets()]) fetch below had actually populated tabs.value/
  // activeTabId — screener.vue briefly rendered the real (empty) shell with no tabs and no
  // results. tabsBootstrapped only flips once each branch has fully finished assigning what
  // it renders from.
  const tabsBootstrapped = useState('screener-tabs-bootstrapped', () => false)

  watch(
    [authResolved, currentUser],
    async ([resolved, user]) => {
      if (!resolved) return
      if (!user) {
        for (const tab of tabs.value) stopAutoSearch(tab.id)
        tabs.value = []
        columnPresetOptions.value = []
        hasLoadedTabs.value = false
        activeTabId.value = ''
        tabsBootstrapped.value = true
        return
      }

      if (hasLoadedTabs.value) {
        // tabs.value itself survived the remount (useState), but the auto-search watcher on
        // each of those tabs did not — it's tied to the PREVIOUS mount's effect scope, which
        // Vue already disposed. Re-registering here is what keeps editing a condition on an
        // already-loaded tab still triggering a search after the first navigation away and
        // back, instead of silently going quiet.
        for (const tab of tabs.value) watchTabForAutoSearch(tab)
        tabsBootstrapped.value = true
        return
      }
      hasLoadedTabs.value = true

      const [presets, columnPresets] = await Promise.all([list(), listColumnPresets()])
      // Populated before presets.map(presetToTab) below runs, so presetToTab's own
      // resolveDefaultColumnPresetId() call already sees the real list, not last session's.
      columnPresetOptions.value = columnPresets.map(preset => ({ id: preset.id, name: preset.name, isDefault: preset.isDefault }))

      if (presets.length) {
        tabs.value = presets.map(presetToTab)
        for (const tab of tabs.value) watchTabForAutoSearch(tab)
      } else {
        await addTab()
      }
      activeTabId.value = tabs.value[0] ? String(tabs.value[0].id) : ''
      tabsBootstrapped.value = true
    },
    { immediate: true }
  )

  return {
    tabsReady: tabsBootstrapped,
    displayedTabs: tabs,
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
    changeSlotPeriod,
    openFieldPicker,
    openColumnPicker,
    handleSelect,
    handleColumnTabChange,
    changePage,
    changePageSize,
    changeSort,
    addColumnPresetOption,
    newColumnPresetDialogVisible,
    openNewColumnPresetDialog,
    confirmCustomColumnPreset,
    columnPresetTemplates,
    columnPresetTemplatesLoading,
    applyColumnPresetTemplate,
    removeColumnPresetOption,
    renameColumnPreset,
    reorderColumnPresets,
    handleReorderColumns,
    handleRemoveColumn
  }
}
