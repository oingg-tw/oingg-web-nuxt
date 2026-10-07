// 'redemption-terms'/'ytc'/'redemption-date' removed entirely 2026-09-14 — see index.vue's own
// top-of-file comment: mops-ts dropped the preferredStock domain's redemption tables, so those
// fields come back null from analysis-ts going forward with no official replacement in sight.
export type ColumnId = 'dividend-type' | 'participation' | 'liquidation' | 'issue-price' | 'issue-date' | 'price' | 'dividend-rate' | 'current-yield' | 'ytw' | 'premium-rate'

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
// fixed (15 known columns, not a large evolving metric schema), so the 3 starting points below
// are just plain client-side constants used to seed the very first presets and to offer as
// "從範本建立" starting points in the new-preset dialog, not a real template resource.
//
// Reorganized 2026-09-08 around the three questions an investor actually asks, per direct
// request, instead of the old overlapping split (issue-price/issue-date/redemption-terms used
// to appear in BOTH 契約條款 and 贖回資訊; 估值指標 also duplicated 贖回資訊's own
// redemption-date/redemption-risk/premium-rate/convexity-warning). Each of these 3 templates is
// a clean, non-overlapping partition of the known columns:
// - 估值與報酬 ("what should I pay / what do I get"): every price and yield figure — listed
//   first, per direct request, ahead of rights/redemption-risk.
// - 股東權利 ("what rights does this give me"): the ownership/participation terms themselves.
// - 贖回資訊 ("when/how can the company take it back"): issue-date moved here from 股東權利 —
//   its only real use is anchoring the redemption-window math, not a standalone right.
// The old 4th "全部欄位" (all 15 columns at once) template was removed per direct request — a
// preset that already shows every column isn't a useful comparison view. ColumnId and the
// underlying table markup are untouched — a user can still build an all-columns preset
// themselves via "空白" + adding every column by hand.
//
// 'redemption-risk' (現價－發行價) removed entirely 2026-09-08 per direct request — it doubly
// gated on the same unverified-redemptionDate "待查證" state as 贖回日期/贖回條款 already show,
// so it never said anything those two didn't already cover on their own.
//
// 'convexity-warning' also removed the same day, per direct request ("info icon 改放到 溢價率
// 那邊") — it was always a strict function of 溢價率 (>2% premium), never an independent fact,
// so the warning icon/tooltip now lives directly on the 溢價率 cell itself instead of being a
// separate column that just repeated the same number with an icon next to it.
export const COLUMN_PRESET_TEMPLATES: { key: string; name: string; columns: ColumnId[] }[] = [
  {
    key: 'valuation',
    name: '估值與報酬',
    columns: ['issue-price', 'price', 'dividend-rate', 'current-yield', 'ytw']
  },
  {
    key: 'rights',
    name: '股東權利',
    columns: ['dividend-type', 'participation', 'liquidation']
  },
  {
    key: 'call-risk',
    name: '贖回資訊',
    columns: ['issue-date', 'premium-rate']
  }
]

function seedDefaultPresets(): ColumnPreset[] {
  return COLUMN_PRESET_TEMPLATES.map(template => ({ id: makePresetId(), name: template.name, columns: [...template.columns] }))
}

// 只存本機（useState，沒有同步到 bff-ts）：舊的 /users/me/preferred-stocks-preferences 是平的 {columnPresetId, columnOrder}，
// 裝不下使用者自建的具名欄位組清單，所以那條同步連同兩支 composable 一起拿掉而不是修補。後端持久化等本機版驗證可用再向 bff-ts 提。
// CRUD 本體在 useLocalPresets（2026-10-02 抽出去——那三個資料夾的 add／rename／remove／reorder
// 已經一字不差）。這裡只留這個資料夾獨有的：種子來自 COLUMN_PRESET_TEMPLATES，而且新預設是從
// 呼叫端給的欄位開始（不像 ETF 那兩個有固定的起始欄位），所以 addPreset 多一個參數並回傳預設。
export function usePreferredStocksColumnPresets() {
  const folder = useLocalPresets<ColumnPreset>('preferred-stocks-column-presets', 'preferred-stocks-active-column-preset', seedDefaultPresets)

  return {
    ...folder,
    addPreset: (name: string, columns: ColumnId[]): ColumnPreset => folder.addPreset({ id: makePresetId(), name, columns: [...columns] }),
    setPresetColumns: (id: string, columns: ColumnId[]) => folder.patchPreset(id, { columns: [...columns] })
  }
}
