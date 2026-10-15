import type { Ref } from 'vue'
import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import type { ScreenerTab, TabFilterSlot } from '~/composables/screener/screener-tab-model'
// 篩選器的「頁籤增刪改」——建立（空白／範本／訪客／預設）、改名、排序、刪除。
// 2026-10-02 從 useScreenerTabs.ts 搬出來（第三刀，前兩刀是條件編輯與欄位組合）。
//
// ## 這一塊的風險比前兩刀高，而且是量出來的
//
// 四個叢集我量過各自對外的引用數：條件編輯 3 個、欄位組合 4 個、這一塊 **10 個**（`tabs` 用了 14 次、
// `activeTabId` 3 次、`handleSearch` 3 次）。它是最糾結的一塊，所以留到最後。
//
// 驗證覆蓋也不完整，實話說清楚：
//   - **有覆蓋**：`buildLocalTab` / `addLocalTab` / `registerTab` ——
//     /screener/common?template=value 的訪客頁籤走的就是這條路，check-screener-operations.mjs 與
//     check-screener-consistency.mjs 會驗它長出結果列。
//   - **沒覆蓋**：`addTab` / `addTemplateTab` / `addDefaultTab` / `saveTab` / `copyTab` / `reorderTabs` / `removeTab` ——
//     每一個建立路徑都在登入閘門後面（openLogin()），而那需要一個登入的 session。
//     這幾個只有 `nuxt typecheck` 在保護。動它們之前要有人手動走一遍。
//
// ## ctx 的七個
//
// 全部是核心擁有的狀態或行為，沒有一個是為了這次搬家發明的。傳的是 **ref 本身而不是 .value**——
// 傳值進來就斷了反應性，而那種壞法不會有任何錯誤訊息。
//
// `currentUser` / `openLogin` / API 那幾支在這裡自己取（它們是 composable，不是核心的狀態）。
// `SCREENER_TAB_PAGE_SIZE` 與 `findRoeField` 是模組層的常數與純函式，從核心 export 進來。
export function useScreenerTabCrud(ctx: {
  tabs: Ref<ScreenerTab[]>
  activeTabId: Ref<string>
  // 核心的 handleSearch。新頁籤建好、或改名後要重跑的那一下都走它。
  runSearch: (tab: ScreenerTab, page?: number, append?: boolean) => Promise<void>
  // 把後端的 ScreenerPreset 變成一個畫面上的頁籤（核心擁有那個對映，因為它也要在 bootstrap 用）。
  presetToTab: (preset: ScreenerPreset) => ScreenerTab
  // 條件變動就自動重搜的 watcher，每個新頁籤都要註冊一個。
  watchTabForAutoSearch: (tab: ScreenerTab) => void
  // 刪頁籤時要把它的 watcher 收掉，否則留下一個指著不存在頁籤的 watcher。
  stopAutoSearch: (tabId: string) => void
  // 把後端的 filters 轉成畫面上的條件 slot。
  buildSlots: (filters: FilterCriterion[]) => TabFilterSlot[]
  // 全新的自訂頁籤一律從「總覽」這個欄位預設開始，而不是使用者在其他頁籤設成 isDefault 的那一個。
  // 它住在 useScreenerTabColumnPresets，由核心轉接過來——這裡不直接呼叫那一支，否則兩個子
  // composable 會各自建立一份它的狀態。
  ensureOverviewColumnPreset: () => Promise<string | null>
  // 未儲存的頁籤（登入的人從 ?template／?sector 打開）用使用者自己的預設欄位組合：要它的 id 與欄位（無狀態查詢自己帶欄位）
  resolveDefaultColumnPresetId: () => string | null
  columnFieldsOf: (columnPresetId: string) => string[] | null
}) {
  const { data: schema } = useFilterSchema()
  const currentUser = useCurrentUser()
  const { open: openLogin } = useLoginDialog()
  const { create, update, remove, reorder: reorderTabsApi, lastErrorMessage, lastErrorCode } = useScreenerPresets()
  const { list: listTemplates, apply: applyTemplate, lastErrorMessage: templateLastErrorMessage, lastErrorCode: templateLastErrorCode } = useScreenerTemplates()

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
    ctx.tabs.value = [...ctx.tabs.value, tab]
    ctx.activeTabId.value = String(tab.id)
    const registered = ctx.tabs.value[ctx.tabs.value.length - 1]!
    ctx.watchTabForAutoSearch(registered)
    return registered
  }

  // presetToTab 的訪客版：訪客先自己挑一個起始策略（ScreenerGuestStrategyPicker；「要自選 篩選條件 避免觸法」——由網站替他選會像
  // 推薦股票），之後的分頁用登入分頁同一套 UI 編輯（條件挑選器、範圍編輯器、欄位增刪排序、排序）——那些 handler 都吃
  // `tab: ScreenerTab`，原樣可用；只有 handleSearch／syncColumnPreset 有訪客分支（它們是僅有的兩個會碰到後端資源的）。`id` 只在
  // 用戶端，從不送出，別跟真正的 preset UUID 混淆。
  //
  // 2026-10-15 起訪客的這一組與登入的人從 ?template／?sector 打開的都是「未儲存」的頁籤（unsaved），同一條無狀態查詢；
  // 登入的人用自己的預設欄位組合，訪客用範本的欄位（總覽）。
  function buildLocalTab(slots: TabFilterSlot[], fieldKeys: string[], name: string): ScreenerTab {
    const columnPresetId = currentUser.value ? ctx.resolveDefaultColumnPresetId() : null
    const fields = (columnPresetId && ctx.columnFieldsOf(columnPresetId)) || fieldKeys
    return {
      id: `unsaved-${Date.now()}`,
      name,
      unsaved: true,
      slots,
      columns: fields.map(field => ({ field, label: field })),
      columnPresetId,
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
      renameDraft: name
    }
  }

  // 訪客挑好範本、或登入的人從 ?template 進來：打開一組未儲存的，不替他建
  async function addLocalTab(filters: FilterCriterion[], fieldKeys: string[], name: string) {
    const tab = registerTab(buildLocalTab(ctx.buildSlots(filters), fieldKeys, name))
    await ctx.runSearch(tab)
  }

  // ?sector 遇到一組已存的：複製成未儲存的（條件換成呼叫端給的），不改到已存的那一組
  function addLocalCopy(source: ScreenerTab, name: string, slots: TabFilterSlot[]): ScreenerTab {
    const tab = buildLocalTab(slots, source.columns.map(column => column.field), name)
    tab.columnPresetId = source.columnPresetId
    return registerTab(tab)
  }

  // 「存成我的篩選」：未儲存的那一組換成真的 preset（同一個位置），結果直接接手、不再查一次
  async function saveTab(tab: ScreenerTab) {
    if (!currentUser.value) {
      openLogin()
      return
    }
    if (!tab.unsaved) return
    const name = await promptPresetName('存成我的篩選', tab.name)
    if (!name) return
    const filters = tab.slots
      .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null && slot.fieldId !== SECTOR_FIELD_ID)
      .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))
    const created = await create(filters)
    if (!created) {
      if (lastErrorCode.value === 'quota_exceeded') showQuotaReached(PRESET_QUOTA_LABEL)
      else showErrorMessage(lastErrorMessage.value ?? '儲存失敗，請稍後再試')
      return
    }
    const updated = await update(created.id, { name, ...sectorScopeFor(tab) })
    if (!updated) showErrorMessage(lastErrorMessage.value ?? `已儲存，但名稱或類股沒有一起存進去`)
    const saved = ctx.presetToTab(updated ?? created)
    Object.assign(saved, {
      columnPresetId: tab.columnPresetId ?? saved.columnPresetId,
      columns: tab.columns,
      results: tab.results,
      resultColumns: tab.resultColumns,
      page: tab.page,
      totalPages: tab.totalPages,
      total: tab.total,
      sortField: tab.sortField,
      sortOrder: tab.sortOrder,
      searched: tab.searched
    })
    const index = ctx.tabs.value.findIndex(item => item.id === tab.id)
    ctx.stopAutoSearch(tab.id)
    ctx.tabs.value = ctx.tabs.value.map((item, position) => (position === index ? saved : item))
    ctx.activeTabId.value = saved.id
    ctx.watchTabForAutoSearch(ctx.tabs.value[index]!)
  }

  // 「新增篩選」對話框的「複製目前這組」
  async function copyTab(tab: ScreenerTab) {
    if (!currentUser.value) {
      openLogin()
      return
    }
    const filters = tab.slots
      .filter((slot): slot is TabFilterSlot & { fieldId: string } => slot.fieldId !== null && slot.fieldId !== SECTOR_FIELD_ID)
      .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))
    const created = await create(filters)
    if (!created) {
      if (lastErrorCode.value === 'quota_exceeded') showQuotaReached(PRESET_QUOTA_LABEL)
      else showErrorMessage(lastErrorMessage.value ?? '複製失敗，請稍後再試')
      return
    }
    const updated = await update(created.id, { name: `${tab.name} 的副本`.slice(0, 20), ...sectorScopeFor(tab) })
    const copy = registerTab(ctx.presetToTab(updated ?? created))
    copy.columnPresetId = tab.columnPresetId ?? copy.columnPresetId
    await ctx.runSearch(copy)
  }

  async function addTab() {
    // The "+" new-tab control is reachable before login (see ScreenerPresetTabs), since
    // creating a screener preset is exactly the action that should prompt registration.
    if (!currentUser.value) {
      openLogin()
      return
    }

    const name = `未命名 ${ctx.tabs.value.length + 1}`
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
      if (lastErrorCode.value === 'quota_exceeded') showQuotaReached(PRESET_QUOTA_LABEL)
      else showErrorMessage(lastErrorMessage.value ?? '新增篩選失敗')
      return
    }

    try {
      const tab = registerTab(ctx.presetToTab(preset))
      tab.name = name
      tab.renameDraft = name

      // Explicit 總覽 default (see ensureOverviewColumnPreset's own comment) — overrides
      // whatever presetToTab's own resolveDefaultColumnPresetId call just resolved, since a
      // brand-new custom tab should always start on 總覽 specifically, not whichever preset the
      // user happens to have marked isDefault for their OTHER tabs.
      const overviewId = await ctx.ensureOverviewColumnPreset()
      if (overviewId) tab.columnPresetId = overviewId

      await update(tab.id, { name })

      // Run it immediately so the default ROE condition actually filters right away
      // instead of waiting for the auto-search debounce or an edit to trigger it.
      await ctx.runSearch(tab)
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
  // 失敗時重設旗標並報給全站讀取失敗彈窗（2026-10-11）；原本先設已載入，失敗之後整個 session 都是空清單
  const templatesFailure = shallowRef<unknown>(null)
  watchLoadFailure('screener-templates', () => templatesFailure.value, () => loadTemplatesIfNeeded(), { scope: 'section' })

  async function loadTemplatesIfNeeded() {
    if (hasLoadedTemplates) return
    hasLoadedTemplates = true
    templatesLoading.value = true
    try {
      templates.value = await listTemplates()
      templatesFailure.value = null
    } catch (error) {
      hasLoadedTemplates = false
      templatesFailure.value = error
    } finally {
      templatesLoading.value = false
    }
  }

  // "+" now opens a dialog (see ScreenerNewPresetDialog) offering a choice between
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
      // 套用範本會新增一個篩選分頁，吃的是同一個額度
      if (templateLastErrorCode.value === 'quota_exceeded') showQuotaReached(PRESET_QUOTA_LABEL)
      else showErrorMessage(templateLastErrorMessage.value ?? '套用策略失敗')
      return
    }

    try {
      // Unlike addTab, no follow-up rename PATCH — the applied copy already carries the
      // template's own name (e.g. "巴菲特護城河"), which is exactly what should show here.
      const tab = registerTab(ctx.presetToTab(preset))
      await ctx.runSearch(tab)
    } catch (error) {
      if (import.meta.dev) console.error('[screener] failed to add the template tab to the page', error)
      showErrorMessage('策略已套用，但畫面顯示失敗，請重新整理')
    }
  }

  // The true "this account has zero saved presets" bootstrap (both a brand-new sign-up and the
  // "just closed my only tab" fallback in removeTab below) — NOT the same as a user explicitly
  // clicking "+" → "自訂篩選邏輯" in the dialog, which still goes straight to addTab's own plain
  // ROE > 30 seed unconditionally. Per direct confirmation ("自動套用股利穩健"), this bootstrap
  // case instead seeds from GET /screener/templates' own isDefault:true entry when one exists —
  // an officially-curated, methodology-backed starting point instead of an arbitrary hardcoded
  // condition, so a first-time visitor's screener never sits on a blank/meaningless "ROE > 30"
  // guess. Falls back to addTab's own plain default if the template list is empty/unreachable or
  // no template is currently marked isDefault (defensive — 業務中台's own contract already
  // guarantees "exactly one" today, but this shouldn't hard-fail if that ever briefly isn't true).
  async function addDefaultTab() {
    await loadTemplatesIfNeeded()
    const defaultTemplate = templates.value.find(template => template.isDefault && template.status === 'AVAILABLE' && template.filters.length)
    if (!defaultTemplate) {
      await addTab()
      return
    }
    await addTemplateTab(defaultTemplate.id)
  }

  async function renameTab(tab: ScreenerTab, name: string) {
    // 未儲存的（訪客的、深層連結打開的）— no backend preset to PATCH, just rename the local object.
    if (!currentUser.value || tab.unsaved) {
      tab.name = name
      return
    }

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

  // Persisted 2026-09-11, same treatment/reasoning as reorderColumnPresets above — 業務中台
  // shipped POST /screener/presets/reorder (commit 02529cd) alongside the column-preset one,
  // same full-replace-set contract.
  // 未儲存的固定在最前面、不送給後端（業務中台 要的是這個人全部已存的 id）
  async function reorderTabs(ids: string[]) {
    const byId = new Map(ctx.tabs.value.map(tab => [tab.id, tab]))
    const previous = ctx.tabs.value
    const saved = ids.filter(id => byId.get(id) && !byId.get(id)!.unsaved)
    ctx.tabs.value = [...previous.filter(tab => tab.unsaved), ...saved.map(id => byId.get(id)!)]
    if (!saved.length) return
    const ok = await reorderTabsApi(saved)
    if (!ok) {
      ctx.tabs.value = previous
      showErrorMessage(lastErrorMessage.value ?? '排序分頁失敗')
    }
  }

  async function removeTab(id: string) {
    // Belt-and-braces: the close icon is already hidden via :closable when this is the
    // last tab, but guard the handler too in case it's ever reachable another way.
    if (ctx.tabs.value.length <= 1) return

    const ok = await remove(id)
    if (!ok) {
      showErrorMessage(lastErrorMessage.value ?? '刪除分頁失敗')
      return
    }
    const index = ctx.tabs.value.findIndex(tab => tab.id === id)
    if (index === -1) return
    ctx.tabs.value.splice(index, 1)
    ctx.stopAutoSearch(id)
    if (ctx.activeTabId.value === String(id)) {
      const fallback = ctx.tabs.value[Math.max(index - 1, 0)]
      ctx.activeTabId.value = fallback ? String(fallback.id) : ''
    }
    if (!ctx.tabs.value.length) await addDefaultTab()
  }
  return {
    addTab,
    addLocalTab,
    addLocalCopy,
    saveTab,
    copyTab,
    addDefaultTab,
    newTabDialogVisible,
    openNewTabDialog,
    addTemplateTab,
    templates,
    templatesLoading,
    renameTab,
    reorderTabs,
    removeTab
  }
}
