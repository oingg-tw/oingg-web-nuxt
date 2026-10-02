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

function seedDefaultPresets(): EtfColumnPreset[] {
  return [
    { id: makePresetId(), name: '基本欄位', columns: [...DEFAULT_COLUMNS] },
    { id: makePresetId(), name: '費用歷史', columns: [...EXPENSE_RATIO_HISTORY_COLUMNS] }
  ]
}

// CRUD 本體在 useLocalPresets（2026-10-02 抽出去）——這裡只留這個資料夾真正獨有的東西：
// 兩個種子預設，以及「新預設一律從 DEFAULT_COLUMNS 開始」這個決定。
export function useEtfColumnPresets() {
  const folder = useLocalPresets<EtfColumnPreset>('etf-column-presets', 'etf-active-column-preset', seedDefaultPresets)

  return {
    ...folder,
    addPreset: (name: string) => folder.addPreset({ id: makePresetId(), name, columns: [...DEFAULT_COLUMNS] }),
    setColumns: (id: string, columns: string[]) => folder.patchPreset(id, { columns })
  }
}
