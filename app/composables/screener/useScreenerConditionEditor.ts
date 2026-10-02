import type { ScreenerTab, TabFilterSlot } from '~/composables/screener/screener-tab-model'

// 篩選器的「條件編輯」——欄位挑選器 ＋ 區間編輯器 ＋ 移除條件。2026-10-02 從 useScreenerTabs.ts
// 搬出來（那個檔案 1410 行、回傳 48 個符號，而大部分行為沒有任何東西在驗；先補了
// scripts/check-screener-operations.mjs 當安全網才動）。
//
// 為什麼先搬這一塊：量過四個叢集對外的引用數，這一塊最少——22 個內部宣告，只用到核心的三個東西
// （下面的 ctx），而核心完全沒有反向依賴它。而且它是 Stage 0 那支檢查**覆蓋得到**的部分
//（挑選器、區間編輯器、移除條件、重跑查詢都在那 26 條斷言裡），所以搬完有東西會告訴我們壞了沒。
//
// 依賴用**回呼注入**而不是 import 核心：那是避免循環依賴的關鍵（核心要呼叫這裡、這裡要呼叫核心的
// handleSearch）。三個都是核心已經存在的函式，沒有為了這次搬家新增的介面。
//
// 公開介面刻意一字不改：useScreenerTabs 把這裡的回傳攤平進它自己的 return，所以
// app/pages/screener/index.vue 一個字都不用動。漏掉任何一個符號會在 `nuxt typecheck` 當場爆。
export function useScreenerConditionEditor(ctx: {
  // 欄位加到 tab.columns 之後要同步到後端的欄位預設。
  syncColumnPreset: (tab: ScreenerTab) => Promise<void>
  // 核心的 handleSearch。加了欄位而這個頁籤已經搜過，就立刻重跑一次把新欄位的值補上。
  runSearch: (tab: ScreenerTab) => Promise<void>
  // 還沒搜過的頁籤只更新本地快取，不要為了一個新欄位逼出「請先設條件」的警告。
  cacheColumnView: (tab: ScreenerTab) => void
}) {
  // One shared picker dialog — `pickerMode` decides whether a selection sets a condition
  // slot's field or adds a results column, both always on `pickerTargetTab` (distinct from
  // the page-level `activeTab` computed above: this tracks which tab the dialog itself is
  // currently pointed at, not which tab is on screen). In 'condition' mode, `pickerTargetSlotId`
  // is null while adding a brand-new condition (see addConditionAndOpenPicker below — there's
  // no slot yet to point at) and a real id while reassigning an already-filled pill's field;
  // both go through the same dialog, never two different flows.
  const pickerVisible = ref(false)
  const pickerMode = ref<'condition' | 'column'>('condition')
  const pickerTargetTab = ref<ScreenerTab | null>(null)
  const pickerTargetSlotId = ref<number | null>(null)
  // The button that opened the picker — on desktop it's shown as a dropdown anchored to
  // this element instead of a fullscreen dialog (see OrganismIndicatorPicker's triggerEl
  // prop). Unused on mobile, which always stays fullscreen regardless of what this holds.
  const pickerTriggerEl = ref<HTMLElement | null>(null)

  function nextSlotId(tab: ScreenerTab): number {
    return tab.slots.reduce((max, slot) => Math.max(max, slot.id), -1) + 1
  }

  function openFieldPicker(tab: ScreenerTab, slotId: number | null, triggerEl: HTMLElement) {
    pickerTargetTab.value = tab
    pickerTargetSlotId.value = slotId
    pickerTriggerEl.value = triggerEl
    pickerMode.value = 'condition'
    pickerVisible.value = true
  }

  // "新增條件" — per explicit feedback, pressing this must NOT add anything to tab.slots yet
  // (an earlier version appended a blank placeholder immediately, which the user pointed out
  // reads as "a new filter already exists" even before a field or value is chosen). This just
  // opens the field picker with no target slot (null); handleSelect below only actually
  // creates a slot once a value has been set too (see closeRangeEditor).
  function addConditionAndOpenPicker(tab: ScreenerTab, triggerEl: HTMLElement) {
    openFieldPicker(tab, null, triggerEl)
  }

  function openColumnPicker(tab: ScreenerTab, triggerEl: HTMLElement) {
    pickerTargetTab.value = tab
    pickerTriggerEl.value = triggerEl
    pickerMode.value = 'column'
    pickerVisible.value = true
  }

  // The field already on the slot being edited, if any — so the picker dialog can jump
  // straight to that field's own 大/中/小 (category/metric) location instead of always
  // resetting to the first category. Null for a brand-new condition (nothing to jump to yet)
  // and for the column picker (adding a column has no "current field" to speak of).
  const pickerCurrentFieldId = computed<string | null>(() => {
    if (pickerMode.value !== 'condition' || !pickerTargetTab.value) return null
    const slot = pickerTargetTab.value.slots.find(item => item.id === pickerTargetSlotId.value)
    return slot?.fieldId ?? null
  })

  // Condition's value editor — shared across every pill (OrganismRangeEditorPopover.vue),
  // not owned by any one of them, specifically so a brand-new condition can go through the
  // exact same UI/data flow as editing an already-filled one, before it's even a real slot.
  // `rangeEditorDraftSlot` holds that not-yet-real slot while adding; `rangeEditorSlotId`
  // holds a real one's id while editing an existing pill's value — never both at once.
  // rangeEditorSlot below is the single source either UI binds to, so min/max/exclude use the
  // exact same v-model wiring regardless of which case this is.
  const rangeEditorVisible = ref(false)
  const rangeEditorTab = ref<ScreenerTab | null>(null)
  const rangeEditorTriggerEl = ref<HTMLElement | null>(null)
  const rangeEditorSlotId = ref<number | null>(null)
  const rangeEditorDraftSlot = ref<TabFilterSlot | null>(null)

  const rangeEditorSlot = computed<TabFilterSlot | null>(() => {
    if (rangeEditorDraftSlot.value) return rangeEditorDraftSlot.value
    if (!rangeEditorTab.value || rangeEditorSlotId.value === null) return null
    return rangeEditorTab.value.slots.find(slot => slot.id === rangeEditorSlotId.value) ?? null
  })

  // Real bug fixed 2026-09-09 (reported live: "點選選項後無反應 也沒送出API請求" — traced to
  // TWO separate causes, this is the second; see MoleculeIndicatorPickerBody.vue's own
  // expandFields/collapseFields comments for the first, a wrong field label). handleSelect
  // below (both branches that come from the field-picker chain, not openRangeEditor's own
  // direct-from-a-pill path) sets rangeEditorTriggerEl to pickerTriggerEl — the SAME "新增條件"
  // button OrganismIndicatorPicker's own popover was JUST anchored to via virtual-triggering,
  // which closes (`pickerVisible = false`) in the very same click handler that opens this one.
  // Two el-popover instances racing to attach/detach virtual-triggering on the identical
  // trigger element within one synchronous tick left the second one's popper root stuck at
  // `display: none` despite its content rendering correctly and its fade transition reporting
  // "entered" (confirmed live via computed style — a real Popper.js/Element-Plus timing issue,
  // not a Vue reactivity bug) — openRangeEditor's own direct-from-a-pill path never hit this,
  // since it never shares a trigger element with a just-closed popover.
  //
  // A bare `await nextTick()` was NOT enough — confirmed live it still left the popover stuck
  // at display:none, meaning this is real wall-clock Popper.js/DOM teardown time, not just a
  // Vue render-flush ordering issue. 100ms was tested live (repeated back-to-back attempts,
  // both the brand-new-condition path and the reassign-existing-pill's-field path) and
  // reliably resolved it every time; imperceptible to a user (well under commonly-cited
  // "feels instant" UX thresholds) but real enough to let the just-closing popover's own
  // teardown finish first.
  async function openRangeEditorNextTick() {
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    rangeEditorVisible.value = true
  }

  // Opens the value editor for an already-filled pill (its own value button, not the field
  // picker chain) — the counterpart to the draft-slot path handleSelect takes below.
  function openRangeEditor(tab: ScreenerTab, slotId: number, triggerEl: HTMLElement) {
    rangeEditorTab.value = tab
    rangeEditorSlotId.value = slotId
    rangeEditorDraftSlot.value = null
    rangeEditorTriggerEl.value = triggerEl
    rangeEditorVisible.value = true
  }

  // Switching a condition's period (via the range editor's own period switcher, see
  // periodSiblingsOf in useFilterSchema.ts) rather than picking an unrelated field —
  // fieldLabel is already period-agnostic (just the metric name) so it doesn't need
  // updating, and this deliberately leaves min/max/exclude alone: it's a refinement of the
  // same condition, not a fresh one. Mutates rangeEditorSlot directly (works whether that's a
  // real slot already in tab.slots or still just the draft) rather than looking one up by id,
  // since a draft in progress has no id in tab.slots to find yet.
  function changeRangeEditorPeriod(fieldId: string) {
    if (rangeEditorSlot.value) rangeEditorSlot.value.fieldId = fieldId
  }

  // Closing the editor is the only moment a brand-new condition actually becomes real —
  // pressing "新增條件" and then picking a field builds a draft slot (see handleSelect) that
  // lives only in rangeEditorDraftSlot until now. Only commits it if the user actually set a
  // value; picking a field and closing without touching min/max is treated as abandoning the
  // add, exactly matching the explicit request that nothing gets added to the filter list
  // until a field AND a value are both set. Editing an already-real slot needs no such
  // commit step here — its min/max/exclude are two-way-bound straight onto the real slot the
  // whole time this was open, so they're already live.
  function closeRangeEditor() {
    const draft = rangeEditorDraftSlot.value
    if (draft && rangeEditorTab.value && (draft.min !== null || draft.max !== null)) {
      rangeEditorTab.value.slots.push(draft)
    }
    // Deliberately NOT clearing rangeEditorTab/SlotId/DraftSlot/TriggerEl here — the popover
    // (desktop) stays mounted across a close the same way OrganismConditionPill's own used to
    // (only ever v-if'd on having a field, never on being open), so its close transition can
    // actually play instead of the slot disappearing out from under it mid-fade. The next
    // openRangeEditor or handleSelect call overwrites all of these anyway before the editor
    // is shown again, so nothing stale here can leak into whatever opens next.
    rangeEditorVisible.value = false
  }

  async function handleSelect(fieldId: string, fieldLabel: string) {
    if (!pickerTargetTab.value) return
    const tab = pickerTargetTab.value

    if (pickerMode.value === 'condition') {
      if (pickerTargetSlotId.value === null) {
        // Brand-new condition — field's picked, but this isn't a real slot yet (see
        // closeRangeEditor for when/whether it becomes one). Anchoring the value editor to
        // pickerTriggerEl (the same "新增條件" button that opened the field picker) since
        // there's no pill of its own yet to anchor to.
        rangeEditorDraftSlot.value = { id: nextSlotId(tab), fieldId, fieldLabel, min: null, max: null, exclude: false }
        rangeEditorTab.value = tab
        rangeEditorSlotId.value = null
        rangeEditorTriggerEl.value = pickerTriggerEl.value
        await openRangeEditorNextTick()
        return
      }

      const slot = tab.slots.find(item => item.id === pickerTargetSlotId.value)
      if (!slot) return
      // Assigning a *different* field than before — the old range no longer means anything
      // against a different metric, so it resets rather than carrying over.
      slot.fieldId = fieldId
      slot.fieldLabel = fieldLabel
      slot.min = null
      slot.max = null
      slot.exclude = false
      rangeEditorTab.value = tab
      rangeEditorSlotId.value = slot.id
      rangeEditorDraftSlot.value = null
      rangeEditorTriggerEl.value = pickerTriggerEl.value
      await openRangeEditorNextTick()
      return
    }

    if (tab.columns.some(column => column.field === fieldId)) return
    tab.columns.push({ field: fieldId, label: fieldLabel })
    await ctx.syncColumnPreset(tab)
    // Fetch data for the newly added column right away instead of leaving it showing
    // placeholders until the next filter edit — only once this tab already has results
    // to refresh, so adding a column before ever searching doesn't force a premature
    // "set a filter first" warning. handleSearch already re-caches on completion; this
    // covers the case where nothing's been searched yet.
    if (tab.searched) await ctx.runSearch(tab)
    else ctx.cacheColumnView(tab)
  }

  function removeSlot(tab: ScreenerTab, slotId: number) {
    tab.slots = tab.slots.filter(slot => slot.id !== slotId)
  }
  return {
    pickerVisible,
    pickerMode,
    pickerCurrentFieldId,
    pickerTriggerEl,
    openFieldPicker,
    openColumnPicker,
    addConditionAndOpenPicker,
    handleSelect,
    removeSlot,
    rangeEditorVisible,
    rangeEditorSlot,
    rangeEditorTriggerEl,
    openRangeEditor,
    closeRangeEditor,
    changeRangeEditorPeriod
  }
}
