// shared/utils/chart-empty.ts：空圖回報的公開端點只收定好的欄位與格式。
// Run: node scripts/check-chart-empty.mjs
import assert from 'node:assert/strict'
import { cleanChartEmptyReport } from '../shared/utils/chart-empty.ts'

const ok = { symbol: '6116', chart: 'valuation-river', metric: 'pe', timeframe: 'TTM', lookbackYears: 1, reason: 'zero_or_negative_denominator', route: '/stock/6116/pe-ratio' }

assert.deepEqual(cleanChartEmptyReport(ok), ok, '定好的欄位照收')
assert.deepEqual(cleanChartEmptyReport({ ...ok, chart: 'metric-history', metric: 'grossMargin', timeframe: 'Q', lookbackYears: null, reason: 'no_points' }), { ...ok, chart: 'metric-history', metric: 'grossMargin', timeframe: 'Q', lookbackYears: null, reason: 'no_points' }, '歷史圖、沒有回溯年數')
assert.equal(cleanChartEmptyReport({ ...ok, extra: 1 }), null, '多一個鍵不收')
assert.equal(cleanChartEmptyReport({ ...ok, symbol: '2330; drop' }), null, '代號格式不對')
assert.equal(cleanChartEmptyReport({ ...ok, chart: 'pie' }), null, '不認得的圖')
assert.equal(cleanChartEmptyReport({ ...ok, route: '/stock/6116?token=x' }), null, '路徑帶查詢字串不收')
assert.equal(cleanChartEmptyReport({ ...ok, lookbackYears: 50 }), null, '回溯年數超出範圍')
assert.equal(cleanChartEmptyReport({ ...ok, reason: 'Missing Input' }), null, '原因只收小寫代碼')
assert.equal(cleanChartEmptyReport([ok]), null, '陣列不收')
assert.equal(cleanChartEmptyReport(null), null, '空的不收')

console.log('PASS: chart empty report')
