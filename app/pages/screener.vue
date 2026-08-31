<script setup lang="ts">
import { GUEST_TAB_ID } from '~/composables/useScreenerTabs'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

const router = useRouter()
const hasHydrated = useHasHydrated()
// Awaited (not just destructured) so this always resolves to the same settled value on
// the server and on the client — useScreenerTabs' guest tab bakes a fixed ROE field label
// into its default condition the moment it's created, and reading schema.value before the
// real /filters fetch has settled would let the server capture the mock fallback's label
// while client hydration (which restores the already-resolved real data from the SSR
// payload) captures the real one instead, producing a hydration mismatch.
const { data: schema } = await useFilterSchema()
const { open: openLogin } = useLoginDialog()
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
  addEmptySlot,
  changeSlotPeriod,
  openFieldPicker,
  openColumnPicker,
  handleSelect,
  handleColumnTabChange,
  addColumnPresetOption,
  renameColumnPreset,
  reorderColumnPresets,
  removeColumnPresetOption,
  handleReorderColumns,
  handleRemoveColumn,
  changePage,
  changePageSize,
  isGuestTab
} = useScreenerTabs()

// --- Filter-preset folder (screener preset itself) ---

const presetItems = computed<PresetFolderItem[]>(() =>
  displayedTabs.value.map(tab => ({ id: String(tab.id), name: tab.name, editable: tab.id !== GUEST_TAB_ID }))
)

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
// "預設" always leads the list and stands in for columnPresetId = null — it isn't a real
// saved resource (there's nothing server-side to rename or delete), so it's the one item
// marked non-editable. Column presets are a login-gated resource, so this folder is only
// ever shown for a real (non-guest) tab — see the template below.

const columnFolderItems = computed<PresetFolderItem[]>(() => [
  { id: 'default', name: '預設', editable: false },
  ...columnPresetOptions.value.map(option => ({ id: String(option.id), name: option.name }))
])

const activeColumnId = computed<string>({
  get: () => {
    const id = activeTab.value?.columnPresetId
    return id == null ? 'default' : String(id)
  },
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

// The "預設" sentinel is locked (non-draggable, see PresetFolder.vue's sortable filter) so
// it shouldn't ever move, but its id is filtered out here defensively anyway (it isn't a
// real column-preset id, so passing it through would just fail to match anything).
function handleReorderColumnPresets(ids: string[]) {
  reorderColumnPresets(ids.filter(id => id !== 'default'))
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
          @add-condition="addEmptySlot(activeTab!)"
          @change-slot-field="(slotId, triggerEl) => openFieldPicker(activeTab!, slotId, triggerEl)"
          @change-slot-period="(slotId, fieldId) => changeSlotPeriod(activeTab!, slotId, fieldId)"
          @remove-slot="slotId => removeSlot(activeTab!, slotId)"
        />
      </SharedPresetFolder>

      <h2 class="screener-page__result-heading">搜尋結果</h2>

      <SharedPresetFolder
        v-if="activeTab && !isGuestTab(activeTab)"
        :items="columnFolderItems"
        v-model:active-id="activeColumnId"
        @add="addColumnPresetOption(activeTab!)"
        @rename="handleRenameColumnPreset"
        @remove="handleRemoveColumnPreset"
        @reorder="handleReorderColumnPresets"
      >
        <ScreenerOrganismResultBody
          :tab="activeTab"
          @reorder-columns="fields => handleReorderColumns(activeTab!, fields)"
          @remove-column="field => handleRemoveColumn(activeTab!, field)"
          @add-column-click="triggerEl => openColumnPicker(activeTab!, triggerEl)"
          @row-click="symbol => router.push(`/stock/${symbol}`)"
          @page-change="page => changePage(activeTab!, page)"
          @page-size-change="pageSize => changePageSize(activeTab!, pageSize)"
        />
      </SharedPresetFolder>

      <ScreenerOrganismResultBody
        v-else-if="activeTab"
        :tab="activeTab"
        @reorder-columns="fields => handleReorderColumns(activeTab!, fields)"
        @remove-column="field => handleRemoveColumn(activeTab!, field)"
        @add-column-click="openLogin()"
        @row-click="symbol => router.push(`/stock/${symbol}`)"
        @page-change="page => changePage(activeTab!, page)"
        @page-size-change="pageSize => changePageSize(activeTab!, pageSize)"
      />
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

    <ScreenerOrganismNewPresetDialog
      v-model="newTabDialogVisible"
      :templates="templates"
      :templates-loading="templatesLoading"
      @custom="addTab"
      @template="addTemplateTab"
    />
  </div>
</template>

<style scoped>
.screener-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.screener-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 8px 0 0;
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
</style>
