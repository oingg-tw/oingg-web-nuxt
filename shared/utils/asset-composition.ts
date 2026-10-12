// 資產組成的金額（2026-10-12，使用者：「流動資產與非流動資產 是不是用存量表示而不用百分比較好」→ 圖用億元、答句與表格附占比）。
//
// 每一項由哪些資產負債表科目加總，是對著 analysis-ts 那 12 支占比（currentFinancialAssetsToAssets 等）反推的：
// 2026-10-12 量 10 檔（2330 1101 2603 2317 1216 2412 9910 2002 3008 2207）× 最近 4 季 = 440 格，用這裡的分組算出的占比
// 跟上游的值差都在 0.006 個百分點以內（上游存兩位小數），0 格對不上。所以金額跟頁面上的占比是同一個口徑。
// 「其他」兩項跟上游一樣是殘差（合計減列出的各項），不是單一科目。
//
// shared/utils 不 import 任何東西：報表傳進來是上游原樣的 Record（值是千元字串）。

const CURRENT_KEYS = {
  cash: ['cash_and_cash_equivalents'],
  financial: ['current_financial_assets_at_amortised_cost', 'current_financial_assets_at_fvoci', 'current_financial_assets_at_fair_value_through_profit_or_loss', 'other_current_financial_assets'],
  receivables: ['notes_receivable_net', 'notes_receivable_due_from_related_parties_net', 'accounts_receivable_net', 'accounts_receivable_duefrom_related_parties_net'],
  inventories: ['inventories']
} as const

const NONCURRENT_KEYS = {
  financial: ['noncurrent_financial_assets_at_amortised_cost', 'noncurrent_financial_assets_at_fvoci', 'noncurrent_financial_assets_at_fvtpl'],
  equityMethod: ['investment_accounted_for_using_equity_method'],
  propertyPlantEquipment: ['property_plant_and_equipment'],
  rightOfUse: ['rightofuse_assets'],
  intangible: ['intangible_assets_and_goodwill']
} as const

export type CurrentAssetPart = keyof typeof CURRENT_KEYS | 'other'
export type NonCurrentAssetPart = keyof typeof NONCURRENT_KEYS | 'other'

// 顯示名稱沿用型錄那 12 支的名字去掉「占總資產比」，順序就是型錄列出的順序
export const CURRENT_ASSET_PART_LABELS: Record<CurrentAssetPart, string> = {
  cash: '現金及約當現金',
  financial: '流動金融資產',
  receivables: '應收票據及帳款',
  inventories: '存貨',
  other: '其他流動資產'
}
export const NONCURRENT_ASSET_PART_LABELS: Record<NonCurrentAssetPart, string> = {
  financial: '非流動金融資產',
  equityMethod: '採權益法投資',
  propertyPlantEquipment: '不動產廠房及設備',
  rightOfUse: '使用權資產',
  intangible: '無形資產',
  other: '其他非流動資產'
}

export interface AssetComposition {
  // 全部新台幣千元，跟上游一致；換算億元是顯示層的事
  totalAssets: number
  currentAssets: number
  noncurrentAssets: number
  current: Record<CurrentAssetPart, number>
  noncurrent: Record<NonCurrentAssetPart, number>
}

const num = (value: string | null | undefined): number => {
  const parsed = Number(value)
  return value == null || !Number.isFinite(parsed) ? 0 : parsed
}

// 拆不開就回 null：沒有總資產、沒有流動／非流動合計（銀行、保險、證券、金控不分流動與非流動），流動＋非流動≠總資產，或殘差是負的
// （列出的科目加起來超過合計，代表科目歸類有誤，畫出來會是一根騙人的柱子）。容差 1 千元：上游每個科目本來就是整數千元。
export function assetCompositionOf(statement: Record<string, string | null> | null | undefined): AssetComposition | null {
  if (!statement) return null
  const totalAssets = num(statement.assets)
  const currentAssets = num(statement.current_assets)
  const noncurrentAssets = num(statement.noncurrent_assets)
  if (totalAssets <= 0 || currentAssets <= 0 || noncurrentAssets <= 0) return null
  if (Math.abs(currentAssets + noncurrentAssets - totalAssets) > 1) return null

  const sumOf = (keys: readonly string[]) => keys.reduce((total, key) => total + num(statement[key]), 0)
  const currentListed = Object.fromEntries(Object.entries(CURRENT_KEYS).map(([part, keys]) => [part, sumOf(keys)])) as Record<keyof typeof CURRENT_KEYS, number>
  const noncurrentListed = Object.fromEntries(Object.entries(NONCURRENT_KEYS).map(([part, keys]) => [part, sumOf(keys)])) as Record<keyof typeof NONCURRENT_KEYS, number>
  const currentOther = currentAssets - Object.values(currentListed).reduce((a, b) => a + b, 0)
  const noncurrentOther = noncurrentAssets - Object.values(noncurrentListed).reduce((a, b) => a + b, 0)
  if (currentOther < -1 || noncurrentOther < -1) return null

  return {
    totalAssets,
    currentAssets,
    noncurrentAssets,
    current: { ...currentListed, other: Math.max(currentOther, 0) },
    noncurrent: { ...noncurrentListed, other: Math.max(noncurrentOther, 0) }
  }
}
