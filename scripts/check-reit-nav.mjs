// REITs 每日淨值併成每月一列（shared/utils/reit-nav.ts）。Run: node scripts/check-reit-nav.mjs
import assert from 'node:assert/strict'
import { reitNavMonths } from '../shared/utils/reit-nav.ts'

const day = (tradeDate, nav, close, premiumDiscountPct) => ({ tradeDate, nav, close, premiumDiscountPct })
// 順序打亂也照日期併；月底沒成交時收盤價取那個月最後一筆有成交的；沒成交的日子不算進折溢價
const months = reitNavMonths([
  day('2026-10-02', 10.9, 10.1, -7.34),
  day('2026-09-30', 10.8, null, null),
  day('2026-09-01', 10.7, 9.9, -7.48),
  day('2026-10-01', 10.95, 10.0, -8.68),
  day('2026-09-15', 10.75, 10.0, -6.98)
])
assert.deepEqual(months, [
  { month: '2026-09', close: 10.0, nav: 10.8, tradingDays: 2, premiumAverage: -7.23, premiumHighest: -6.98, premiumLowest: -7.48 },
  { month: '2026-10', close: 10.1, nav: 10.9, tradingDays: 2, premiumAverage: -8.01, premiumHighest: -7.34, premiumLowest: -8.68 }
])

// 整個月都沒成交：收盤價與折溢價是 null，淨值照有
assert.deepEqual(reitNavMonths([day('2026-08-31', 10.6, null, null)]), [
  { month: '2026-08', close: null, nav: 10.6, tradingDays: 0, premiumAverage: null, premiumHighest: null, premiumLowest: null }
])
assert.deepEqual(reitNavMonths([]), [])

console.log('PASS: reit nav months')
