import type { EtfFilterState } from '~/composables/etf/useEtfScreener'

export interface EtfFilterPreset {
  id: string
  name: string
  filters: EtfFilterState[]
}

// Local-only for now (useState, not backend-synced) — same "build local, verify the UX, then
// ask for persistence" sequence already used for 特別股專區's own custom column presets
// (usePreferredStocksColumnPresets.ts), since bff-ts's own description of the 3 new ETF
// endpoints named no /etf-screener/presets resource (unlike the stock screener's real
// /screener/presets). Mirrors that composable's own CRUD shape (add/rename/remove/setFilters)
// rather than inventing a new one, so the eventual backend-sync pass can follow the same
// contract shape stock/preferred-stock presets already use.
function makeId(): string {
  return `etf-filter-preset-${Math.random().toString(36).slice(2, 10)}`
}

function seedDefaultPresets(): EtfFilterPreset[] {
  return [{ id: makeId(), name: '全部 ETF', filters: [] }]
}

export function useEtfFilterPresets() {
  const presets = useState<EtfFilterPreset[]>('etf-filter-presets', seedDefaultPresets)
  const activePresetId = useState<string>('etf-active-filter-preset', () => presets.value[0]!.id)

  const activePreset = computed(() => presets.value.find(preset => preset.id === activePresetId.value) ?? presets.value[0]!)

  function addPreset(name: string) {
    const preset: EtfFilterPreset = { id: makeId(), name, filters: [] }
    presets.value.push(preset)
    activePresetId.value = preset.id
  }

  function renamePreset(id: string, name: string) {
    const preset = presets.value.find(item => item.id === id)
    if (preset) preset.name = name
  }

  function removePreset(id: string) {
    presets.value = presets.value.filter(preset => preset.id !== id)
    if (!presets.value.length) presets.value = seedDefaultPresets()
    if (activePresetId.value === id) activePresetId.value = presets.value[0]!.id
  }

  function reorderPresets(ids: string[]) {
    const byId = new Map(presets.value.map(preset => [preset.id, preset]))
    presets.value = ids.map(id => byId.get(id)!).filter(Boolean)
  }

  function setFilters(id: string, filters: EtfFilterState[]) {
    const preset = presets.value.find(item => item.id === id)
    if (preset) preset.filters = filters
  }

  return { presets, activePresetId, activePreset, addPreset, renamePreset, removePreset, reorderPresets, setFilters }
}
