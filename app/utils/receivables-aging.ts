// 應收帳款帳齡（數據中台 B 批第 7 項，2026-11-22；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz 的 7）：財報附註把應收帳款依逾期多久
// 分段。數據中台把申報的分段歸到五個標準段（group），跨好幾段的（2330「逾期 31 天以上」、2317「90 天內」）group 是 null，照它自己的分段畫。
// 逾期占比＝逾期 ÷（未逾期＋逾期），個別評估兩邊都不算；發票日（立帳日）起算的公司寫「帳齡 N 天」、不算逾期占比。金額千元。
// 被 scripts/check-receivables-aging.mjs 直接 import，所以零 import（金額的格式由呼叫端傳進來）
export interface AgingBucket {
  // 申報原文（「未 逾 期」「逾期30天內」）
  label: string
  // not_overdue、overdue、invoice_age、individual、other、unknown
  kind: string
  fromDays: number | null
  // null＝以上
  toDays: number | null
  amount: number | null
  // not_overdue、overdue_1_30、overdue_31_90、overdue_91_180、overdue_181_plus；跨段與非逾期類是 null
  group: string | null
}

export interface AgingPeriod {
  fiscalYear: number
  fiscalQuarter: number | null
  // overdue、overdue_only、invoice_age、unparsed
  agingBasis: string
  total: number | null
  overdueRatio: number | null
  overdueRatioNullReason: string | null
  // 負的（備抵損失）
  allowance: number | null
  buckets: AgingBucket[]
}

export interface ReceivablesAging {
  symbol: string
  // 新到舊；在名單但沒有帳齡附註（銀行、金控）是 []
  periods: AgingPeriod[]
}

const GROUPS: Record<string, { name: string; from: number }> = {
  not_overdue: { name: '未逾期', from: -1 },
  overdue_1_30: { name: '逾期 1～30 天', from: 1 },
  overdue_31_90: { name: '逾期 31～90 天', from: 31 },
  overdue_91_180: { name: '逾期 91～180 天', from: 91 },
  overdue_181_plus: { name: '逾期 181 天以上', from: 181 }
}
const KIND_ORDER: Record<string, number> = { not_overdue: 0, overdue: 1, invoice_age: 2, individual: 3, other: 4, unknown: 5 }

// 表格照申報的分段列：拿掉原文裡的空白（台積電寫「未 逾 期」）；逾期的沒寫「逾期」、發票日口徑沒寫「帳齡」的補上，免得「90天內」讀不出是什麼
export function agingRowLabel(bucket: AgingBucket): string {
  const label = bucket.label.replace(/\s+/g, '')
  if (bucket.kind === 'not_overdue') return '未逾期'
  if (bucket.kind === 'overdue' && !label.includes('逾期')) return `逾期 ${label}`
  if (bucket.kind === 'invoice_age' && !label.includes('帳齡')) return `帳齡 ${label}`
  return label
}

// 圖上的一層：落在標準段的用標準段的名字（同一段的幾列加總），跨段的照申報的分段
export const agingLayerName = (bucket: AgingBucket) => GROUPS[bucket.group ?? '']?.name ?? agingRowLabel(bucket)

const sortKey = (bucket: AgingBucket): [number, number] => [KIND_ORDER[bucket.kind] ?? 9, GROUPS[bucket.group ?? '']?.from ?? bucket.fromDays ?? -1]

// 圖上各層的順序：未逾期、逾期（由短到長）、帳齡、個別評估、其他；順序固定，顏色跟著層走。kinds 只取那幾類（逾期圖只要 overdue）
export function agingLayerNames(periods: AgingPeriod[], kinds?: string[]): string[] {
  const keys = new Map<string, [number, number]>()
  for (const bucket of periods.flatMap(period => period.buckets).filter(bucket => !kinds || kinds.includes(bucket.kind))) {
    const name = agingLayerName(bucket)
    if (!keys.has(name)) keys.set(name, sortKey(bucket))
  }
  return [...keys].sort(([, a], [, b]) => a[0] - b[0] || a[1] - b[1]).map(([name]) => name)
}

// 這一期各層占總額的 %（100% 堆疊）；總額沒有給就用各段加總
export function agingShares(period: AgingPeriod): Record<string, number> {
  const total = period.total ?? period.buckets.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0)
  const shares: Record<string, number> = {}
  if (!total) return shares
  for (const bucket of period.buckets) {
    const name = agingLayerName(bucket)
    shares[name] = (shares[name] ?? 0) + (bucket.amount ?? 0) / total * 100
  }
  return shares
}

// 圖只畫逾期的部分（2026-11-22，使用者選「只畫逾期部分」：九成以上是未逾期，100% 長條上逾期只剩一條細線）：各段占未逾期加逾期的 %，
// 加起來就是逾期占比（個別評估兩邊都不算，同數據中台的算法）。整段期間都沒有逾期的列（發票日口徑）才畫 100% 的帳齡分布
export const hasOverdueBuckets = (periods: AgingPeriod[]) => periods.some(period => period.buckets.some(bucket => bucket.kind === 'overdue'))

export function agingOverdueShares(period: AgingPeriod): Record<string, number> {
  const base = period.buckets.filter(bucket => bucket.kind === 'not_overdue' || bucket.kind === 'overdue').reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0)
  const shares: Record<string, number> = {}
  if (!base) return shares
  for (const bucket of period.buckets.filter(item => item.kind === 'overdue')) {
    const name = agingLayerName(bucket)
    shares[name] = (shares[name] ?? 0) + (bucket.amount ?? 0) / base * 100
  }
  return shares
}

export const agingPeriodLabel = (period: AgingPeriod) => `${period.fiscalYear} Q${period.fiscalQuarter}`

// 答句（卡片前的文字只寫答案）：有逾期占比的寫還沒逾期與逾期各多少、備抵損失；發票日口徑寫帳齡最短那一段占多少；其他的寫總額。money 是千元的格式
export function agingAnswer(period: AgingPeriod, money: (thousand: number) => string): string {
  const label = agingPeriodLabel(period)
  if (period.overdueRatio !== null) {
    const allowance = period.allowance ? `；備抵損失 ${money(Math.abs(period.allowance))}` : ''
    return `${label} 應收帳款有 ${(100 - period.overdueRatio).toFixed(2)}% 還沒逾期，逾期占 ${period.overdueRatio.toFixed(2)}%${allowance}。`
  }
  const youngest = period.agingBasis === 'invoice_age'
    ? [...period.buckets].filter(bucket => bucket.kind === 'invoice_age').sort((a, b) => (a.fromDays ?? 0) - (b.fromDays ?? 0))[0]
    : undefined
  const total = period.total ?? 0
  if (youngest?.amount != null && total > 0) return `${label} 應收帳款有 ${(youngest.amount / total * 100).toFixed(2)}% 帳齡在 ${youngest.label.replace(/\s+/g, '').replace(/^帳齡/, '')}。`
  return `${label} 應收帳款總額 ${money(total)}。`
}
