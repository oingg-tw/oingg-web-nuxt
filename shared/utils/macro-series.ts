// 總經參考序列頁的資料整理（2026-11-24，server/utils/macro-data.ts 的 referencePage 用，頁面讀層名與項目名）：政策利率換成每月、
// M2 組成、CPI 分項樹、GDP 各需求項目。被 scripts/check-macro-series.mjs 直接 import，所以零 import

// 政策利率：重貼現率是調整的日期，換成每月月底那天適用的利率；隔夜拆款利率每月一點。從重貼現率的第一筆畫到兩者較晚的那個月
export function policyRateMonths(events: { effectiveDate: string; discountRate: number | null }[], callLoans: { yearMonth: string; ratePct: number | null }[]): { period: string; values: Record<string, number | null> }[] {
  const sorted = [...events].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  if (!sorted.length) return []
  const callByMonth = new Map(callLoans.map(entry => [entry.yearMonth, entry.ratePct]))
  const last = [sorted.at(-1)!.effectiveDate.slice(0, 7), ...callByMonth.keys()].sort().at(-1)!
  const points: { period: string; values: Record<string, number | null> }[] = []
  let index = -1
  for (let month = sorted[0]!.effectiveDate.slice(0, 7); month <= last; month = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 7)) {
    while (index + 1 < sorted.length && sorted[index + 1]!.effectiveDate.slice(0, 7) <= month) index += 1
    points.push({ period: month, values: { discountRate: index >= 0 ? sorted[index]!.discountRate : null, callLoanRate: callByMonth.get(month) ?? null } })
  }
  return points
}

// M2 組成的六層（億元）：M1B 拆成通貨淨額與存款貨幣（支票、活期、活期儲蓄存款），準貨幣拆成定期及定期儲蓄存款、外匯存款、郵政儲金，
// 其餘（附買回交易、外國人新台幣存款、貨幣市場共同基金）用準貨幣合計減掉三項，加起來就是 M2
export const M2_LAYERS = [
  { key: 'currency_held_by_public', name: '通貨淨額' },
  { key: 'deposit_money_total', name: '存款貨幣' },
  { key: 'time_and_savings_deposits', name: '定期及定期儲蓄存款' },
  { key: 'foreign_currency_deposits', name: '外匯存款' },
  { key: 'postal_savings_deposits', name: '郵政儲金' },
  { key: 'other_quasi_money', name: '其他準貨幣' }
] as const
const COMPOSITION_MONTHS = 120

export function m2Composition(items: { category: string; entries: { yearMonth: string; amountMillionNtd: number | null }[] }[]): { period: string; values: Record<string, number | null> }[] {
  const byCategory = new Map(items.map(item => [item.category, new Map(item.entries.map(entry => [entry.yearMonth, entry.amountMillionNtd]))]))
  const months = [...(byCategory.get('m2')?.keys() ?? [])].sort().slice(-COMPOSITION_MONTHS)
  const amount = (category: string, month: string) => byCategory.get(category)?.get(month) ?? null
  // 百萬元 → 億元
  const toYi = (value: number | null) => (value === null ? null : Math.round(value) / 100)
  return months.map((month) => {
    const quasi = amount('quasi_money_total', month)
    const named = ['time_and_savings_deposits', 'foreign_currency_deposits', 'postal_savings_deposits'].map(category => amount(category, month))
    const other = quasi === null || named.some(value => value === null) ? null : quasi - named.reduce((sum, value) => sum! + value!, 0)!
    return {
      period: month,
      values: Object.fromEntries(M2_LAYERS.map(layer => [layer.key, toYi(layer.key === 'other_quasi_money' ? other : amount(layer.key, month))]))
    }
  })
}

// CPI 分項：七大類與各分項最新一期的年增率。depth 由上層往上數（七大類是 0）。code 是主計總處的細項代碼（2026-11-25 數據中台 c85130b：
// 名稱可能改字、代碼不變，拿它當鍵），上層也用代碼對（parentItemCode，同日 46b516b，總指數是 null）。沒有上層代碼時（業務中台還沒轉出、
// 或 gov 缺）用上層名稱先找到那一項的鍵，所以代碼與名稱混著也對得上
export function cpiTree(items: { itemCode?: string | null; itemName: string; parentItemCode?: string | null; parentItemName: string | null; itemOrder: number; entries: { yearMonth: string; yoyChangePct: number | null }[] }[]): { code: string; name: string; parent: string | null; depth: number; yearMonth: string | null; yoyChangePct: number | null }[] {
  const keyOf = (item: (typeof items)[number]) => item.itemCode ?? item.itemName
  const keyByName = new Map(items.map(item => [item.itemName, keyOf(item)]))
  const parentOf = new Map(items.map(item => [keyOf(item), item.parentItemCode ?? (item.parentItemName === null ? null : keyByName.get(item.parentItemName) ?? item.parentItemName)]))
  const depthOf = (key: string): number => {
    let depth = -1
    for (let parent = parentOf.get(key) ?? null; parent; parent = parentOf.get(parent) ?? null) depth += 1
    return depth
  }
  return [...items].sort((a, b) => a.itemOrder - b.itemOrder).map((item) => {
    const last = item.entries.findLast(entry => entry.yoyChangePct !== null) ?? null
    return { code: keyOf(item), name: item.itemName, parent: item.parentItemName, depth: depthOf(keyOf(item)), yearMonth: last?.yearMonth ?? null, yoyChangePct: last?.yoyChangePct ?? null }
  })
}

// 經濟成長率頁的各需求項目：主計總處的順序，近 8 季
export const GDP_COMPONENTS = [
  { category: 'private_consumption', name: '民間消費' },
  { category: 'government_consumption', name: '政府消費' },
  { category: 'fixed_capital_formation_total', name: '固定資本形成' },
  { category: 'exports', name: '輸出' },
  { category: 'imports', name: '輸入' }
] as const
export const GDP_COMPONENT_QUARTERS = 8
