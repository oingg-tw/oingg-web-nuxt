// 首頁「這兩週的除權息與發放」的日子、要讀的月份、一天的摘要（shared/utils/home-weeks.ts）。Run: node scripts/check-home-weeks.mjs
import assert from 'node:assert/strict'
import { dayEvents, homeMonths, homeWeeks } from '../shared/utils/home-weeks.ts'

// 週一：本週＋下週，各五天
assert.deepEqual(homeWeeks('2026-11-02'), [
  { label: '本週', dates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'] },
  { label: '下週', dates: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'] }
])
// 週五還是這一週；跨月照算
assert.equal(homeWeeks('2026-10-30')[0].dates[0], '2026-10-26')
assert.equal(homeWeeks('2026-10-30')[1].dates[4], '2026-11-06')
// 週六、週日看下一週，標題改成下週／下下週
for (const weekend of ['2026-10-31', '2026-11-01']) {
  const weeks = homeWeeks(weekend)
  assert.deepEqual(weeks.map(week => week.label), ['下週', '下下週'])
  assert.equal(weeks[0].dates[0], '2026-11-02')
}

// 往前三個月加兩週碰到的月份；跨年也對
assert.deepEqual(homeMonths('2026-11-02', '2026-11-13'), ['2026-08', '2026-09', '2026-10', '2026-11'])
assert.deepEqual(homeMonths('2026-12-28', '2027-01-08'), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
assert.deepEqual(homeMonths('2026-02-02', '2026-02-13'), ['2025-11', '2025-12', '2026-01', '2026-02'])

// 一天的摘要：同一檔只算一次，前兩檔照代號排；除權息日與發放日分開算
const rows = [
  { symbol: '00939', name: '統一台灣高息動能', exDate: '2026-11-03', paymentDate: '2026-11-25' },
  { symbol: '00406A', name: '主動中信台灣收益', exDate: '2026-11-03', paymentDate: null },
  { symbol: '00950B', name: '凱基A級公司債', exDate: '2026-11-03', paymentDate: '2026-11-27' },
  { symbol: '00939', name: '統一台灣高息動能', exDate: '2026-11-03', paymentDate: '2026-11-25' },
  { symbol: '6165', name: '浪凡', exDate: '2026-10-20', paymentDate: '2026-11-03' }
]
assert.deepEqual(dayEvents(rows, '2026-11-03', 'exDate'), {
  count: 3,
  first: [{ symbol: '00406A', name: '主動中信台灣收益' }, { symbol: '00939', name: '統一台灣高息動能' }]
})
assert.deepEqual(dayEvents(rows, '2026-11-03', 'paymentDate'), { count: 1, first: [{ symbol: '6165', name: '浪凡' }] })
assert.deepEqual(dayEvents(rows, '2026-11-05', 'exDate'), { count: 0, first: [] })

console.log('check-home-weeks: ok')
