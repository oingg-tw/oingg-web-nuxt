import type { ConditionTab, TabFilterSlot } from '~/composables/screener/screener-tab-model'

// 篩選器的「條件編輯」——欄位挑選器 ＋ 區間編輯器 ＋ 移除條件。2026-10-02 從 useScreenerTabs.ts
// 搬出來（那個檔案 1410 行、回傳 48 個符號，而大部分行為沒有任何東西在驗；先補了
// scripts/check-screener-operations.mjs 當安全網才動）。
//
// 為什麼先搬這一塊：量過四個叢集對外的引用數，這一塊最少——22 個內部宣告，只用到核心的三個東西
// （下面的 ctx），而核心完全沒有反向依賴它。而且它是 Stage 0 那支檢查**覆蓋得到**的部分
//（挑選器、區間編輯器、移除條件、重跑查詢都在那 26 條斷言裡），所以搬完有東西會告訴我們壞了沒。
//
// useScreenerTabs 把這裡的回傳攤平進它自己的 return；漏掉任何一個符號會在 `nuxt typecheck` 當場爆。
// 2026-10-15 起泛型化：普通股、特別股、ETF 三組共用（三組的頁籤型別不同，只要有 ConditionTab 那三個欄位）。
// 2026-11-01 拿掉「新增欄位」模式（使用者：「新增欄位 按鈕從 篩選結果移除」，表格最後一欄的＋是它唯一的入口）：新增欄位只在欄位設定裡
//
// 面板裡改的是草稿（2026-11-09，使用者：「不採用套用，這樣只會更複雜。篩選條件請加上儲存取消按鈕，確保體驗一樣」，同欄位設定）：打開面板時把
// 那一組的條件複製一份，面板裡新增、修改、刪除都改這份；「儲存」才整份換回頁籤，查詢與已存的那組存回帳號照舊由 useScreenerTabs／
// useUniverseScreener 的監看接手（一次儲存只查一次）；「取消」、×、Esc、點外面就丟掉。電腦版頁面上膠囊的 × 不在面板裡，照舊馬上刪
type DraftTab = Pick<ConditionTab, 'slots'>
const cloneSlots = (slots: TabFilterSlot[]): TabFilterSlot[] => JSON.parse(JSON.stringify(slots))

