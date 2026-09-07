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

// One tab per `assetClass` value (per direct request), ahead of "全部 ETF" — hardcoded to the
// live GET /etf-screener/filters values fetched 2026-09-08 rather than generated from
// useEtfFilterSchema() at seed time, since that fetch is async and this seed runs synchronously
// when the useState is first created. Same tradeoff every other seeded preset name in this app
// already accepts (e.g. "全部 ETF" itself, or 特別股專區's own default column preset) — if
// bff-ts ever adds/renames an assetClass value, these seeded tabs won't pick it up
// automatically, but a user can always add/rename/remove tabs themselves since presets are
// fully editable, not read-only.
const ASSET_CLASSES = ['債券成分', '反向型', '國內成分證券', '國外成分證券', '多資產', '槓桿型', '連結式']

function seedDefaultPresets(): EtfFilterPreset[] {
  return [
    { id: makeId(), name: '全部 ETF', filters: [] },
    ...ASSET_CLASSES.map(assetClass => ({
      id: makeId(),
      name: assetClass,
      filters: [{ field: 'assetClass', kind: 'categorical' as const, values: [assetClass] }]
    })),
    // `assetClass` only captures holdings type (成分/槓桿/反向...), not whether the fund is
    // actively managed vs. tracking an index — that's the separate `isActive` categorical field
    // (schema values are the STRINGS "true"/"false", not real booleans — confirmed live via GET
    // /etf-screener/filters 2026-09-08). Added per direct follow-up after this exact gap was
    // pointed out.
    { id: makeId(), name: '被動指數型', filters: [{ field: 'isActive', kind: 'categorical' as const, values: ['false'] }] },
    { id: makeId(), name: '主動式', filters: [{ field: 'isActive', kind: 'categorical' as const, values: ['true'] }] }
  ]
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
