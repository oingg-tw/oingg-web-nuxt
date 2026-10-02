export interface EtfColumnPreset {
  id: string
  name: string
  columns: string[]
}

// Bottom PresetFolder of etf-zone.vue's own two-folder layout (per direct request "ETF 專區
// 也幫我打掉 重新設計成 兩個 presetFolder 一上一下 的樣式", explicitly confirmed to mean
// screener.vue's real layout: top folder = filter/condition preset switcher, bottom folder =
// column preset switcher, both driving the one results table). Mirrors
// usePreferredStocksColumnPresets.ts's own CRUD shape (add/rename/remove/reorder/setColumns)
// rather than inventing a new one — same reasoning as useEtfFilterPresets.ts (top folder):
// local-only for now (useState), no backend /etf-screener/column-presets resource exists yet,
// build local + verify UX first, request persistence as a follow-up.
// expenseRatio added back 2026-09-08 now that it's confirmed good (see
// project_etf_screener_data_scale_bug.md / useEtfScreener.ts's ETF_UNRELIABLE_FIELDS comment) —
// unhiding it from the pickers alone didn't put it back on screen by default, since this array
// is a separate seed, not derived from ETF_UNRELIABLE_FIELDS.
const DEFAULT_COLUMNS = ['aum', 'return1y', 'expenseRatio', 'nav', 'market', 'assetClass']

// Per direct request ("column preset 要加上費用歷史") — sitca-ts/analysis-ts shipped 26 flat
// expenseRatioYYYY fields (2001–2026) on GET /etf-screener/filters the same day, confirmed live.
// Newest-to-oldest left-to-right per direct follow-up ("2026要在前面").
const EXPENSE_RATIO_HISTORY_COLUMNS = Array.from({ length: 26 }, (_, i) => `expenseRatio${2026 - i}`)

function makeId(): string {
  return `etf-column-preset-${Math.random().toString(36).slice(2, 10)}`
}

function seedDefaultPresets(): EtfColumnPreset[] {
  return [
    { id: makeId(), name: '基本欄位', columns: [...DEFAULT_COLUMNS] },
    { id: makeId(), name: '費用歷史', columns: [...EXPENSE_RATIO_HISTORY_COLUMNS] }
  ]
}

export function useEtfColumnPresets() {
  const presets = useState<EtfColumnPreset[]>('etf-column-presets', seedDefaultPresets)
  const activePresetId = useState<string>('etf-active-column-preset', () => presets.value[0]!.id)

  const activePreset = computed(() => presets.value.find(preset => preset.id === activePresetId.value) ?? presets.value[0]!)

  function addPreset(name: string) {
    const preset: EtfColumnPreset = { id: makeId(), name, columns: [...DEFAULT_COLUMNS] }
    presets.value.push(preset)
    activePresetId.value = preset.id
  }

  function renamePreset(id: string, name: string) {
    const preset = presets.value.find(item => item.id === id)
    if (preset) preset.name = name
  }

  function removePreset(id: string) {
    const index = presets.value.findIndex(preset => preset.id === id)
    if (index === -1) return
    const remaining = presets.value.filter(preset => preset.id !== id)
    presets.value = remaining.length ? remaining : seedDefaultPresets()
    // 刪掉作用中的那個時，跳到**原本位置**的鄰居而不是跳回第一個（2026-10-02 修，同樣是從
    // preferred 版抄漏的）。刪第五個卻跳到第一個，對讀者是毫無理由的位置跳動。
    if (activePresetId.value === id) {
      const fallbackIndex = Math.min(index, presets.value.length - 1)
      activePresetId.value = presets.value[fallbackIndex]!.id
    }
  }

  function reorderPresets(ids: string[]) {
    const byId = new Map(presets.value.map(preset => [preset.id, preset]))
    const reordered = ids.map(id => byId.get(id)).filter((preset): preset is EtfColumnPreset => preset !== undefined)
    // `ids` 沒涵蓋到的預設要留在最後，不能靜默丟掉（2026-10-02 修）。原本寫
    // `ids.map(id => byId.get(id)!).filter(Boolean)`——那個 `!` 騙過 TypeScript，`filter(Boolean)`
    // 再把 undefined 刪掉，所以**任何不在 ids 裡的預設就消失了**。
    // usePreferredStocksColumnPresets.ts 的同名函式一直是對的，而且註解點名了這個危害；
    // 這裡（以及 useEtfFilterPresets.ts）是從它抄過來時漏掉那一段的。
    const missing = presets.value.filter(preset => !ids.includes(preset.id))
    presets.value = [...reordered, ...missing]
  }

  function setColumns(id: string, columns: string[]) {
    const preset = presets.value.find(item => item.id === id)
    if (preset) preset.columns = columns
  }

  return { presets, activePresetId, activePreset, addPreset, renamePreset, removePreset, reorderPresets, setColumns }
}
