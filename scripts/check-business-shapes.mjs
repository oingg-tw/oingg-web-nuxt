// 業務中台回應 → 站內形狀（shared/utils/business-shapes.ts）。Run: node scripts/check-business-shapes.mjs（selfcheck 也會跑）
import assert from 'node:assert/strict'
import { metricsCatalogFromBusiness, withExType } from '../shared/utils/business-shapes.ts'
import { businessErrorDetail, describeBusinessError } from '../app/utils/bff-error.ts'

// 除權息：息／權／權息各一筆；兩個日期都沒有就原樣
assert.deepEqual(withExType({ symbol: '2330', exDividendDate: '2026-09-16' }), [{ symbol: '2330', exDividendDate: '2026-09-16', exDate: '2026-09-16', exType: '息' }])
assert.deepEqual(withExType({ symbol: '6505', exRightsDate: '2026-08-01' }), [{ symbol: '6505', exRightsDate: '2026-08-01', exDate: '2026-08-01', exType: '權' }])
assert.equal(withExType({ exDividendDate: '2026-07-10', exRightsDate: '2026-07-10' })[0].exType, '權息')
const bare = { symbol: '2330' }
assert.deepEqual(withExType(bare), [bare])
// 權息兩個日期不同天：拆成兩筆，除息那筆沒有配股、除權那筆沒有現金（2026-11-16，原本除權日被吃掉）
const split = withExType({ symbol: '1234', exDividendDate: '2026-07-10', exRightsDate: '2026-08-05', cashDividend: 1.5, paymentDate: '2026-08-01', stockDividendRatio: 0.05, stockDividendDistributionDate: '2026-09-01' })
assert.deepEqual(split.map(row => [row.exDate, row.exType, row.cashDividend, row.paymentDate, row.stockDividendRatio, row.stockDividendDistributionDate]), [
  ['2026-07-10', '息', 1.5, '2026-08-01', null, null],
  ['2026-08-05', '權', null, null, 0.05, '2026-09-01']
])
assert.equal('stockShares' in split[0], false, '沒有的欄位不加')

// 純現增不是股利（2026-11-25）：只有除權日的整筆拿掉；同一天有現金股利的留成一筆息，現增欄位清掉
const rights = { symbol: '2414', exRightsDate: '2026-11-06', exRightsComponents: ['cashCapitalIncrease'], subscriptionPricePerShare: 46, stockHoldingRatio: 98.927, capitalIncreaseShares: 20000000 }
assert.deepEqual(withExType(rights), [])
const cashAndRights = withExType({ ...rights, symbol: '7899', exDividendDate: '2026-11-06', cashDividend: 0.94 })
assert.deepEqual(cashAndRights.map(row => [row.exDate, row.exType, row.cashDividend, row.exRightsDate, row.stockHoldingRatio, row.exRightsComponents]), [['2026-11-06', '息', 0.94, null, null, null]])
const cashThenRights = withExType({ ...rights, exDividendDate: '2026-10-01', cashDividend: 0.4 })
assert.deepEqual(cashThenRights.map(row => [row.exDate, row.exType]), [['2026-10-01', '息']])
// 配股又現增、看不出來的照舊是權
assert.equal(withExType({ ...rights, exRightsComponents: ['stockDividend', 'cashCapitalIncrease'], stockDividendRatio: 0.08 })[0].exType, '權')
assert.equal(withExType({ ...rights, exRightsComponents: null }).length, 1)

// 型錄：業務中台的名字換成篩選器用的那組
const catalog = { categories: [{ categoryKey: 'profitability', categoryDisplayName: '獲利能力', sort: 1, metrics: [{ metricCode: 'roe', name: 'ROE', unit: '%', fields: [{ timeframe: 'TTM', unit: '%' }] }] }] }
assert.deepEqual(metricsCatalogFromBusiness(catalog), {
  categories: [{ key: 'profitability', name: '獲利能力', sort: 1, metrics: [{ key: 'roe', path: 'roe', name: 'ROE', unit: '%', fields: [{ key: 'TTM', name: 'TTM', period: 'TTM', unit: '%' }] }] }]
})

// 錯誤說明（app/utils/bff-error.ts）：業務中台的 detail 是英文，原文留給程式讀，不進提示（2026-11-08，502 的「Could not reach the analysis service」）
const problem = (status, detail, code) => ({ statusCode: status, data: { type: `tag:oingg.com,2026:${code}`, title: 'Bad Gateway', status, detail, code } })
const unavailable = problem(502, 'Could not reach the analysis service', 'upstream_unavailable')
assert.equal(describeBusinessError(unavailable), null)
assert.equal(businessErrorDetail(unavailable), 'Could not reach the analysis service')
const oversold = problem(409, 'Selling 500 shares of "2330" on 2026-10-05 would exceed the 300 you hold at that point', 'ledger_oversold')
assert.equal(describeBusinessError(oversold), null)
assert.match(businessErrorDetail(oversold), /on 2026-10-05 would exceed the 300 you hold/)
assert.equal(describeBusinessError(problem(409, '已經有同名的清單', 'duplicate')), '已經有同名的清單')
assert.equal(describeBusinessError({ statusCode: 400, data: { error: { message: '代號格式不對' } } }), '代號格式不對')
assert.equal(describeBusinessError(new Error('fetch failed')), null)

console.log('business-shapes: ok')
