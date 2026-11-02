// 首頁「接下來的除權息與發放」要讀的月份與從今天起的那幾天（shared/utils/home-agenda.ts）。Run: node scripts/check-home-agenda.mjs
import assert from 'node:assert/strict'
import { homeMonths, upcomingDays } from '../shared/utils/home-agenda.ts'

// 往前三個月到下個月；跨年也對
assert.deepEqual(homeMonths('2026-11-02'), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])
assert.deepEqual(homeMonths('2026-12-31'), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
assert.deepEqual(homeMonths('2026-02-01'), ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])

const row = (symbol, exDate, paymentDate, cash = 1, exType = '息') => ({ symbol, name: `名稱${symbol}`, exDate, paymentDate, cash, exType, kind: 'etf' })
const rows = [
  row('00939', '2026-11-03', '2026-11-25'),
  row('00406A', '2026-11-03', null),
  row('00939', '2026-11-03', '2026-11-25'),
  row('6165', '2026-10-20', '2026-11-03', 5),
  row('2414', '2026-11-06', null, 0, '權'),
  row('1101', '2026-10-30', '2026-11-02'),
  row('2330', '2026-11-20', '2026-12-10'),
  row('2317', '2026-11-30', '2027-01-05')
]

// 今天以前的不列；同一天同一檔只算一次、照代號排；欄位只帶畫面要的
assert.deepEqual(upcomingDays(rows, '2026-11-02', 'exDate', 2), [
  { date: '2026-11-03', items: [{ symbol: '00406A', name: '名稱00406A', cash: 1, exType: '息' }, { symbol: '00939', name: '名稱00939', cash: 1, exType: '息' }] },
  { date: '2026-11-06', items: [{ symbol: '2414', name: '名稱2414', cash: 0, exType: '權' }] }
])
// 只列有事件的日子，最多 limit 天；今天本身算在內
assert.deepEqual(upcomingDays(rows, '2026-11-02', 'exDate', 9).map(day => day.date), ['2026-11-03', '2026-11-06', '2026-11-20', '2026-11-30'])
assert.deepEqual(upcomingDays(rows, '2026-11-02', 'paymentDate', 3).map(day => day.date), ['2026-11-02', '2026-11-03', '2026-11-25'])
// 發放日是 null 的不列
assert.equal(upcomingDays(rows, '2026-11-02', 'paymentDate', 9).flatMap(day => day.items).some(item => item.symbol === '00406A'), false)

console.log('check-home-agenda: ok')
