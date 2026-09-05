<script setup lang="ts">
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

const router = useRouter()
const hasHydrated = useHasHydrated()
const showPeriod = useScreenerShowPeriod()
// Awaited (not just destructured) so this always resolves to the same settled value on
// the server and on the client — addTab's own default condition bakes a fixed ROE field
// label in the moment it's created, and reading schema.value before the real /filters fetch
// has settled would let the server capture the mock fallback's label while client hydration
// (which restores the already-resolved real data from the SSR payload) captures the real one
// instead, producing a hydration mismatch.
const { data: schema } = await useFilterSchema()
const {
  tabsReady,
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
  addConditionAndOpenPicker,
  rangeEditorVisible,
  rangeEditorSlot,
  rangeEditorTriggerEl,
  openRangeEditor,
  closeRangeEditor,
  changeRangeEditorPeriod,
  openFieldPicker,
  openColumnPicker,
  handleSelect,
  handleColumnTabChange,
  newColumnPresetDialogVisible,
  openNewColumnPresetDialog,
  confirmCustomColumnPreset,
  columnPresetTemplates,
  columnPresetTemplatesLoading,
  applyColumnPresetTemplate,
  renameColumnPreset,
  reorderColumnPresets,
  removeColumnPresetOption,
  handleReorderColumns,
  handleRemoveColumn,
  loadMoreResults,
  changeSort
} = useScreenerTabs()

// --- Filter-preset folder (screener preset itself) ---

// Every displayed tab is now always a real, backend-persisted preset — see removeTab/addTab
// below, and the no-guest-tab bootstrap in useScreenerTabs.ts — so every one is renameable/
// deletable (editable defaults to true when omitted, see PresetFolder.vue).
const presetItems = computed<PresetFolderItem[]>(() => displayedTabs.value.map(tab => ({ id: String(tab.id), name: tab.name })))

function findTab(id: string) {
  return displayedTabs.value.find(tab => String(tab.id) === id) ?? null
}

function handleRenamePreset(id: string, name: string) {
  const tab = findTab(id)
  if (tab) renameTab(tab, name)
}

function handleRemovePreset(id: string) {
  removeTab(id)
}

function handleReorderPresets(ids: string[]) {
  reorderTabs(ids)
}

// --- Column-preset folder (which columns the result table shows) ---
// No more "預設" sentinel leading the list (removed 2026-09-01 — see the removal commit for
// the full reasoning) — every item here is now a real, owned, renameable/deletable
// ColumnPreset; isDefault (see useScreenerTabs.ts's resolveDefaultColumnPresetId) decides
// what a tab opens to instead of a permanent placeholder tab competing with real ones for
// the same job. Column presets are a login-gated resource, so this folder is only ever
// shown once activeTab exists — see the template below.

const columnFolderItems = computed<PresetFolderItem[]>(() =>
  columnPresetOptions.value.map(option => ({ id: String(option.id), name: option.name }))
)

const activeColumnId = computed<string>({
  // Empty string (matches el-tabs's own "nothing selected" convention) rather than a
  // fallback id — activeTab.columnPresetId should only ever be genuinely null for the true
  // zero-column-preset case now (see resolveDefaultColumnPresetId), which has no tab to
  // highlight anyway since columnFolderItems is empty in that state too.
  get: () => activeTab.value?.columnPresetId ?? '',
  set: value => {
    if (activeTab.value) handleColumnTabChange(activeTab.value, value)
  }
})

function handleRenameColumnPreset(id: string, name: string) {
  renameColumnPreset(id, name)
}

function handleRemoveColumnPreset(id: string) {
  if (activeTab.value) removeColumnPresetOption(activeTab.value, id)
}

function handleReorderColumnPresets(ids: string[]) {
  reorderColumnPresets(ids)
}
</script>

