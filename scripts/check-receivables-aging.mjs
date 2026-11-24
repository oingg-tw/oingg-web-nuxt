// 應收帳款帳齡（app/utils/receivables-aging.ts）：圖層名稱與順序、各層占比、答句，用 DEV 實測的三種口徑
// Run: node scripts/check-receivables-aging.mjs
import assert from 'node:assert/strict'
import { agingAnswer, agingLayerNames, agingOverdueShares, agingRowLabel, agingShares, hasOverdueRatio } from '../app/utils/receivables-aging.ts'

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
// 逾期圖：只取逾期的層，各段占未逾期加逾期，加起來就是逾期占比；有個別評估那一段時不算進分母
assert.deepEqual(agingLayerNames([foxconn], ['overdue']), ['逾期 90天內', '逾期 91～180 天', '逾期 181 天以上'])
const overdueShares = agingOverdueShares(foxconn)
assert.equal(Object.values(overdueShares).reduce((a, b) => a + b, 0).toFixed(2), '10.00')
const withIndividual = { ...foxconn, buckets: [...foxconn.buckets, bucket('個別評估', 'individual', null, null, null, 1000)] }
assert.equal(agingOverdueShares(withIndividual)['逾期 181 天以上'], 5)
assert.equal(hasOverdueRatio([foxconn]), true)
// 只寫一個天數的逾期（「逾期90天」，group 與天數都是 null）排在逾期的最後
const single = { ...foxconn, buckets: [bucket('逾期90天', 'overdue', null, null, null, 5), ...foxconn.buckets] }
assert.deepEqual(agingLayerNames([single], ['overdue']), ['逾期 90天內', '逾期 91～180 天', '逾期 181 天以上', '逾期90天'])
// 只列逾期、沒有未逾期的那一季（overdue_only）沒有逾期占比：照列算會是逾期 100%，所以看的是逾期占比
const overdueOnly = { ...foxconn, agingBasis: 'overdue_only', overdueRatio: null, overdueRatioNullReason: 'no_not_overdue_row', buckets: foxconn.buckets.filter(item => item.kind === 'overdue') }
assert.equal(Object.values(agingOverdueShares(overdueOnly)).reduce((a, b) => a + b, 0), 100)
assert.equal(hasOverdueRatio([overdueOnly]), false)

// 1101：發票日口徑，寫「帳齡」、不算逾期占比，答句寫帳齡最短那一段
const tcc = { fiscalYear: 2026, fiscalQuarter: 3, agingBasis: 'invoice_age', total: 35699491, overdueRatio: null, overdueRatioNullReason: 'invoice_age_basis', allowance: null, buckets: [
  bucket('91～180天', 'invoice_age', null, 91, 180, 9462513), bucket('0～90天', 'invoice_age', null, 0, 90, 25684763)
] }
assert.deepEqual(agingLayerNames([tcc]), ['帳齡 0～90天', '帳齡 91～180天'])
assert.equal(agingAnswer(tcc, money), '2026 Q3 應收帳款有 71.95% 帳齡在 0～90天。')
assert.equal(hasOverdueRatio([tcc]), false)

// 解析不了的分段：沒有占比，寫總額
const unparsed = { ...tcc, agingBasis: 'unparsed', overdueRatioNullReason: 'unparsed_rows', buckets: [bucket('逾期365天', 'unknown', null, null, null, 100)] }
assert.equal(agingAnswer(unparsed, money), '2026 Q3 應收帳款總額 356.99億元。')

// 2201 2026 Q3：照信用風險階段揭露（數據中台公式第 2 版），階段照申報順序、排在個別評估與其他前面；沒有逾期占比，答句寫總額
const yulon = { fiscalYear: 2026, fiscalQuarter: 3, agingBasis: 'credit_stage', total: 188783584, overdueRatio: null, overdueRatioNullReason: 'credit_stage_basis', allowance: null, buckets: [
  bucket('簡化作法', 'other', null, null, null, 5128111), bucket('12個月預期信用損失', 'credit_stage', null, null, null, 178516197),
  bucket('信用風險已顯著增加者', 'credit_stage', null, null, null, 3008082), bucket('已信用減損者', 'individual', null, null, null, 2131194)
] }
assert.deepEqual(agingLayerNames([yulon]), ['12個月預期信用損失', '信用風險已顯著增加者', '已信用減損者', '簡化作法'])
assert.equal(hasOverdueRatio([yulon]), false)
assert.equal(agingAnswer(yulon, money), '2026 Q3 應收帳款總額 1887.84億元。')

console.log('check-receivables-aging: ok')
