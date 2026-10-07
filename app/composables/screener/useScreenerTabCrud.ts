import type { Ref } from 'vue'
import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import type { ScreenerTab, TabFilterSlot } from '~/composables/screener/screener-tab-model'
import { SCREENER_TAB_PAGE_SIZE, findRoeField } from '~/composables/screener/screener-tab-model'

// 篩選器的「頁籤增刪改」——建立（空白／範本／訪客／預設）、改名、排序、刪除。
// 2026-10-02 從 useScreenerTabs.ts 搬出來（第三刀，前兩刀是條件編輯與欄位組合）。
//
// ## 這一塊的風險比前兩刀高，而且是量出來的
//
// 四個叢集我量過各自對外的引用數：條件編輯 3 個、欄位組合 4 個、這一塊 **10 個**（`tabs` 用了 14 次、
// `activeTabId` 3 次、`handleSearch` 3 次）。它是最糾結的一塊，所以留到最後。
//
// 驗證覆蓋也不完整，實話說清楚：
//   - **有覆蓋**：`buildGuestTab` / `addGuestTab` / `registerTab` / `renameTab` ——
//     /screener?template=value 的訪客頁籤走的就是這條路，而 check-screener-operations.mjs
//     會驗它長出結果列、而且改名會生效。
//   - **沒覆蓋**：`addTab` / `addTemplateTab` / `addDefaultTab` / `reorderTabs` / `removeTab` ——
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
}) {
  const { data: schema } = useFilterSchema()
  const currentUser = useCurrentUser()
  const { open: openLogin } = useLoginDialog()
  const { create, update, remove, reorder: reorderTabsApi, list, lastErrorMessage, lastErrorCode } = useScreenerPresets()
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

  // The signed-out counterpart to presetToTab — per direct request ("普通股篩選 對陌生用戶還是要
  // 給完整的篩選功能" then "選完模板後可以繼續自由編輯條件") a guest still picks their own starting
  // filter strategy first (see ScreenerOrganismGuestStrategyPicker.vue — this is also a compliance
  // requirement per direct follow-up, "要自選 篩選條件 避免觸法": the app choosing conditions FOR
  // the visitor would read as a stock recommendation, the visitor choosing their own doesn't),
  // but the resulting tab is then fully editable through the exact same UI a signed-in tab uses
  // (ScreenerOrganismFilters/IndicatorPicker/RangeEditorPopover, column add/remove/reorder,
  // sorting) — every one of those handlers already takes a plain `tab: ScreenerTab` argument, so
  // they work here unchanged; only handleSearch/syncColumnPreset needed their own guest branch
  // (see each one's own comment) since those are the only two that ever talk to a backend
  // resource a guest doesn't have. `id` is a client-only, never-sent-to-any-API string — never
  // confuse it for a real preset UUID.
  function buildGuestTab(filters: FilterCriterion[], fieldKeys: string[]): ScreenerTab {
    return {
      id: `guest-${Date.now()}`,
      name: '訪客瀏覽',
      slots: ctx.buildSlots(filters),
      sectorCodes: [],
      sectorMode: 'include',
      columns: fieldKeys.map(field => ({ field, label: field })),
      columnPresetId: null,
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
      renameDraft: '訪客瀏覽'
    }
  }

  async function addGuestTab(filters: FilterCriterion[], fieldKeys: string[]) {
    const tab = registerTab(buildGuestTab(filters, fieldKeys))
    await ctx.runSearch(tab)
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
      if (lastErrorCode.value === 'quota_exceeded') showQuotaReached('篩選分頁')
      else showErrorMessage(lastErrorMessage.value ?? '新增分頁失敗')
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
      // 套用範本會新增一個篩選分頁，吃的是同一個額度
      if (templateLastErrorCode.value === 'quota_exceeded') showQuotaReached('篩選分頁')
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
  // no template is currently marked isDefault (defensive — bff-ts's own contract already
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
    // Guest tab — no backend preset to PATCH, just rename the local object.
    if (!currentUser.value) {
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

  // Persisted 2026-09-11, same treatment/reasoning as reorderColumnPresets above — bff-ts
  // shipped POST /screener/presets/reorder (commit 02529cd) alongside the column-preset one,
  // same full-replace-set contract.
  async function reorderTabs(ids: string[]) {
    const byId = new Map(ctx.tabs.value.map(tab => [tab.id, tab]))
    const previous = ctx.tabs.value
    ctx.tabs.value = ids.map(id => byId.get(id)).filter((tab): tab is ScreenerTab => !!tab)
    const ok = await reorderTabsApi(ids)
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
  }
}
