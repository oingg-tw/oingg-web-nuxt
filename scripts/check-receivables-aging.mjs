// 應收帳款帳齡（app/utils/receivables-aging.ts）：圖層名稱與順序、各層占比、答句，用 DEV 實測的三種口徑
// Run: node scripts/check-receivables-aging.mjs
import assert from 'node:assert/strict'
import { agingAnswer, agingLayerNames, agingRowLabel, agingShares } from '../app/utils/receivables-aging.ts'

const money = thousand => `${(thousand / 100000).toFixed(2)}億元`
const bucket = (label, kind, group, fromDays, toDays, amount) => ({ label, kind, group, fromDays, toDays, amount })

// 2330 2026 Q3：逾期口徑；「逾期31天以上」跨段（group null）照它自己的分段
const tsmc = { fiscalYear: 2026, fiscalQuarter: 3, agingBasis: 'overdue', total: 476126961, overdueRatio: 2.76, overdueRatioNullReason: null, allowance: -815202, buckets: [
  bucket('未 逾 期', 'not_overdue', 'not_overdue', null, null, 462964446), bucket('逾期30天內', 'overdue', 'overdue_1_30', 1, 30, 13162512), bucket('逾期31天以上', 'overdue', null, 31, null, 3)
] }
assert.deepEqual(agingLayerNames([tsmc]), ['未逾期', '逾期 1～30 天', '逾期31天以上'])
assert.equal(agingRowLabel(tsmc.buckets[0]), '未逾期')
assert.equal(agingShares(tsmc)['未逾期'].toFixed(2), '97.24')
assert.equal(agingAnswer(tsmc, money), '2026 Q3 應收帳款有 97.24% 還沒逾期，逾期占 2.76%；備抵損失 8.15億元。')

// 2317：「90天內」跨 1～30 與 31～90（補上「逾期」），181 天以上的三列併成一層，順序照天數
const foxconn = { fiscalYear: 2026, fiscalQuarter: 3, agingBasis: 'overdue', total: 1000, overdueRatio: 2.5, overdueRatioNullReason: null, allowance: null, buckets: [
  bucket('未逾期', 'not_overdue', 'not_overdue', null, null, 900), bucket('90天內', 'overdue', null, 1, 90, 40), bucket('91-180天', 'overdue', 'overdue_91_180', 91, 180, 10),
  bucket('181-270天', 'overdue', 'overdue_181_plus', 181, 270, 20), bucket('270-360天', 'overdue', 'overdue_181_plus', 270, 360, 10), bucket('361天以上', 'overdue', 'overdue_181_plus', 361, null, 20)
] }
assert.deepEqual(agingLayerNames([foxconn]), ['未逾期', '逾期 90天內', '逾期 91～180 天', '逾期 181 天以上'])
assert.equal(agingShares(foxconn)['逾期 181 天以上'], 5)
assert.equal(agingAnswer(foxconn, money), '2026 Q3 應收帳款有 97.50% 還沒逾期，逾期占 2.50%。')

// 1101：發票日口徑，寫「帳齡」、不算逾期占比，答句寫帳齡最短那一段
const tcc = { fiscalYear: 2026, fiscalQuarter: 3, agingBasis: 'invoice_age', total: 35699491, overdueRatio: null, overdueRatioNullReason: 'invoice_age_basis', allowance: null, buckets: [
  bucket('91～180天', 'invoice_age', null, 91, 180, 9462513), bucket('0～90天', 'invoice_age', null, 0, 90, 25684763)
] }
assert.deepEqual(agingLayerNames([tcc]), ['帳齡 0～90天', '帳齡 91～180天'])
assert.equal(agingAnswer(tcc, money), '2026 Q3 應收帳款有 71.95% 帳齡在 0～90天。')

// 解析不了的分段：沒有占比，寫總額
const unparsed = { ...tcc, agingBasis: 'unparsed', overdueRatioNullReason: 'unparsed_rows', buckets: [bucket('逾期365天', 'unknown', null, null, null, 100)] }
assert.equal(agingAnswer(unparsed, money), '2026 Q3 應收帳款總額 356.99億元。')

console.log('check-receivables-aging: ok')
