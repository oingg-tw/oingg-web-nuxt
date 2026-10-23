import type { ConditionTab, ResultColumnChoice, TabFilterSlot } from '~/composables/screener/screener-tab-model'

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
// 2026-10-15 起泛型化：普通股、特別股、ETF 三組共用（三組的頁籤型別不同，只要有 ConditionTab 那三個欄位）。
export function useScreenerConditionEditor<T extends ConditionTab>(ctx: {
  // 欄位加到 tab.columns 之後要同步到後端的欄位預設。
  syncColumnPreset: (tab: T) => Promise<void>
  // 核心的 handleSearch。加了欄位而這個頁籤已經搜過，就立刻重跑一次把新欄位的值補上。
  runSearch: (tab: T) => Promise<void>
  // 還沒搜過的頁籤只更新本地快取，不要為了一個新欄位逼出「請先設條件」的警告。
  cacheColumnView: (tab: T) => void
}) {
  // One shared picker dialog — `pickerMode` decides whether a selection sets a condition
  // slot's field or adds a results column, both always on `pickerTargetTab` (distinct from
  // the page-level `activeTab` computed above: this tracks which tab the dialog itself is
  // currently pointed at, not which tab is on screen). In 'condition' mode, `pickerTargetSlotId`
  // is null while adding a brand-new condition (there's no slot yet to point at) and a real id
  // while reassigning an already-filled pill's field; both go through the same dialog, never two
  // different flows.
  const pickerVisible = ref(false)
  const pickerMode = ref<'condition' | 'column'>('condition')
  // shallowRef：T 是泛型，ref 會把它包成 UnwrapRef<T> 而對不上型別；頁籤本身已經是父層的響應式物件，改它的欄位照樣會更新
  const pickerTargetTab = shallowRef<T | null>(null)
  const pickerTargetSlotId = ref<number | null>(null)

  function nextSlotId(tab: T): number {
    return tab.slots.reduce((max, slot) => Math.max(max, slot.id), -1) + 1
  }

  // slotId null＝「新增條件」— per explicit feedback, pressing it must NOT add anything to tab.slots
  // yet (an earlier version appended a blank placeholder immediately, which the user pointed out
  // reads as "a new filter already exists" even before a field or value is chosen). handleSelect
  // below only actually creates a slot once a value has been set too (see closeRangeEditor).
  function openFieldPicker(tab: T, slotId: number | null) {
    pickerTargetTab.value = tab
    pickerTargetSlotId.value = slotId
    pickerMode.value = 'condition'
    pickerVisible.value = true
  }

  function openColumnPicker(tab: T) {
    pickerTargetTab.value = tab
    pickerMode.value = 'column'
    pickerVisible.value = true
  }

  // The field already on the slot being edited, if any — so the picker dialog can jump
  // straight to that field's own 大/中/小 (category/metric) location instead of always
  // resetting to the first category. Null for a brand-new condition (nothing to jump to yet)
  // and for the column picker (adding a column has no "current field" to speak of).
  const pickerCurrentFieldId = computed<string | null>(() => {
    if (pickerMode.value !== 'condition' || !pickerTargetTab.value) return null
    const slot = pickerTargetTab.value.slots.find((item: TabFilterSlot) => item.id === pickerTargetSlotId.value)
    return slot?.fieldId ?? null
  })

  // 條件的數值編輯器——所有膠囊共用一個（ScreenerRangeEditor），不屬於任何一顆，新條件才能跟編輯既有條件走同一條 UI／資料流。
  // `rangeEditorDraftSlot` 放新增中、還不是真 slot 的那一個；`rangeEditorSlotId` 放編輯既有膠囊時的 id——兩者不會同時有值。
  // 下面的 rangeEditorSlot 是兩種情況共同綁定的來源，min／max／exclude 的 v-model 接法一致。
  const rangeEditorVisible = ref(false)
  const rangeEditorTab = shallowRef<T | null>(null)
  const rangeEditorSlotId = ref<number | null>(null)
  const rangeEditorDraftSlot = ref<TabFilterSlot | null>(null)

  const rangeEditorSlot = computed<TabFilterSlot | null>(() => {
    if (rangeEditorDraftSlot.value) return rangeEditorDraftSlot.value
    if (!rangeEditorTab.value || rangeEditorSlotId.value === null) return null
    return rangeEditorTab.value.slots.find((slot: TabFilterSlot) => slot.id === rangeEditorSlotId.value) ?? null
  })

  // 選指標與設定範圍在同一個面板（ScreenerConditionPanel，2026-10-07）：直接換到第二步，兩個旗標同一拍交換，面板不會閃一下關掉。
  // 以前是兩個 popover，要先關掉選指標的、等 100ms 再開範圍編輯的（Popper.js 拆掉同一個觸發元素的時間差）
  function switchToRangeStep() {
    rangeEditorVisible.value = true
    pickerVisible.value = false
  }

  // Opens the value editor for an already-filled pill (its own value button, not the field
  // picker chain) — the counterpart to the draft-slot path handleSelect takes below.
  function openRangeEditor(tab: T, slotId: number) {
    rangeEditorTab.value = tab
    rangeEditorSlotId.value = slotId
    rangeEditorDraftSlot.value = null
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
    if (draft && rangeEditorTab.value && (draft.min !== null || draft.max !== null || (draft.values?.length ?? 0) > 0)) {
      rangeEditorTab.value.slots.push(draft)
    }
    // Deliberately NOT clearing rangeEditorTab/SlotId/DraftSlot here — the popover
    // (desktop) stays mounted across a close the same way ScreenerConditionPill's own used to
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
      // 類股一組只有一個（2026-10-19，使用者要「包含特定產業與排除特定產業」）：每家公司只屬於一個類股，「包含 A」加「排除 B」
      // 等於只寫「包含 A」；而且送出時只看第一個（sectorScopeFor），以前第二顆膠囊看得到卻被默默忽略、存檔重開也不見。
      // 已經有了就打開原本那一個，在那裡切換包含／排除、改勾選。普通股才有類股，ETF、特別股不會走到
      // 已經持有同一條（2026-10-22）：業務中台 只收一組包含或排除，三組都一樣
      const existingSector = fieldId === SECTOR_FIELD_ID || isHeldField(fieldId)
        ? tab.slots.find((item: TabFilterSlot) => item.fieldId === fieldId && item.id !== pickerTargetSlotId.value)
        : undefined
      if (existingSector) {
        rangeEditorTab.value = tab
        rangeEditorSlotId.value = existingSector.id
        rangeEditorDraftSlot.value = null
        switchToRangeStep()
        return
      }

      if (pickerTargetSlotId.value === null) {
        // Brand-new condition — field's picked, but this isn't a real slot yet (see
        // closeRangeEditor for when/whether it becomes one).
        rangeEditorDraftSlot.value = { id: nextSlotId(tab), fieldId, fieldLabel, min: null, max: null, exclude: false }
        rangeEditorTab.value = tab
        rangeEditorSlotId.value = null
        switchToRangeStep()
        return
      }

      const slot = tab.slots.find((item: TabFilterSlot) => item.id === pickerTargetSlotId.value)
      if (!slot) return
      // Assigning a *different* field than before — the old range no longer means anything
      // against a different metric, so it resets rather than carrying over.
      slot.fieldId = fieldId
      slot.fieldLabel = fieldLabel
      slot.min = null
      slot.max = null
      slot.exclude = false
      slot.values = undefined
      rangeEditorTab.value = tab
      rangeEditorSlotId.value = slot.id
      rangeEditorDraftSlot.value = null
      switchToRangeStep()
      return
    }

    // 新增欄位是一步就完成：選了就關面板（2026-10-07 換成現在這個面板時漏掉了，舊的挑選器選完就關；2026-10-15 一致性檢查抓到，三組都是）
    pickerVisible.value = false
    if (tab.columns.some((column: ResultColumnChoice) => column.field === fieldId)) return
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

  // 面板的「上一步：換指標」：回到第一步；新條件的草稿丟掉（選了新指標會再開一份），已存在的條件則是換它的指標
  function backToPicker() {
    pickerTargetTab.value = rangeEditorTab.value
    pickerTargetSlotId.value = rangeEditorDraftSlot.value ? null : rangeEditorSlotId.value
    pickerMode.value = 'condition'
    rangeEditorDraftSlot.value = null
    rangeEditorVisible.value = false
    pickerVisible.value = true
  }

  // 面板關閉：在第二步就照原本的規則收尾（有值才把草稿變成條件），在第一步就只是關掉
  function closePanel() {
    if (rangeEditorVisible.value) closeRangeEditor()
    else pickerVisible.value = false
  }

  function removeSlot(tab: T, slotId: number) {
    tab.slots = tab.slots.filter(slot => slot.id !== slotId)
  }
  return {
    pickerVisible,
    pickerMode,
    pickerCurrentFieldId,
    openFieldPicker,
    openColumnPicker,
    handleSelect,
    removeSlot,
    rangeEditorVisible,
    rangeEditorSlot,
    openRangeEditor,
    closeRangeEditor,
    changeRangeEditorPeriod,
    backToPicker,
    closePanel
  }
}
