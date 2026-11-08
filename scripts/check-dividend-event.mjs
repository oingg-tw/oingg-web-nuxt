// 配息月曆的日期（app/utils/dividend-event.ts）：手機週檢視的那一週、週末判斷、日期標籤
// Run: node scripts/check-dividend-event.mjs
import assert from 'node:assert/strict'
import { addDays, hasWeekendDate, monthDay, shortDayLabel, tradingWeekOf } from '../app/utils/dividend-event.ts'

const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
// 平日是當週；週六、週日打開時是下一週
for (const day of week) assert.deepEqual(tradingWeekOf(day), week, day)
assert.deepEqual(tradingWeekOf('2026-11-08'), week, '週日')
assert.deepEqual(tradingWeekOf('2026-11-07'), week, '週六')
// 跨月、跨年
assert.deepEqual(tradingWeekOf('2026-12-02'), ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'])
assert.deepEqual(tradingWeekOf('2026-12-31'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01'])

assert.equal(addDays('2026-11-09', -7), '2026-11-02')
assert.equal(addDays('2028-02-28', 1), '2028-02-29')
assert.equal(monthDay('2026-01-05'), '1/5')
assert.equal(shortDayLabel('2026-11-08'), '11/8（日）')
assert.equal(shortDayLabel('2026-01-05'), '1/5（一）')

// 2024-02-17 是補班的週六（發放日真的有）
assert.ok(hasWeekendDate(['2026-11-09', '2024-02-17']))
assert.ok(!hasWeekendDate(week))

console.log('PASS: dividend calendar dates')
