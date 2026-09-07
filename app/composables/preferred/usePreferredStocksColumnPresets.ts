export type ColumnId =
  | 'dividend-type'
  | 'participation'
  | 'liquidation'
  | 'issue-price'
  | 'issue-date'
  | 'redemption-terms'
  | 'price'
  | 'dividend-rate'
  | 'current-yield'
  | 'ytw'
  | 'ytc'
  | 'redemption-date'
  | 'redemption-risk'
  | 'premium-rate'
  | 'convexity-warning'

export const ALL_COLUMNS: ColumnId[] = [
  'dividend-type',
  'participation',
  'liquidation',
  'issue-price',
  'issue-date',
  'redemption-terms',
  'price',
  'dividend-rate',
  'current-yield',
  'ytw',
  'ytc',
  'redemption-date',
  'redemption-risk',
  'premium-rate',
  'convexity-warning'
]

export interface ColumnPreset {
  id: string
  name: string
  columns: ColumnId[]
}

// Per direct request ("特別股 比較結果 欄位 要可以自定義preset跟screener一樣") — mirrors
// screener.vue's own column-preset architecture (useScreenerColumnPresets.ts/
// useScreenerTabs.ts): presets are user-owned resources (rename/delete/reorder-tabs/edit-
// columns), not a fixed developer-defined set. Unlike screener, there's no separate backend-
// driven "official template" catalog here — preferred-stocks' column catalog is small and
// fixed (15 known columns, not a large evolving metric schema), so the 4 starting points below
// are just plain client-side constants used to seed the very first presets and to offer as
// "從範本建立" starting points in the new-preset dialog, not a real template resource.
export const COLUMN_PRESET_TEMPLATES: { key: string; name: string; columns: ColumnId[] }[] = [
  { key: 'all', name: '全部欄位', columns: [...ALL_COLUMNS] },
  {
    key: 'contract-terms',
    name: '契約條款',
    columns: ['dividend-type', 'participation', 'liquidation', 'issue-price', 'issue-date', 'redemption-terms']
  },
  {
    key: 'valuation',
    name: '估值指標',
    columns: ['price', 'dividend-rate', 'current-yield', 'ytw', 'ytc', 'redemption-date', 'redemption-risk', 'premium-rate', 'convexity-warning']
  },
  {
    key: 'call-risk',
    name: '贖回風險',
    columns: ['issue-price', 'issue-date', 'redemption-terms', 'price', 'redemption-date', 'redemption-risk', 'premium-rate', 'convexity-warning']
  }
]

function makePresetId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function seedDefaultPresets(): ColumnPreset[] {
  return COLUMN_PRESET_TEMPLATES.map(template => ({ id: makePresetId(), name: template.name, columns: [...template.columns] }))
}

// Local-only for now (useState, not synced to bff-ts) — the previous flat
// {columnPresetId, columnOrder} contract (/users/me/preferred-stocks-preferences,
// usePreferredStocksColumnPreferences.ts/usePreferredStocksPreferencesSync.ts, both deleted
// alongside this file's introduction) can't represent an arbitrary user-created named-preset
// list at all, so that sync had to come out rather than be patched. Backend persistence for
// this new shape is a follow-up ask to bff-ts once this local-only version is verified working
// — same "build local, verify, then request persistence" sequence useDashboardCards.ts/
// useStockCards.ts followed originally.
export function usePreferredStocksColumnPresets() {
  const presets = useState<ColumnPreset[]>('preferred-stocks-column-presets', seedDefaultPresets)
  const activePresetId = useState<string>('preferred-stocks-active-column-preset', () => presets.value[0]!.id)

  const activePreset = computed(() => presets.value.find(preset => preset.id === activePresetId.value) ?? presets.value[0]!)

  function addPreset(name: string, columns: ColumnId[]): ColumnPreset {
    const preset: ColumnPreset = { id: makePresetId(), name, columns: [...columns] }
    presets.value = [...presets.value, preset]
    activePresetId.value = preset.id
    return preset
  }

  function renamePreset(id: string, name: string) {
    presets.value = presets.value.map(preset => (preset.id === id ? { ...preset, name } : preset))
  }

  // Always keeps at least one preset — removing the last one re-seeds the 4 defaults rather
  // than leaving the folder with nothing to show (there's no "empty state" designed for a
  // zero-preset folder, and PresetFolder.vue itself assumes at least one item exists).
  function removePreset(id: string) {
    const index = presets.value.findIndex(preset => preset.id === id)
    if (index === -1) return
    const remaining = presets.value.filter(preset => preset.id !== id)
    presets.value = remaining.length ? remaining : seedDefaultPresets()
    if (activePresetId.value === id) {
      const fallbackIndex = Math.min(index, presets.value.length - 1)
      activePresetId.value = presets.value[fallbackIndex]!.id
    }
  }

  function reorderPresets(ids: string[]) {
    const byId = new Map(presets.value.map(preset => [preset.id, preset]))
    const reordered = ids.map(id => byId.get(id)).filter((preset): preset is ColumnPreset => preset !== undefined)
    // Defensive: if `ids` somehow didn't cover every preset (shouldn't happen — PresetFolder's
    // own reorder emits the full id list of its current items), keep whatever's missing at the
    // end rather than silently dropping it.
    const missing = presets.value.filter(preset => !ids.includes(preset.id))
    presets.value = [...reordered, ...missing]
  }

  function setPresetColumns(id: string, columns: ColumnId[]) {
    presets.value = presets.value.map(preset => (preset.id === id ? { ...preset, columns: [...columns] } : preset))
  }

  return { presets, activePresetId, activePreset, addPreset, renamePreset, removePreset, reorderPresets, setPresetColumns }
}
