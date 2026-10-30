// 業務中台 Rust 換版並存（shared/utils/business-rust-compat.ts）：Rust 的新鍵換回站內的舊名、Go 的舊鍵原樣。Run: node scripts/check-business-rust-compat.mjs
import assert from 'node:assert/strict'
import { performanceFromRust, shareReturnRatio } from '../shared/utils/business-rust-compat.ts'

// C1：Rust 的形狀補上舊名；逐年的 period 是年份，不動
const rust = performanceFromRust({
  twr: '0.1',
  series: [{ tradeDate: '2026-10-29', cumulative: '0.01' }],
  riskFree: { source: '五大銀行', latestYearMonth: '2026-09', rates: [{ yearMonth: '2026-09', ratePct: 1.7, sourceYearMonth: '2026-08' }] },
  periodReturns: { yearly: [{ period: '2026', portfolio: '0.1' }], monthly: [{ yearMonth: '2026-09', portfolio: '0.01' }] }
})
assert.equal(rust.twr, '0.1')
// C2：series 的 tradeDate 換回 date
assert.deepEqual(rust.series, [{ tradeDate: '2026-10-29', date: '2026-10-29', cumulative: '0.01' }])
assert.equal(rust.riskFree.latestPeriod, '2026-09')
assert.deepEqual(rust.riskFree.rates[0], { yearMonth: '2026-09', period: '2026-09', ratePct: 1.7, sourceYearMonth: '2026-08', sourcePeriod: '2026-08' })
assert.equal(rust.periodReturns.monthly[0].period, '2026-09')
assert.deepEqual(rust.periodReturns.yearly, [{ period: '2026', portfolio: '0.1' }])

// Go 的形狀原樣讀得到；riskFree 是 null 照舊是 null
const go = { series: [{ date: '2026-10-29', cumulative: '0.01' }], riskFree:{ source: 's', latestPeriod: '2026-09', rates: [{ period: '2026-09', ratePct: 1.7, sourcePeriod: '2026-08' }] }, periodReturns: { yearly: [], monthly: [{ period: '2026-09' }] } }
assert.deepEqual(performanceFromRust(go), go)
assert.equal(performanceFromRust({ riskFree: null, periodReturns: { yearly: [], monthly: [] } }).riskFree, null)

// C6：returnPct 是百分比、pnlPct 是 0～1；換回 0～1。新舊都有時用新的
assert.equal(shareReturnRatio({ returnPct: 5 }), 0.05)
assert.equal(shareReturnRatio({ returnPct: '-12.5' }), -0.125)
// Rust 實際的格式：4 位小數的百分比字串，對應 Go 的 "0.123456"
assert.ok(Math.abs(shareReturnRatio({ returnPct: '12.3456' }) - 0.123456) < 1e-12)
assert.equal(shareReturnRatio({ pnlPct: '0.05' }), 0.05)
assert.equal(shareReturnRatio({ returnPct: 5, pnlPct: '0.05' }), 0.05)
assert.equal(shareReturnRatio({ returnPct: 0 }), 0)
assert.equal(shareReturnRatio({ returnPct: null, pnlPct: null }), null)
assert.equal(shareReturnRatio({}), null)

console.log('PASS: business rust compat')
