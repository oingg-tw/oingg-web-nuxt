<script setup lang="ts">
import { GUEST_TAB_ID } from '~/composables/useScreenerTabs'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

const router = useRouter()
// Awaited (not just destructured) so this always resolves to the same settled value on
// the server and on the client — useScreenerTabs' guest tab bakes a fixed ROE field label
// into its default condition the moment it's created, and reading schema.value before the
// real /filters fetch has settled would let the server capture the mock fallback's label
// while client hydration (which restores the already-resolved real data from the SSR
// payload) captures the real one instead, producing a hydration mismatch.
const { data: schema } = await useFilterSchema()
const { open: openLogin } = useLoginDialog()
const {
  displayedTabs,
  activeTabId,
  activeTab,
  columnPresetOptions,
  pickerVisible,
  addTab,
  removeTab,
  renameTab,
  removeSlot,
  openAddConditionPicker,
  openColumnPicker,
  handleSelect,
  handleColumnTabChange,
  addColumnPresetOption,
  renameColumnPreset,
  removeColumnPresetOption,
  handleReorderColumns,
  handleRemoveColumn,
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
  removeTab(Number(id))
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
  renameColumnPreset(Number(id), name)
}

function handleRemoveColumnPreset(id: string) {
  if (activeTab.value) removeColumnPresetOption(activeTab.value, id)
}
</script>

<template>
  <div class="screener-page">
    <h1 class="screener-page__title">選股篩選</h1>

    <SharedPresetFolder
      :items="presetItems"
      v-model:active-id="activeTabId"
      @add="addTab"
      @rename="handleRenamePreset"
      @remove="handleRemovePreset"
    >
      <ScreenerOrganismFilters
        v-if="activeTab"
        :tab="activeTab"
        @add-condition="openAddConditionPicker(activeTab!)"
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
    >
      <ScreenerOrganismResultBody
        :tab="activeTab"
        @reorder-columns="fields => handleReorderColumns(activeTab!, fields)"
        @remove-column="field => handleRemoveColumn(activeTab!, field)"
        @add-column-click="openColumnPicker(activeTab!)"
        @row-click="symbol => router.push(`/stock/${symbol}`)"
      />
    </SharedPresetFolder>

    <ScreenerOrganismResultBody
      v-else-if="activeTab"
      :tab="activeTab"
      @reorder-columns="fields => handleReorderColumns(activeTab!, fields)"
      @remove-column="field => handleRemoveColumn(activeTab!, field)"
      @add-column-click="openLogin()"
      @row-click="symbol => router.push(`/stock/${symbol}`)"
    />

    <ScreenerOrganismIndicatorPicker
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      @select="handleSelect"
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
  margin: 0;
}

.screener-page__result-heading {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
</style>
