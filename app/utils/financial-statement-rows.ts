import type { StatementType } from '#shared/types/financial-statement'
// 三大財報的列（資產負債表／損益表／現金流量表），伺服器輸出的三張報表頁（StockFinancialStatementTable）與會計模式的期別卡片
//（StockFinancialStatementsCard）共用，兩邊不會各走各的。
//
// 2026-10-19 改成依 mops-ts 從 taxonomy 推導的欄位中繼資料組表（financial-statement-columns.ts，scripts/gen-statement-columns.mjs 產生）。
// 原本是手挑的固定 69 列：各段明細加起來不等於合計、讀者看不出差額在哪，而沒挑到的科目永遠看不到。使用者兩個擔心——「用戶看不懂」
// 與「少收科目會嚴重影響判讀」——用同一套規則一起處理（mops 逐家核對過：前端用到的欄位沒有一家因為換一種標籤申報而空白）：
//   - 排法照 MOPS 報表：同一個合計底下的科目依 GL 代碼排，明細在前、合計在後
//   - 這家公司兩期都沒有數字（null 或 0）的科目不列
//   - 預設精簡（使用者選的門檻）：資產負債表佔總資產、損益表佔營收 ≥2%，現金流量表佔營業／投資／籌資淨流量最大者 ≥5%。
//     最上層的合計（資產總計、本期淨利、每股盈餘…）與各段合計（流動資產合計、營業活動之淨現金流入…）一律列；門檻依這家公司的
//     金額算，所以大的科目不會被漏掉
//   - 一個合計底下沒列出來的，併成一行「其他」＝合計 − Σ(加減方向 × 已列的子科目)，每一段都加得起來。展開全部科目時，
//     「其他」只剩沒收錄的子科目（mops 的合計直接取自申報，不是加總）
// 一個科目的子科目有列出來，它自己一定列（不然那幾行會掛在別人底下）。合計底下只有一個子科目、兩期金額都一樣時，那個子科目不重複列。

export interface StatementColumn {
  key: string
  statement: StatementType
  label: string
  // 照 MOPS 報表順序排（ci 優先；各產業別各自一套，只在同一個父欄位底下比）
  gl: string
  // 最近一個也有收的加總父欄位；最上層是 null
  parent: string | null
  // 在父欄位底下是加（1）還是減（-1），例如營業成本在營業毛利底下是 -1
  weight: number
  total: boolean
  unit: '千元' | '元' | '%' | '股'
}

export interface StatementLine {
  key: string
  label: string
  // 底下有列出子科目的合計（粗體、不縮排）
  total: boolean
  // 「其他」那一行（算出來的，不是申報的欄位）
  other: boolean
  unit: StatementColumn['unit']
  current: string | null
  prior: string | null
}

export const STATEMENT_DEFINITIONS: { key: StatementType; label: string }[] = [
  { key: 'balanceSheet', label: '資產負債表' },
  { key: 'incomeStatement', label: '損益表' },
  { key: 'cashFlowStatement', label: '現金流量表' }
]

// 預設精簡的門檻（使用者 2026-10-19 選「資產負債、損益 ≥2%，現金流量 ≥5%」）：明細的金額（兩期取大）佔這張表的基準多少才單獨列
const CONCISE_RULES: Record<StatementType, { share: number; base: string[] }> = {
  balanceSheet: { share: 0.02, base: ['assets'] },
  incomeStatement: { share: 0.02, base: ['revenue'] },
  cashFlowStatement: { share: 0.05, base: ['cash_flows_from_used_in_operating_activities', 'net_cash_flows_from_used_in_investing_activities', 'cash_flows_from_used_in_financing_activities'] }
}

type Values = Record<string, string | null> | null | undefined

