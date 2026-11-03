// 業務中台回應 → 站內形狀（shared/utils/business-shapes.ts）。Run: node scripts/check-business-shapes.mjs（selfcheck 也會跑）
import assert from 'node:assert/strict'
import { metricsCatalogFromBusiness, withExType } from '../shared/utils/business-shapes.ts'

// 除權息：息／權／權息各一筆；兩個日期都沒有就原樣
assert.deepEqual(withExType({ symbol: '2330', exDividendDate: '2026-09-16' }), { symbol: '2330', exDividendDate: '2026-09-16', exDate: '2026-09-16', exType: '息' })
assert.deepEqual(withExType({ symbol: '6505', exRightsDate: '2026-08-01' }), { symbol: '6505', exRightsDate: '2026-08-01', exDate: '2026-08-01', exType: '權' })
assert.equal(withExType({ exDividendDate: '2026-07-10', exRightsDate: '2026-07-10' }).exType, '權息')
const bare = { symbol: '2330' }
assert.equal(withExType(bare), bare)

// 型錄：業務中台的名字換成篩選器用的那組
const catalog = { categories: [{ categoryKey: 'profitability', categoryDisplayName: '獲利能力', sort: 1, metrics: [{ metricCode: 'roe', name: 'ROE', unit: '%', fields: [{ timeframe: 'TTM', unit: '%' }] }] }] }
assert.deepEqual(metricsCatalogFromBusiness(catalog), {
  categories: [{ key: 'profitability', name: '獲利能力', sort: 1, metrics: [{ key: 'roe', path: 'roe', name: 'ROE', unit: '%', fields: [{ key: 'TTM', name: 'TTM', period: 'TTM', unit: '%' }] }] }]
})
// 沒有單位：舊的「無單位」與新的 null 都變成 null
const unitless = (unit) => metricsCatalogFromBusiness({ categories: [{ categoryKey: 'risk', categoryDisplayName: '風險', metrics: [{ metricCode: 'beta', unit, fields: [{ timeframe: '1Y_1D', unit }] }] }] }).categories[0].metrics[0]
for (const unit of ['無單位', null]) {
  const metric = unitless(unit)
  assert.equal(metric.unit, null, `指標層級的 ${unit} → null`)
  assert.equal(metric.fields[0].unit, null, `期別層級的 ${unit} → null`)
}

console.log('business-shapes: ok')
