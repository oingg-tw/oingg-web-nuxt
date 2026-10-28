// 業務中台 Go 版的並存期（shared/utils/business-go-compat.ts）：Go 版的鍵換回站內的舊鍵，舊格式原樣通過。
// Run: node scripts/check-business-go-compat.mjs（selfcheck 也會跑）
import assert from 'node:assert/strict'
import { metricsCatalogFromGo, preferredStockFromGo, traitsFromGo, withExType } from '../shared/utils/business-go-compat.ts'

// A14：息／權／權息各一筆，舊格式原樣
assert.deepEqual(withExType({ symbol: '2330', exDividendDate: '2026-09-16' }), { symbol: '2330', exDividendDate: '2026-09-16', exDate: '2026-09-16', exType: '息' })
assert.deepEqual(withExType({ symbol: '6505', exRightsDate: '2026-08-01' }), { symbol: '6505', exRightsDate: '2026-08-01', exDate: '2026-08-01', exType: '權' })
assert.equal(withExType({ exDividendDate: '2026-07-10', exRightsDate: '2026-07-10' }).exType, '權息')
const oldNotice = { symbol: '2330', exDate: '2026-09-16', exType: '息' }
assert.equal(withExType(oldNotice), oldNotice)

// A6：Go 版的型錄換回舊鍵；舊型錄內容不變
const goCatalog = { categories: [{ categoryKey: 'profitability', categoryDisplayName: '獲利能力', sort: 1, metrics: [{ metricCode: 'roe', name: 'ROE', fields: [{ timeframe: 'TTM', unit: '%' }] }] }] }
const oldCatalog = { categories: [{ key: 'profitability', name: '獲利能力', sort: 1, metrics: [{ key: 'roe', path: 'roe', name: 'ROE', fields: [{ key: 'TTM', name: 'TTM', period: 'TTM', unit: '%' }] }] }] }
assert.deepEqual(metricsCatalogFromGo(goCatalog), oldCatalog)
assert.deepEqual(metricsCatalogFromGo(oldCatalog), oldCatalog)

// A11、A12
assert.deepEqual(traitsFromGo({ asOf: '2026-10-27', portfolio: {}, benchmark: { beta: 1 } }).market, { beta: 1 })
assert.deepEqual(traitsFromGo({ asOf: null, portfolio: {}, market: null }), { asOf: null, portfolio: {}, market: null })
const preferred = preferredStockFromGo({ symbol: '2881A', companyName: '富邦特', listingDate: '2016-05-30' })
assert.equal(preferred.name, '富邦特')
assert.equal(preferred.listedDate, '2016-05-30')
assert.equal(preferredStockFromGo({ symbol: '2881A', name: '富邦特', listedDate: null }).name, '富邦特')

console.log('business-go-compat: ok')
