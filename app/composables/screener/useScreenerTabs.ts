import { columnLabelFrom, metricDisplayName } from '~/composables/screener/useFilterSchema'
import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'
import type { TabFilterSlot, ScreenerTab } from '~/composables/screener/screener-tab-model'
import { SCREENER_TAB_PAGE_SIZE, columnViewCacheKey, sectorScopeFor, setSectorCodes, setSectorMode } from '~/composables/screener/screener-tab-model'


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
  const { update, run, runStateless, list, lastErrorMessage } = useScreenerPresets()
  const { list: listColumnPresets, create: createColumnPreset, update: updateColumnPreset } = useScreenerColumnPresets()

  // Real bug fixed 2026-09-11 (reported live: 欄位表頭顯示異常, right after bff-ts finally
  // seeded real GET /screener/column-preset-templates rows) — result column headers used to
  // build from `fieldName` alone, discarding `metricName`, and showed literally "TTM"/"Q"
  // instead of the metric's real name. Fixed by columnLabelFrom, now shared with
  // useGuestScreener.ts — see its own comment in useFilterSchema.ts.
  //
  // Real bug fixed 2026-09-11 (reported live: 套用「財務韌性」screener template 之後，每個
  // condition pill 的欄位名稱都顯示成「TTM」而不是真正的指標名稱) — this used to return
  // `field.name`, but per useFilterSchema.ts's own documented 2026-09-09 finding, field.name is
  // ALWAYS just the field's own period code repeated (period "TTM" → name "TTM" too), never a
  // distinct display name; MoleculeIndicatorPickerBody.vue was already fixed to use the metric's
  // own name instead, this call site just hadn't been touched since (only exercised once a
  // preset/template supplies a fieldId that didn't go through the picker's own handleSelect,
  // which already threads the real label through separately — see its own fieldLabel param).
  function labelForField(fieldId: string): string {
    if (!schema.value) return fieldId
    for (const category of schema.value.categories) {
      for (const metric of category.metrics) {
        for (const field of metric.fields) {
          if (`${metric.key}.${field.key}` === fieldId) return metricDisplayName(metric)
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
      // Exclusion wins when both somehow arrive: the backend enforces that only one is non-empty,
      // so a preset carrying both is already outside the contract and a silent merge would hide it.
      sectorCodes: preset.excludeSectorCodes?.length ? preset.excludeSectorCodes : (preset.sectorCodes ?? []),
      sectorMode: preset.excludeSectorCodes?.length ? 'exclude' : 'include',
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
      pageSize: SCREENER_TAB_PAGE_SIZE,
      totalPages: 1,
      total: 0,
      sortField: null,
      sortOrder: null,
      loading: false,
      loadingMore: false,
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

  // 欄位組合（切換／新增／改名／排序／刪除，以及結果表格上直接加減欄位）搬到
  // useScreenerTabColumnPresets，2026-10-02。放在這裡（而不是原本那段的位置）是因為核心的
  // presetToTab 與 syncColumnPreset 都要用到它回傳的東西；傳進去的兩個回呼都是 function 宣告，
  // 會被提升，所以在它們的宣告之前引用是安全的。
  const tabColumnPresets = useScreenerTabColumnPresets({
    tabs,
    cacheColumnView: tab => cacheCurrentColumnView(tab),
    syncColumnPreset: tab => syncColumnPreset(tab)
  })
  const {
    columnPresetOptions,
    resolveDefaultColumnPresetId,
    ensureOverviewColumnPreset,
    handleColumnTabChange,
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
  } = tabColumnPresets
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
      total: tab.total,
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
        JSON.stringify({
          slots: tab.slots
            .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null)
            .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude })),
          // 類股篩選 (see ScreenerTab.sectorCodes's own comment) — bundled into the same watched
          // JSON blob as the filter slots above rather than a second separate watcher, so a
          // sector change triggers the exact same debounced re-search + PATCH path a filter
          // edit already does, not a parallel one that could race it.
          sectorCodes: [...tab.sectorCodes].sort(),
          // The mode is watched too: 包含半導體 and 排除半導體 hold the identical code list and
          // are opposite searches, so without this a toggle would change nothing on screen.
          sectorMode: tab.sectorMode
        }),
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
    // Guest tab (see buildGuestTab below) — columns live purely in tab.columns and are sent
    // directly on every stateless search; there's no owned ColumnPreset resource to persist
    // them into (and no login to persist against in the first place).
    if (!currentUser.value) return
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
  // Passing `page` explicitly (see loadMoreResults below) means "just paginating the same
  // result set" — skips the filter PATCH/column sync entirely (nothing about the search
  // itself changed) and keeps every other cached column view intact instead of dropping
  // them, since the underlying stock list hasn't changed, only which page of it is shown.
  // `append` is independent of that — changeSort/changePageSize-era callers still pass
  // page=1 (isPageChangeOnly=true) to skip the filter PATCH but want a REPLACE, not an
  // append; only loadMoreResults's page=tab.page+1 call passes append=true.
  async function handleSearch(tab: ScreenerTab, page?: number, append = false) {
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
    const isGuest = !currentUser.value

    // Captured before the flag flips below: was this tab already searched at least once
    // this session, i.e. does tab.columns actually reflect its backing column-preset's real
    // fields? On a tab's very first search (freshly loaded from a reload, or a brand-new
    // tab before its first run), tab.columns is still the empty placeholder from
    // presetToTab — syncing that would PATCH a real, non-null column-preset down to zero
    // columns, wiping out whatever it actually had saved server-side.
    const alreadySearched = tab.searched

    if (append) tab.loadingMore = true
    else tab.loading = true
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
          // Guest tab (see buildGuestTab below) — no ScreenerPreset to PATCH, no columnPresetId
          // to resolve server-side; the stateless endpoint takes filters/columns/sectorCodes
          // directly on every call, so this is the entire request, no separate sync step.
          if (isGuest) {
            const result = await runStateless({
              filters,
              columns: tab.columns.map(column => column.field),
              ...sectorScopeFor(tab),
              pagination: { page: targetPage, pageSize: tab.pageSize },
              sort: tab.sortField && tab.sortOrder ? { field: tab.sortField, order: tab.sortOrder } : undefined
            })
            if (!isPageChangeOnly) tab.columnViewCache = {}
            if (result) {
              tab.results = append ? [...tab.results, ...result.results] : result.results
              tab.resultColumns = result.columns
              tab.columns = result.columns.map(column => ({ field: column.field, label: columnLabelFrom(column.metricName, column.fieldName) }))
              tab.page = result.page
              tab.pageSize = result.pageSize
              tab.totalPages = result.totalPages
              tab.total = result.count
              cacheCurrentColumnView(tab)
            } else if (!append) {
              tab.results = []
              tab.resultColumns = []
              showErrorMessage('搜尋失敗，請稍後再試')
            } else {
              showErrorMessage('載入更多失敗，請稍後再試')
            }
            return
          }

          if (!isPageChangeOnly) {
            await update(tab.id, { filters, ...sectorScopeFor(tab) })

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
            tab.results = append ? [...tab.results, ...result.results] : result.results
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
            tab.columns = result.columns.map(column => ({ field: column.field, label: columnLabelFrom(column.metricName, column.fieldName) }))
            tab.page = result.page
            tab.pageSize = result.pageSize
            tab.totalPages = result.totalPages
            tab.total = result.count
            cacheCurrentColumnView(tab)
          } else if (!append) {
            // An append failure (load-more) leaves the already-accumulated rows on screen
            // as-is — clearing them here would wipe out everything the user has scrolled
            // through just because loading the NEXT batch failed.
            tab.results = []
            tab.resultColumns = []
            showErrorMessage(lastErrorMessage.value ?? '搜尋失敗，請稍後再試')
          } else {
            showErrorMessage(lastErrorMessage.value ?? '載入更多失敗，請稍後再試')
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
      if (append) tab.loadingMore = false
      else tab.loading = false
      if (import.meta.dev) console.timeEnd(debugLabel)
    }
  }

  // 無限捲動的「載入下一批」——結果表的哨兵列進入視窗時觸發（SharedMetricTable）。同一分頁已有請求在飛、或已載完所有頁時 no-op。
  async function loadMoreResults(tab: ScreenerTab) {
    if (tab.loading || tab.loadingMore) return
    if (tab.page >= tab.totalPages) return
    await handleSearch(tab, tab.page + 1, true)
  }

  // Full-result-set sort (symbol/metric fields — see ScreenerSortParams). Restarts at page
  // 1 (and accumulated infinite-scroll rows reset with it, via handleSearch's default
  // append=false): a new sort order reshuffles which rows land on which page,
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



  // 條件編輯（欄位挑選器＋區間編輯器＋移除條件）搬到 useScreenerConditionEditor，2026-10-02。
  // 那一塊對核心只有這三個依賴，而核心沒有反向依賴它——所以它是這個檔案裡最乾淨的一刀。
  const conditionEditor = useScreenerConditionEditor({
    syncColumnPreset,
    runSearch: handleSearch,
    cacheColumnView: cacheCurrentColumnView
  })
  const {
    pickerVisible,
    pickerMode,
    pickerCurrentFieldId,
    openFieldPicker,
    openColumnPicker,
    addConditionAndOpenPicker,
    handleSelect,
    removeSlot,
    rangeEditorVisible,
    rangeEditorSlot,
    openRangeEditor,
    changeRangeEditorPeriod,
    backToPicker,
    closePanel
  } = conditionEditor

  // 頁籤增刪改搬到 useScreenerTabCrud，2026-10-02（第三刀）。那個檔案的開頭寫了它的風險與驗證
  // 覆蓋範圍——建立路徑都在登入閘門後面，所以只有 typecheck 在保護，改之前要手動走一遍。
  const tabCrud = useScreenerTabCrud({
    tabs,
    activeTabId,
    runSearch: (tab, page, append) => handleSearch(tab, page, append),
    presetToTab: preset => presetToTab(preset),
    watchTabForAutoSearch: tab => watchTabForAutoSearch(tab),
    stopAutoSearch: tabId => stopAutoSearch(tabId),
    buildSlots: filters => buildSlots(filters),
    ensureOverviewColumnPreset: () => ensureOverviewColumnPreset()
  })
  const {
    addTab,
    addGuestTab,
    addDefaultTab,
    newTabDialogVisible,
    openNewTabDialog,
    addTemplateTab,
    templates,
    templatesLoading,
    renameTab,
    reorderTabs,
    removeTab
  } = tabCrud

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
        await addDefaultTab()
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
    addTab,
    addGuestTab,
    newTabDialogVisible,
    openNewTabDialog,
    addTemplateTab,
    templates,
    templatesLoading,
    removeTab,
    renameTab,
    reorderTabs,
    removeSlot,
    addConditionAndOpenPicker,
    rangeEditorVisible,
    rangeEditorSlot,
    openRangeEditor,
    changeRangeEditorPeriod,
    backToPicker,
    closePanel,
    openFieldPicker,
    openColumnPicker,
    handleSelect,
    handleColumnTabChange,
    loadMoreResults,
    changeSort,
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
    handleRemoveColumn,
    setSectorCodes,
    setSectorMode
  }
}