<template>
  <div class="screener-page">
    <h1 class="screener-page__title">選股篩選</h1>

    <!-- Gated on hasHydrated too, not just tabsReady — tabsReady itself changes between the
         SSR render and the client's first hydration pass whenever Firebase's auth check
         happens to resolve fast (it did in local testing: a plain v-if/v-else on tabsReady
         alone produced real "Hydration node mismatch" warnings). hasHydrated is false on
         both the server and the client's first render no matter what (see useHasHydrated.ts),
         so this branch is guaranteed to agree during hydration regardless of that race —
         first tried <ClientOnly> for this, which also works during the initial load but
         re-defers on every remount, including a plain client-side navigation back to an
         already-bootstrapped screener (reported: a skeleton flash switching pages into
         /screener that a fresh reload didn't have). hasHydrated only flips once per browser
         session, so a later remount renders directly from the current tabsReady value with no
         artificial delay. -->
    <template v-if="hasHydrated && tabsReady">
      <SharedPresetFolder
        :items="presetItems"
        v-model:active-id="activeTabId"
        @add="openNewTabDialog"
        @rename="handleRenamePreset"
        @remove="handleRemovePreset"
        @reorder="handleReorderPresets"
      >
        <ScreenerOrganismFilters
          v-if="activeTab"
          :tab="activeTab"
          :categories="schema.categories"
          @add-condition="triggerEl => addConditionAndOpenPicker(activeTab!, triggerEl)"
          @change-slot-field="(slotId, triggerEl) => openFieldPicker(activeTab!, slotId, triggerEl)"
          @open-value-editor="(slotId, triggerEl) => openRangeEditor(activeTab!, slotId, triggerEl)"
          @remove-slot="slotId => removeSlot(activeTab!, slotId)"
        />
      </SharedPresetFolder>

      <div class="screener-page__result-header">
        <h2 class="screener-page__result-heading">搜尋結果</h2>
        <!-- Global, not per-tab — lives outside every SharedPresetFolder/column-preset tab
             below since flipping it affects every tab's table the same way (see
             useScreenerShowPeriod.ts). -->
        <label class="screener-page__period-toggle">
          <el-switch v-model="showPeriod" size="small" />
          <span>顯示資料時間</span>
        </label>
      </div>

      <SharedPresetFolder
        v-if="activeTab"
        fill-height
        :items="columnFolderItems"
        v-model:active-id="activeColumnId"
        @add="openNewColumnPresetDialog(activeTab!)"
        @rename="handleRenameColumnPreset"
        @remove="handleRemoveColumnPreset"
        @reorder="handleReorderColumnPresets"
      >
        <ScreenerOrganismResultBody
          :tab="activeTab"
          :categories="schema.categories"
          @reorder-columns="fields => handleReorderColumns(activeTab!, fields)"
          @remove-column="field => handleRemoveColumn(activeTab!, field)"
          @add-column-click="triggerEl => openColumnPicker(activeTab!, triggerEl)"
          @row-click="symbol => router.push(`/stock/${symbol}`)"
          @load-more="loadMoreResults(activeTab!)"
          @sort-change="(field, order) => changeSort(activeTab!, field, order)"
        />
      </SharedPresetFolder>

      <!-- Signed-out visitor: no local guest tab anymore (removed — the next default tab a
           fresh visitor sees is meant to come from the BFF instead), so there's genuinely
           nothing to show here yet. The "+" above (in the now-empty preset folder) already
           prompts login on click via openNewTabDialog's own gate. -->
      <el-empty v-else description="登入後即可使用選股篩選" />
    </template>

    <div v-else class="screener-page__skeleton">
      <el-skeleton :rows="2" animated />
      <h2 class="screener-page__result-heading">搜尋結果</h2>
      <el-skeleton :rows="6" animated />
    </div>

    <ScreenerOrganismIndicatorPicker
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      :current-field-id="pickerCurrentFieldId"
      :trigger-el="pickerTriggerEl"
      :hide-period="pickerMode === 'condition'"
      @select="handleSelect"
    />

    <!-- Shared across a brand-new condition (still just a draft — see useScreenerTabs.ts's
         rangeEditorSlot) and reassigning/editing an already-real one's value. Closing this
         is the only moment a new condition actually becomes a real slot (closeRangeEditor
         decides whether a value was actually set); update:model-value only ever fires false
         here (nothing else opens it), so there's no need to branch on the event's value. -->
    <ScreenerOrganismRangeEditorPopover
      v-if="schema"
      :model-value="rangeEditorVisible"
      :slot="rangeEditorSlot"
      :categories="schema.categories"
      :trigger-el="rangeEditorTriggerEl"
      @update:model-value="closeRangeEditor"
      @change-period="changeRangeEditorPeriod"
    />

    <ScreenerOrganismNewPresetDialog
      v-model="newTabDialogVisible"
      :templates="templates"
      :templates-loading="templatesLoading"
      @custom="addTab"
      @template="addTemplateTab"
    />

    <ScreenerOrganismNewColumnPresetDialog
      v-model="newColumnPresetDialogVisible"
      :templates="columnPresetTemplates"
      :templates-loading="columnPresetTemplatesLoading"
      @custom="confirmCustomColumnPreset"
      @template="applyColumnPresetTemplate"
    />
  </div>
</template>

<style scoped>
/* Bounded to the viewport (minus the app-shell chrome around this page) rather than normal
   document flow, so the result table's own SharedPresetFolder (fill-height, below) can be
   the one flex child that takes up whatever's left and scrolls internally — see that
   component's own fillHeight prop comment. Not done by changing desktop.vue/mobile.vue's
   shared app-shell itself (would affect every route in the app); the numbers below are this
   page's own copy of those two layouts' current .app-shell__content padding, mobile-first,
   overridden at the same 1280px breakpoint useDeviceLayout.ts uses to pick between them.
   Mobile subtracts AppFeatureMenu.vue's reserved 88px + safe-area (its floating home-button
   trigger, desktop has no equivalent); desktop subtracts its flat 20px bottom padding. */
.screener-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 88px - env(safe-area-inset-bottom));
}

@media (min-width: 1280px) {
  .screener-page {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 20px);
  }
}

.screener-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.screener-page__skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.screener-page__result-heading {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.screener-page__result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.screener-page__period-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
</style>
