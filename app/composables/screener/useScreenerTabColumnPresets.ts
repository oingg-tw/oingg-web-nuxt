import type { Ref } from 'vue'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import type { ColumnPresetOption, ScreenerTab, ResultColumnChoice } from '~/composables/screener/screener-tab-model'
// 篩選器的「欄位組合」——哪些欄位、切換／新增／改名／排序／刪除欄位預設，以及結果表格上直接加減欄位。
// 2026-10-02 從 useScreenerTabs.ts 搬出來（第二刀，條件編輯是第一刀）。
//
// **名字不能叫 useScreenerColumnPresets**：那個已經存在，是打後端 /screener/column-presets 的那一層。
// 這裡是「頁籤怎麼使用那些欄位預設」，所以是 useScreenerTabColumnPresets。計畫原本寫的名字會撞車。
//
// ## 什麼留在核心、什麼搬過來（量過才決定的）
//
// 搬過來的是**操作**。留在核心的本來也打算搬，但量過之後發現：
//   - `resolveDefaultColumnPresetId` 的真實呼叫只有核心的 presetToTab 一處（其餘六處都是註解提及）
//   - `columnPresetOptions` 是**共用狀態**：核心的 syncColumnPreset 與 bootstrap watcher 都在寫它
//
// 所以這兩個跟 `ensureOverviewColumnPreset`（給建頁籤的路徑用）一起從這裡 return 回核心，而不是留在
// 核心這邊各寫一份。核心在最前面就呼叫這支並解構——可行的原因是 ctx 傳進去的兩個都是 `function`
// 宣告（會被提升），所以「核心在宣告它們之前就引用」不是問題。
//
// ## 自己取的依賴
//
// `useCurrentUser()`／`useLoginDialog()`／`useScreenerPresets()`／`useScreenerColumnPresets()` 都在這裡
// 自己呼叫，不經 ctx——它們是 composable，不是核心擁有的狀態。
//
// **注意 `lastErrorMessage` 是 `ref()` 而不是 `useState()`**，所以核心與這裡各拿到自己的一份。那沒有
// 問題（各自的 API 呼叫設自己的、各自讀自己的），但不要「順手」把它們改成共用——那會讓一邊的錯誤
// 訊息蓋掉另一邊正在顯示的。
export function useScreenerTabColumnPresets(ctx: {
  // 刪掉一個欄位預設時，其他也指著它的頁籤要一起改指到替補的那一個——所以這裡需要看得到全部頁籤，
  // 不只是當下操作的那一個。核心擁有這個 useState，用 ctx 傳進來而不是在這裡再 useState 同一個 key：
  // 同一份狀態有兩個宣告處，下一個人讀到哪一個都會以為那是唯一的。
  tabs: Ref<ScreenerTab[]>
  // 欄位變動後把當前視圖寫回 tab.columnViewCache（核心擁有那個快取的寫入時機）。
  cacheColumnView: (tab: ScreenerTab) => void
  // 把 tab.columns 同步到它背後的欄位預設（核心負責 lazily 建立／PATCH）。
  syncColumnPreset: (tab: ScreenerTab) => Promise<void>
}) {
  const currentUser = useCurrentUser()
  const { open: openLogin } = useLoginDialog()
  const { run, lastErrorMessage } = useScreenerPresets()
  const {
    create: createColumnPreset,
    update: updateColumnPreset,
    remove: removeColumnPresetApi,
    reorder: reorderColumnPresetsApi,
    listTemplates: listColumnPresetTemplates,
    applyTemplate: applyColumnPresetTemplateApi,
    lastErrorMessage: columnLastErrorMessage,
    lastErrorCode: columnLastErrorCode
  } = useScreenerColumnPresets()

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
      tab.total = cached.total
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
      // Always starts back at page 1 for a not-yet-cached view — under infinite scroll
      // there's no single "current page" to carry over the way a pager's page 3 used to
      // map cleanly onto a new column set; a freshly-viewed column preset just starts its
      // own scroll from the top, same as this tab's very first search did. (An
      // already-cached view above still restores exactly how many rows had accumulated —
      // this branch only covers a genuinely new-to-this-tab column preset.)
      const result = await run(tab.id, columnPresetId ?? undefined, { page: 1, pageSize: tab.pageSize })
      if (!result) {
        showErrorMessage(lastErrorMessage.value ?? '切換欄位組合失敗')
        return
      }
      tab.columnPresetId = columnPresetId
      tab.results = result.results
      tab.resultColumns = result.columns
      tab.columns = result.columns.map(column => ({ field: column.field, label: columnLabelFrom(column.metricName, column.fieldName) }))
      tab.page = result.page
      tab.pageSize = result.pageSize
      tab.totalPages = result.totalPages
      tab.total = result.count
      tab.searched = true
      ctx.cacheColumnView(tab)
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

  // Real gap fixed 2026-09-11 (reported live: "新增一組自定義的screenerPreset時候，colmnsPreset
  // 要有預設值Preset = 總覽") — a brand-new custom filter tab used to leave columnPresetId at
  // whatever resolveDefaultColumnPresetId happened to resolve to (the user's own isDefault
  // preset, or arbitrarily options[0], or null for a genuinely fresh account) — bff-ts's own
  // null-fallback DOES serve the 總覽 template's columns server-side in that last case (see
  // ScreenerResultBody.vue's own comment), but with no matching entry in columnPresetOptions,
  // the 欄位組合 tab strip itself renders nothing to represent it — the data was right, the UI
  // had no visible tab to show it came from 總覽. Idempotent: reuses the user's own "總覽"
  // ColumnPreset if they already have one (from a prior template apply) instead of cloning a
  // fresh "總覽 2"/"總覽 3" duplicate every time a new filter tab is created — applyTemplate's
  // own "name"/"name 2" convention (see applyColumnPresetTemplate's comment) only kicks in on
  // an actual repeat POST, which this avoids by checking first.
  async function ensureOverviewColumnPreset(): Promise<string | null> {
    const existing = columnPresetOptions.value.find(option => option.name === '總覽')
    if (existing) return existing.id
    const applied = await applyColumnPresetTemplateApi('overview')
    if (!applied) return null
    columnPresetOptions.value.push({ id: applied.id, name: applied.name, isDefault: applied.isDefault })
    return applied.id
  }

  async function addColumnPresetOption(tab: ScreenerTab) {
    if (!currentUser.value) {
      openLogin()
      return
    }

    const name = `欄位組合 ${columnPresetOptions.value.length + 1}`
    const created = await createColumnPreset(name, [])
    if (!created) {
      if (columnLastErrorCode.value === 'quota_exceeded') showQuotaReached('欄位組合')
      else showErrorMessage(columnLastErrorMessage.value ?? '新增欄位組合失敗')
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

  // "+" now opens a dialog (see ScreenerNewColumnPresetDialog) offering a choice
  // between this (blank, same as addColumnPresetOption above) and an official curated
  // column set — mirrors ScreenerNewPresetDialog's own choose/browse pattern for
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
      if (columnLastErrorCode.value === 'quota_exceeded') showQuotaReached('欄位組合')
      else showErrorMessage(columnLastErrorMessage.value ?? '套用欄位組合失敗')
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

  // Persisted 2026-09-11 (relayed cross-session: "分頁標籤 也要持久化") — this used to be a
  // purely local, this-session-only reorder (see git history for the original comment: GET
  // /screener/column-presets had no order field to persist against). bff-ts shipped
  // POST /screener/column-presets/reorder (commit 02529cd) specifically for this — takes the
  // caller's FULL ordered set of their own column-preset ids, 400s on any mismatch (missing or
  // extra), so `ids` here must already be exactly that set; PresetFolder.vue's own reorder emit
  // already satisfies this (it reorders its full displayed item list, never a partial one).
  // Applied optimistically (screen updates immediately on drop, matching every other
  // drag-reorder in this app) and reverted if the PATCH actually fails, rather than waiting on
  // the round-trip before showing the new order.
  async function reorderColumnPresets(ids: string[]) {
    const byId = new Map(columnPresetOptions.value.map(option => [option.id, option]))
    const previous = columnPresetOptions.value
    columnPresetOptions.value = ids.map(id => byId.get(id)).filter((option): option is ColumnPresetOption => !!option)
    const ok = await reorderColumnPresetsApi(ids)
    if (!ok) {
      columnPresetOptions.value = previous
      showErrorMessage(columnLastErrorMessage.value ?? '排序欄位組合失敗')
    }
  }

  async function removeColumnPresetOption(tab: ScreenerTab, id: string) {
    const ok = await removeColumnPresetApi(id)
    if (!ok) {
      showErrorMessage(columnLastErrorMessage.value ?? '刪除欄位組合失敗')
      return
    }
    // Position in the strip at the moment of deletion decides the fallback — "切到後一個
    // tab，如果刪掉的是最後一個 tab，就切到前一個": the tab immediately after the removed
    // one, or immediately before it if it was the last. columnPresetOptions is one shared
    // list (not per filter-tab), so "position in the strip" is well-defined regardless of
    // which filter-tab this was clicked from. Not resolveDefaultColumnPresetId's
    // isDefault-first logic — that's for initial bootstrap, not this delete-and-switch flow.
    const removedIndex = columnPresetOptions.value.findIndex(option => option.id === id)
    columnPresetOptions.value = columnPresetOptions.value.filter(option => option.id !== id)
    const fallbackIndex = Math.min(removedIndex, columnPresetOptions.value.length - 1)
    const fallbackId = columnPresetOptions.value[fallbackIndex]?.id ?? null

    // Deleting is global — any tab that had this selected falls back to the same neighbor,
    // but only the tab this was actually clicked from needs an immediate refetch; the rest
    // reconcile next time they're searched or switched to.
    //
    // `tab` itself is deliberately skipped in this loop, not just "handled separately" —
    // switchColumnPreset below already sets tab.columnPresetId itself as part of switching,
    // and it also checks `columnPresetId === tab.columnPresetId` up front to skip
    // already-there no-ops. Setting tab.columnPresetId = fallbackId here FIRST made that
    // check see "no change needed" even though the results/columns still belonged to the
    // just-deleted preset — switchColumnPreset silently no-op'd, so the active tab visibly
    // switched but its table never refetched ("tab 改了但是 table columns 沒變動").
    const wasActive = tab.columnPresetId === id
    for (const otherTab of ctx.tabs.value) {
      if (otherTab === tab) continue
      if (otherTab.columnPresetId === id) otherTab.columnPresetId = fallbackId
    }
    if (wasActive) await switchColumnPreset(tab, fallbackId)
  }

  async function handleRemoveColumn(tab: ScreenerTab, field: string) {
    tab.columns = tab.columns.filter(column => column.field !== field)
    tab.resultColumns = tab.resultColumns.filter(column => column.field !== field)
    ctx.cacheColumnView(tab)
    await ctx.syncColumnPreset(tab)
  }

  async function handleReorderColumns(tab: ScreenerTab, fields: string[]) {
    const byField = new Map(tab.columns.map(column => [column.field, column]))
    tab.columns = fields.map(field => byField.get(field)).filter((column): column is ResultColumnChoice => !!column)
    ctx.cacheColumnView(tab)
    await ctx.syncColumnPreset(tab)
  }
  return {
    // 核心要用的：共用狀態與兩個「這個頁籤該用哪個預設」的解析函式。
    columnPresetOptions,
    resolveDefaultColumnPresetId,
    ensureOverviewColumnPreset,
    // 頁面要用的。
    handleColumnTabChange,
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
