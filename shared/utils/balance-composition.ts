// 資產負債表三種組成的金額：資產（流動／非流動）、負債、淨值（2026-10-12，使用者：「流動資產與非流動資產 是不是用存量表示而不用百分比
// 較好」「debt-composition 也改用數字而非比例」；淨值組成同日併進來，原本在 server/api/stock/[code]/equity-composition.get.ts）。
//
// 以下是資產那一段的紀錄：
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

// ---- 負債九項（2026-10-12）----
// 對著 analysis-ts 那 9 支負債占比（shortTermBorrowingsToAssets 等）反推：12 檔（2330 1101 2603 2317 1216 2412 9910 2002 3008 2207
// 2912 1301）× 最近 4 季 = 428 格全部在 0.006 個百分點內。短期借款要含商業本票（current_cp_issued_and_current_portion_cp_issued，1101
// 少了它差 0.15 個百分點）；租賃負債只算 noncurrent_lease_liabilities（再加 finance lease 那一科會對不上 2330）；兩個「其他」是殘差。
const DEBT_CURRENT_KEYS = {
  shortTermBorrowings: ['shortterm_borrowings', 'current_cp_issued_and_current_portion_cp_issued'],
  accountsPayable: ['notes_payable', 'trade_and_other_current_payables_to_trade_suppliers', 'trade_and_other_current_payables_to_related_parties'],
  contractLiabilities: ['current_contract_liabilities'],
  currentPortionOfLongTermDebt: ['longterm_liabilities_current_portion']
} as const
const DEBT_NONCURRENT_KEYS = {
  longTermBorrowings: ['longterm_borrowings'],
  bonds: ['noncurrent_portion_of_noncurrent_bonds_issued'],
  lease: ['noncurrent_lease_liabilities']
} as const

export type DebtPart = keyof typeof DEBT_CURRENT_KEYS | keyof typeof DEBT_NONCURRENT_KEYS | 'otherCurrent' | 'otherNoncurrent'
export const DEBT_PART_LABELS: Record<DebtPart, string> = {
  shortTermBorrowings: '短期借款',
  accountsPayable: '應付票據及帳款',
  contractLiabilities: '合約負債',
  currentPortionOfLongTermDebt: '一年內到期長期負債',
  otherCurrent: '其他流動負債',
  longTermBorrowings: '長期借款',
  bonds: '應付公司債',
  lease: '租賃負債',
  otherNoncurrent: '其他非流動負債'
}

export interface DebtComposition {
  liabilities: number
  parts: Record<DebtPart, number>
}

// 拆不開回 null：金融業不分流動與非流動、流動＋非流動≠負債總計、殘差為負（歸類錯）。容差 1 千元。
export function debtCompositionOf(statement: Record<string, string | null> | null | undefined): DebtComposition | null {
  if (!statement) return null
  const liabilities = num(statement.liabilities)
  const current = num(statement.current_liabilities)
  const noncurrent = num(statement.noncurrent_liabilities)
  if (liabilities <= 0 || (current <= 0 && noncurrent <= 0)) return null
  if (Math.abs(current + noncurrent - liabilities) > 1) return null
  const sumOf = (keys: readonly string[]) => keys.reduce((total, key) => total + num(statement[key]), 0)
  const currentListed = Object.fromEntries(Object.entries(DEBT_CURRENT_KEYS).map(([part, keys]) => [part, sumOf(keys)])) as Record<keyof typeof DEBT_CURRENT_KEYS, number>
  const noncurrentListed = Object.fromEntries(Object.entries(DEBT_NONCURRENT_KEYS).map(([part, keys]) => [part, sumOf(keys)])) as Record<keyof typeof DEBT_NONCURRENT_KEYS, number>
  const otherCurrent = current - Object.values(currentListed).reduce((a, b) => a + b, 0)
  const otherNoncurrent = noncurrent - Object.values(noncurrentListed).reduce((a, b) => a + b, 0)
  if (otherCurrent < -1 || otherNoncurrent < -1) return null
  return { liabilities, parts: { ...currentListed, ...noncurrentListed, otherCurrent: Math.max(otherCurrent, 0), otherNoncurrent: Math.max(otherNoncurrent, 0) } }
}

// ---- 淨值（歸屬母公司權益）五項（2026-09-27 起，原本在 equity-composition.get.ts）----
// 恆等式：股本 + 資本公積 + 保留盈餘 + 其他權益 − 庫藏股 = 歸屬母公司權益（抽 5 檔 × 22 期，110 期裡 108 期精確到元、零筆對不上）。
// 欄位名跟直覺不一樣，抄的時候別改：資本公積總額是 capital_reserve（capital_surplus_* 是它的明細），股本是 issued_capital；
// other_equity_interest 是換算差額與 FVOCI 評價，可以是負的。沒有非控制權益的公司，上游的 equity_attributable_to_owners_of_parent
// 是 null、只填 equity（5904 115Q2），退回 equity 是安全的：真有非控制權益卻退回總權益的話，殘差就不會是 0，整期會被丟掉。
export type EquityPart = 'retainedEarnings' | 'capitalReserve' | 'issuedCapital' | 'otherEquity' | 'treasuryShares'
export const EQUITY_PART_LABELS: Record<EquityPart, string> = {
  retainedEarnings: '保留盈餘',
  capitalReserve: '資本公積',
  issuedCapital: '股本',
  otherEquity: '其他權益',
  treasuryShares: '庫藏股'
}

export interface EquityComposition {
  equity: number
  // 庫藏股存負值（它在恆等式裡是減項，堆疊圖疊到零軸下面）
  parts: Record<EquityPart, number>
}

export function equityCompositionOf(statement: Record<string, string | null> | null | undefined): EquityComposition | null {
  if (!statement) return null
  const equity = num(statement.equity_attributable_to_owners_of_parent) || num(statement.equity)
  if (!equity) return null
  const parts: Record<EquityPart, number> = {
    retainedEarnings: num(statement.retained_earnings),
    capitalReserve: num(statement.capital_reserve),
    issuedCapital: num(statement.issued_capital),
    otherEquity: num(statement.other_equity_interest),
    treasuryShares: -num(statement.treasury_shares)
  }
  // 容差 1 千元（均勻抽樣 205 家零筆超出，擋的是上游欄位缺漏或結構特殊的那幾家）
  if (Math.abs(Object.values(parts).reduce((a, b) => a + b, 0) - equity) > 1) return null
  return { equity, parts }
}
