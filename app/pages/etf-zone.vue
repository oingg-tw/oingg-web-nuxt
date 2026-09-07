<script setup lang="ts">
// Torn down and rebuilt 2026-09-07 per direct request ("ETF 專區 也幫我打掉 重新設計成 兩個
// presetFolder 一上一下 的樣式") — confirmed directly this means the whole page becomes just
// the ETF screener, laid out exactly like screener.vue's own real structure: a TOP
// SharedPresetFolder switching between saved FILTER-CONDITION presets, a BOTTOM
// SharedPresetFolder switching between saved COLUMN presets, both driving the one results
// table below the bottom folder. The previous 4-topic structure (費用率/資產規模/槓桿反向型/
// ETF排行 — 3 static risk-checklist topics + 1 real-ranking topic, see git history on this
// file for that version's own reasoning) is gone entirely, not merged in — the user explicitly
// chose "整頁只剩 ETF 篩選" over keeping the old topics alongside it. ETF 排行 (real ranking
// data, EtfRankingCard.vue) still exists as its own dashboard card, just no longer surfaced on
// this page — revisit only if asked to bring it back.
//
// Both preset folders are LOCAL-ONLY (useEtfFilterPresets.ts/useEtfColumnPresets.ts, useState-
// backed) — bff-ts's own description of the 3 new ETF endpoints (POST /etf-screener, GET
// /etf-screener/filters, GET /market/etf-ranking) named no /etf-screener/presets or
// /etf-screener/column-presets resource, unlike the stock screener's real backend-synced ones.
// Same "build local, verify the UX, then ask for persistence" sequence already used for
// 特別股專區's own custom column presets — request backend persistence as a follow-up once this
// is verified working, don't block the layout on it.
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
    <h1 class="etf-zone-page__title">ETF 篩選</h1>
    <p class="etf-zone-page__subtitle">依規模、市場別、資產類型等條件篩選上市櫃 ETF，可另存多組篩選條件與顯示欄位組合，方便來回比較</p>

    <SharedPresetFolder
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
.etf-zone-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.etf-zone-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.etf-zone-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0;
}
</style>
