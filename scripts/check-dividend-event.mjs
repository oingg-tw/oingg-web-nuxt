// 配息月曆的日期（app/utils/dividend-event.ts）：手機週檢視的那一週、週末判斷、日期標籤
// Run: node scripts/check-dividend-event.mjs
import assert from 'node:assert/strict'
import { addDays, dayInYear, dividendPeriodLabel, exTypeGroups, hasWeekendDate, monthDay, payLines, perShareText, resolutionAmounts, resolutionExLines, resolutionGroups, shortDayLabel, tradingWeekOf } from '../app/utils/dividend-event.ts'

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

// 股利期間（董事會已通過的股利，2026-11-24）：年度、季、半年，其他照起訖
assert.equal(dividendPeriodLabel(2025, '2025-01-01', '2025-12-31'), '2025 年度')
assert.equal(dividendPeriodLabel(2026, '2026-04-01', '2026-06-30'), '2026 年第 2 季')
assert.equal(dividendPeriodLabel(2026, '2026-10-01', '2026-12-31'), '2026 年第 4 季')
assert.equal(dividendPeriodLabel(2026, '2026-07-01', '2026-12-31'), '2026 年下半年')
assert.equal(dividendPeriodLabel(2026, '2026-02-01', '2026-03-31'), '2026-02-01～2026-03-31')
assert.equal(dividendPeriodLabel(2026, null, null), '2026 年度')
// 季配：沒有股東會、還沒有除息日、沒有配股（手機一週那一行只寫金額）
const quarterly = { symbol: '2330', fiscalYear: 2026, dividendPeriodStartDate: '2026-07-01', dividendPeriodEndDate: '2026-09-30', shareholderMeetingDate: null, cashDividend: 6, stockDividend: 0, exDividendDate: null, exRightsDate: null }
assert.deepEqual(resolutionAmounts(quarterly), ['現金股利 6 元'])

// 一天的彈窗（方案 B，2026-11-24）的格子：金額去掉浮點雜訊、0 與沒有值是「－」；日期同年不寫年
assert.equal(perShareText(7.00000137), '7')
assert.equal(perShareText(4.11119542), '4.1112')
assert.equal(perShareText(0.05995515, 6), '0.059955')
assert.equal(perShareText(0), '－', '除權列的現金 0 不是配了 0 元')
assert.equal(perShareText(null), '－')
assert.equal(dayInYear('2026-12-01', '2026'), '12/1')
assert.equal(dayInYear('2027-01-20', '2026'), '2027/1/20')
assert.equal(dayInYear(null, '2026'), '－')
assert.deepEqual(payLines({ paymentDate: '2026-08-26', stockDividendDistributionDate: '2026-09-09' }, '2026'), ['8/26', '配股 9/9'])
assert.deepEqual(payLines({ paymentDate: null, stockDividendDistributionDate: '2026-09-09' }, '2026'), ['9/9'])
assert.deepEqual(payLines({ paymentDate: '2026-12-01' }, '2026'), ['12/1'])
assert.deepEqual(resolutionExLines({ exDividendDate: '2026-07-30', exRightsDate: '2026-07-30' }, '2026'), ['7/30'])
assert.deepEqual(resolutionExLines({ exDividendDate: '2026-07-16', exRightsDate: '2026-08-21' }, '2026'), ['息 7/16', '權 8/21'])
assert.deepEqual(resolutionExLines(quarterly, '2026'), ['－'])
// 除權息照類型（除息、除權、除權息），組裡照代號；沒有的類型不出現
const ex = (symbol, exType) => ({ symbol, exType })
assert.deepEqual(exTypeGroups([ex('7758', '權'), ex('00940', '息'), ex('0056', '息')]).map(group => [group.exType, group.rows.map(row => row.symbol)]), [['息', ['0056', '00940']], ['權', ['7758']]])
// 決議照股利期間：結束晚的在前（11/10：第 3 季在上半年前面），同一天結束的長的在前（3/12：年度、下半年、第 4 季）
const period = (symbol, start, end) => ({ ...quarterly, symbol, fiscalYear: Number(start.slice(0, 4)), dividendPeriodStartDate: start, dividendPeriodEndDate: end })
assert.deepEqual(resolutionGroups([period('8942', '2026-01-01', '2026-06-30'), period('2330', '2026-07-01', '2026-09-30'), period('1817', '2026-01-01', '2026-06-30')]).map(group => [group.label, group.rows.map(row => row.symbol)]), [['2026 年第 3 季', ['2330']], ['2026 年上半年', ['1817', '8942']]])
assert.deepEqual(resolutionGroups([period('1', '2025-10-01', '2025-12-31'), period('2', '2025-07-01', '2025-12-31'), period('3', '2025-01-01', '2025-12-31')]).map(group => group.label), ['2025 年度', '2025 年下半年', '2025 年第 4 季'])
console.log('PASS: dividend calendar dates')
