<script setup lang="ts">
// 2026-09-07 打掉重做（「ETF 專區 也幫我打掉 重新設計成 兩個 presetFolder 一上一下 的樣式」）：整頁只剩 ETF 篩選器，結構同
// 個股篩選——上面的 PresetFolder 切換篩選條件組、下面的切換欄位組，兩者驅動同一張結果表。原本的四個主題（費用率／資產規模／
// 槓桿反向型／ETF 排行）整個拿掉、沒有併入（使用者明確選「整頁只剩 ETF 篩選」）。
// 兩個資料夾都只存本機（useEtfFilterPresets／useEtfColumnPresets，useState）：bff-ts 的三個 ETF 端點（POST /etf-screener、
// GET /etf-screener/filters、GET /market/etf-ranking）沒有 presets 資源。先本機、驗證 UX、再要求後端持久化——同特別股專區的順序。
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

const filterPresets = useEtfFilterPresets()
const columnPresets = useEtfColumnPresets()
const screener = useEtfScreener()

const filterPresetItems = computed<PresetFolderItem[]>(() => filterPresets.presets.value.map(preset => ({ id: preset.id, name: preset.name })))
const columnPresetItems = computed<PresetFolderItem[]>(() => columnPresets.presets.value.map(preset => ({ id: preset.id, name: preset.name })))

// Two-way bridge between each folder's own active preset and the one shared `useEtfScreener()`
// instance: switching either folder's tab re-runs the search against the newly active
// combination, and editing filters/columns in place (EtfFilterEditor.vue's v-model, the column
// picker's v-model) writes straight back into the currently active preset so it's not lost
// when the user tabs away and back.
watch(
  () => filterPresets.activePreset.value,
  (preset, previous) => {
    screener.filters.value = preset.filters
    if (previous) screener.search()
  },
  { immediate: true }
)
watch(
  () => columnPresets.activePreset.value,
  (preset, previous) => {
    screener.columns.value = preset.columns
    if (previous) screener.search()
  },
  { immediate: true }
)
watch(
  screener.filters,
  filters => filterPresets.setFilters(filterPresets.activePresetId.value, filters),
  { deep: true }
)
watch(
  screener.columns,
  columns => columnPresets.setColumns(columnPresets.activePresetId.value, columns),
  { deep: true }
)

onMounted(() => {
  screener.search()
})

let filterPresetCounter = filterPresets.presets.value.length
function addFilterPreset() {
  filterPresetCounter += 1
  filterPresets.addPreset(`篩選 ${filterPresetCounter}`)
}

let columnPresetCounter = columnPresets.presets.value.length
function addColumnPreset() {
  columnPresetCounter += 1
  columnPresets.addPreset(`欄位組合 ${columnPresetCounter}`)
}
</script>

<template>
  <div class="etf-zone-page">
    <h1 class="etf-zone-page__title">ETF 專區</h1>
    <p class="etf-zone-page__subtitle">依規模、市場別、資產類型等條件篩選上市櫃 ETF，可另存多組篩選條件與顯示欄位組合，方便來回比較</p>

    <SharedPresetFolder
      label="篩選分頁"
      add-label="新增篩選分頁"
      :items="filterPresetItems"
      v-model:active-id="filterPresets.activePresetId.value"
      @add="addFilterPreset"
      @rename="filterPresets.renamePreset"
      @remove="filterPresets.removePreset"
      @reorder="filterPresets.reorderPresets"
    >
      <EtfFilterEditor v-model:filters="screener.filters.value" @search="screener.search" />
    </SharedPresetFolder>

    <SharedPresetFolder
      fill-height
      label="欄位組合"
      add-label="新增欄位組合"
      :items="columnPresetItems"
      v-model:active-id="columnPresets.activePresetId.value"
      @add="addColumnPreset"
      @rename="columnPresets.renamePreset"
      @remove="columnPresets.removePreset"
      @reorder="columnPresets.reorderPresets"
    >
      <EtfResultTable v-model:columns="screener.columns.value" :screener="screener" />
    </SharedPresetFolder>
  </div>
</template>

<style scoped>
/* Bounded to the viewport rather than normal document flow, so the bottom PresetFolder
   (fill-height, above) can be the one flex child that takes up whatever's left and scrolls
   internally instead of the whole page growing taller than the viewport.
   Mobile does NOT reserve AppFeatureMenu's own 88px floating-button footprint the way
   screener.vue/preferred-stocks/index.vue's own copies of this formula still do — per direct
   request ("手機版故意保留 88px 給 AppFeatureMenu 的浮動主頁，不用...讓它蓋在上面"), the table
   extends all the way down and the floating button (position: fixed, its own stacking context)
   simply overlays on top of it instead of content stopping short to leave it a clear lane. */
.etf-zone-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - env(safe-area-inset-bottom));
}

@media (min-width: 1280px) {
  .etf-zone-page {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 20px);
  }
}

.etf-zone-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.etf-zone-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0;
}
</style>