export function useScreenerConditionEditor<T extends ConditionTab>() {
  const draft = shallowRef<{ source: T, copy: DraftTab } | null>(null)
  // 手機的條件清單畫的是最後一份草稿：關掉的動畫裡內容不換（同面板的 lastStep），取消時不會先閃回原本的條件
  const shownCopy = shallowRef<DraftTab | null>(null)
  // 面板開著、同一組還在改就沿用（從清單進去選指標、設定範圍都是同一份草稿）；從關著的面板打開一律重新複製
  function draftOf(tab: T): DraftTab {
    if (panelOpen.value && draft.value?.source === tab) return draft.value.copy
    const copy: DraftTab = reactive({ slots: cloneSlots(tab.slots) })
    draft.value = { source: tab, copy }
    shownCopy.value = copy
    return copy
  }
  const draftSlots = computed(() => shownCopy.value?.slots ?? null)

  // One shared picker dialog, always on `pickerTargetTab` (distinct from the page-level
  // `activeTab`: this tracks which tab the dialog itself is currently pointed at, not which tab
  // is on screen). `pickerTargetSlotId` is null while adding a brand-new condition (there's no
  // slot yet to point at) and a real id while reassigning an already-filled pill's field; both go
  // through the same dialog, never two different flows.
  const pickerVisible = ref(false)
  // 指著草稿（draftOf），不是頁籤本身
  const pickerTargetTab = shallowRef<DraftTab | null>(null)
  const pickerTargetSlotId = ref<number | null>(null)

  // 手機的條件清單（2026-10-31，使用者選結果區方案 B，並要「篩選條件與欄位設定，兩個操作體驗方式應該要一樣」）：手機上條件不再
  // 攤在頁面上，按「篩選條件 N 個」打開同一個面板的第一頁（ScreenerConditionPanel 的 list），新增、修改都在這個面板裡換頁，不疊彈窗。
  // 從清單進去的那幾步，「完成」回到清單（finishStep），關掉面板（×、Esc、點外面）才整個關（closePanel）。電腦版不打開清單
  const listVisible = ref(false)
  function openConditionList(tab: T) {
    pickerTargetTab.value = draftOf(tab)
    listVisible.value = true
  }

  function nextSlotId(tab: DraftTab): number {
    return tab.slots.reduce((max, slot) => Math.max(max, slot.id), -1) + 1
  }

  // slotId null＝「新增條件」— per explicit feedback, pressing it must NOT add anything to tab.slots
  // yet (an earlier version appended a blank placeholder immediately, which the user pointed out
  // reads as "a new filter already exists" even before a field or value is chosen). handleSelect
  // below only actually creates a slot once a value has been set too (see commitDraft).
  function openFieldPicker(tab: T, slotId: number | null) {
    pickerTargetTab.value = draftOf(tab)
    pickerTargetSlotId.value = slotId
    pickerVisible.value = true
  }

  // The field already on the slot being edited, if any — so the picker dialog can jump
  // straight to that field's own 大/中/小 (category/metric) location instead of always
  // resetting to the first category. Null for a brand-new condition (nothing to jump to yet).
  const pickerCurrentFieldId = computed<string | null>(() => {
    if (!pickerTargetTab.value) return null
    const slot = pickerTargetTab.value.slots.find((item: TabFilterSlot) => item.id === pickerTargetSlotId.value)
    return slot?.fieldId ?? null
  })

  // 條件的數值編輯器——所有膠囊共用一個（ScreenerRangeEditor），不屬於任何一顆，新條件才能跟編輯既有條件走同一條 UI／資料流。
  // `rangeEditorDraftSlot` 放新增中、還不是真 slot 的那一個；`rangeEditorSlotId` 放編輯既有膠囊時的 id——兩者不會同時有值。
  // 下面的 rangeEditorSlot 是兩種情況共同綁定的來源，min／max／exclude 的 v-model 接法一致。
  const rangeEditorVisible = ref(false)
  const rangeEditorTab = shallowRef<DraftTab | null>(null)
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
    rangeEditorTab.value = draftOf(tab)
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

  // 新條件在設了值的那一刻放進草稿的條件裡（2026-10-31 起是直接進頁籤、馬上查；2026-11-09 改成草稿，按「儲存」才查），之後跟編輯
  // 既有條件一樣直接綁在那一個 slot 上。只挑了指標、沒設值，照舊不算一個條件（使用者明文要求：指標與值都設了才算）。
  // 同一個物件從新條件搬進草稿的條件，編輯器綁的還是它，輸入框不會重建、焦點不會掉
  const hasValue = (slot: TabFilterSlot) => slot.min !== null || slot.max !== null || (slot.values?.length ?? 0) > 0
  function commitDraft() {
    const draft = rangeEditorDraftSlot.value
    if (!draft || !rangeEditorTab.value || !hasValue(draft)) return
    rangeEditorTab.value.slots.push(draft)
    rangeEditorSlotId.value = draft.id
    rangeEditorDraftSlot.value = null
  }
  watch(() => rangeEditorDraftSlot.value && hasValue(rangeEditorDraftSlot.value), commitDraft)

  function closeRangeEditor() {
    commitDraft()
    // Deliberately NOT clearing rangeEditorTab/SlotId/DraftSlot here — the popover
    // (desktop) stays mounted across a close the same way ScreenerConditionPill's own used to
    // (only ever v-if'd on having a field, never on being open), so its close transition can
    // actually play instead of the slot disappearing out from under it mid-fade. The next
    // openRangeEditor or handleSelect call overwrites all of these anyway before the editor
    // is shown again, so nothing stale here can leak into whatever opens next.
    rangeEditorVisible.value = false
  }

  function handleSelect(fieldId: string, fieldLabel: string) {
    if (!pickerTargetTab.value) return
    const tab = pickerTargetTab.value

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
      // commitDraft for when/whether it becomes one).
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
  }

  // 面板的「上一步：換指標」：回到第一步；新條件的草稿丟掉（選了新指標會再開一份），已存在的條件則是換它的指標
  function backToPicker() {
    pickerTargetTab.value = rangeEditorTab.value
    pickerTargetSlotId.value = rangeEditorDraftSlot.value ? null : rangeEditorSlotId.value
    rangeEditorDraftSlot.value = null
    rangeEditorVisible.value = false
    pickerVisible.value = true
  }

  // 手機面板的「完成」（設定範圍）與「上一步：條件清單」（選指標）：回到清單，草稿留著
  function finishStep() {
    if (rangeEditorVisible.value) closeRangeEditor()
    else pickerVisible.value = false
  }

  function closeAll() {
    draft.value = null
    rangeEditorVisible.value = false
    pickerVisible.value = false
    listVisible.value = false
  }

  // 「儲存」：設定範圍裡的新條件有值就收進來，整份草稿換回頁籤
  function savePanel() {
    commitDraft()
    if (draft.value) draft.value.source.slots = cloneSlots(draft.value.copy.slots)
    closeAll()
  }

  // 「取消」、×、Esc、點外面：草稿丟掉
  function closePanel() {
    closeAll()
  }

  const panelOpen = computed(() => listVisible.value || pickerVisible.value || rangeEditorVisible.value)
  // 面板開著時刪的是草稿（手機的條件清單）；關著時是頁面上的膠囊（電腦版）或空狀態的按鈕，馬上刪
  function removeSlot(tab: T, slotId: number) {
    const target: DraftTab = panelOpen.value && draft.value?.source === tab ? draft.value.copy : tab
    target.slots = target.slots.filter(slot => slot.id !== slotId)
  }
  return {
    draftSlots,
    savePanel,
    pickerVisible,
    pickerCurrentFieldId,
    openFieldPicker,
    handleSelect,
    removeSlot,
    rangeEditorVisible,
    rangeEditorSlot,
    openRangeEditor,
    closeRangeEditor,
    changeRangeEditorPeriod,
    backToPicker,
    listVisible,
    openConditionList,
    finishStep,
    closePanel
  }
}