// columns：STATEMENT_COLUMNS（參數而不是直接 import，檢查腳本可以餵小的測資）。回傳要畫的列，以及精簡模式藏了幾個有數字的科目。
export function buildStatementLines(columns: StatementColumn[], statementType: StatementType, current: Values, prior: Values, showAll: boolean): { lines: StatementLine[]; hidden: number } {
  const num = (values: Values, key: string) => {
    const raw = values?.[key]
    return raw === null || raw === undefined || raw === '' ? null : Number(raw)
  }
  const hasValue = (column: StatementColumn) => [num(current, column.key), num(prior, column.key)].some(value => value !== null && value !== 0)
  const all = columns.filter(column => column.statement === statementType)
  const byKey = new Map(all.map(column => [column.key, column]))
  const withValue = all.filter(hasValue)
  const withValueKeys = new Set(withValue.map(column => column.key))

  // 父欄位沒有數字的話，往上找最近一個有數字的祖先，加減方向沿路相乘
  const anchorOf = (column: StatementColumn): { parent: StatementColumn | null; weight: number } => {
    let weight = column.weight
    let parent = column.parent ? byKey.get(column.parent) ?? null : null
    while (parent && !withValueKeys.has(parent.key)) {
      weight *= parent.weight
      parent = parent.parent ? byKey.get(parent.parent) ?? null : null
    }
    return { parent, weight }
  }
  const depthOf = (column: StatementColumn) => {
    let depth = 0
    let parent = column.parent ? byKey.get(column.parent) : undefined
    while (parent) {
      depth++
      parent = parent.parent ? byKey.get(parent.parent) : undefined
    }
    return depth
  }

  const children = new Map<string | null, { column: StatementColumn; weight: number }[]>()
  for (const column of withValue) {
    const { parent, weight } = anchorOf(column)
    const list = children.get(parent?.key ?? null) ?? []
    list.push({ column, weight })
    children.set(parent?.key ?? null, list)
  }
  // 排序鍵：自己的 GL 與底下每一個科目的 GL 取最前面的。光比自己的 GL 會錯：現金流量表的「本期增減」是 EEEE、「期初現金」是 E00100，
  // 字串比較 E0 在 EE 前面，期初就排到本期增減前面；本期增減底下有營業活動的 A 開頭代碼，取最前面的就排對了。沒有 GL 的（taxonomy 本身
  // 沒編）排在同一段的最後
  const sortKeys = new Map<string, string>()
  const sortKeyOf = (column: StatementColumn): string => {
    const known = sortKeys.get(column.key)
    if (known !== undefined) return known
    let key = column.gl || '~'
    for (const child of children.get(column.key) ?? []) {
      const childKey = sortKeyOf(child.column)
      if (childKey < key) key = childKey
    }
    sortKeys.set(column.key, key)
    return key
  }
  for (const list of children.values()) list.sort((a, b) => (sortKeyOf(a.column) < sortKeyOf(b.column) ? -1 : sortKeyOf(a.column) > sortKeyOf(b.column) ? 1 : 0))

  const rule = CONCISE_RULES[statementType]
  const baseOf = (values: Values) => Math.max(0, ...rule.base.map(key => Math.abs(num(values, key) ?? 0)))
  const base = baseOf(current) || baseOf(prior)
  const qualifies = (column: StatementColumn) => {
    if (showAll) return true
    // 股數、資本適足率不是金額，只在展開全部時列
    if (column.unit === '%' || column.unit === '股') return false
    if (!column.parent) return true
    if (column.total && depthOf(column) <= 1) return true
    const size = Math.max(Math.abs(num(current, column.key) ?? 0), Math.abs(num(prior, column.key) ?? 0))
    return base > 0 && size >= rule.share * base
  }
  const visible = new Set<string>()
  const markVisible = (column: StatementColumn): boolean => {
    // 先看完所有子科目（不能短路，每一個都要標）
    const anyChild = (children.get(column.key) ?? []).map(child => markVisible(child.column)).includes(true)
    if (anyChild || qualifies(column)) visible.add(column.key)
    return visible.has(column.key)
  }
  for (const root of children.get(null) ?? []) markVisible(root.column)

  const lines: StatementLine[] = []
  const emit = (column: StatementColumn) => {
    const shown = (children.get(column.key) ?? []).filter(child => visible.has(child.column.key))
    for (const child of shown) emit(child.column)
    if (shown.length) {
      const remainder = (values: Values) => {
        const total = num(values, column.key)
        if (total === null) return null
        return total - shown.reduce((sum, child) => sum + child.weight * (num(values, child.column.key) ?? 0), 0)
      }
      const otherCurrent = remainder(current)
      const otherPrior = remainder(prior)
      // 小於 1（千元）的差是四捨五入，不是漏掉的科目
      const hasOther = [otherCurrent, otherPrior].some(value => value !== null && Math.abs(value) >= 1)
      // 合計底下只列出一個子科目、兩期金額都一樣：那一行只是重複（2330 的「營業毛利」與「營業毛利淨額」、「繼續營業單位本期淨利」與
      // 「本期淨利」），只留合計
      const only = shown.length === 1 ? shown[0]!.column : null
      const last = lines.at(-1)
      if (!hasOther && only && last?.key === only.key && num(current, only.key) === num(current, column.key) && num(prior, only.key) === num(prior, column.key)) lines.pop()
      if (hasOther) {
        lines.push({
          key: `${column.key}__other`,
          label: '其他',
          total: false,
          other: true,
          unit: column.unit,
          current: otherCurrent === null ? null : String(Math.round(otherCurrent)),
          prior: otherPrior === null ? null : String(Math.round(otherPrior))
        })
      }
    }
    lines.push({ key: column.key, label: column.label, total: shown.length > 0, other: false, unit: column.unit, current: current?.[column.key] ?? null, prior: prior?.[column.key] ?? null })
  }
  for (const root of children.get(null) ?? []) {
    if (visible.has(root.column.key)) emit(root.column)
  }
  return { lines, hidden: withValue.length - visible.size }
}

// Per-share lines are in 元; everything else on a filing is in 新台幣千元（confirmation requested
// from 業務中台 2026-09-19 — the endpoint doesn't state its unit）.
// 科目 key 是 mops 第三階段（2026-10-12 切換）之後的詞彙表名稱，例 purchase_of_ppe_classified_as_investing_activities；
// 切換前的短名（purchase_of_ppe_investing）已經不存在，沒有並存期。
export const PER_SHARE_KEYS = new Set(['basic_earnings_loss_per_share', 'diluted_earnings_loss_per_share'])

// Deterministic thousands grouping for the bigint-precise strings 業務中台 sends（no toLocaleString）.
export function formatStatementAmount(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '－'
  return groupThousands(raw)
}

// 增減%（當期 vs 去年同期）, two decimals; null when either side is missing or the base is zero.
export function statementChangePercent(current: string | null | undefined, prior: string | null | undefined): string {
  if (!current || !prior) return '－'
  const now = Number(current)
  const then = Number(prior)
  if (!Number.isFinite(now) || !Number.isFinite(then) || then === 0) return '－'
  return `${(((now - then) / Math.abs(then)) * 100).toFixed(2)}%`
}
