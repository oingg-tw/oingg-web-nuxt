// 篩選狀態放進網址的編碼與解析（app/utils/screener-url.ts，2026-10-22）。網址是任何人都能改的輸入：格式不對的要略過，不能讓頁面拿去查
import assert from 'node:assert/strict'
import { decodeScreenerQuery, encodeScreenerQuery, sameFilters } from '../app/utils/screener-url.ts'

// 來回一趟不變
const state = {
  filters: [
    { field: 'roe.TTM', min: 15, max: null, exclude: false },
    { field: 'debtRatio.Q', min: null, max: 60, exclude: true },
    { field: 'peRatio.TTM', min: 5.5, max: 20, exclude: false },
    { field: 'fundType', min: null, max: null, exclude: false, values: ['股票型', '槓桿型／反向型'] },
    { field: 'exDividendMonths.EOD', min: null, max: null, exclude: false, values: ['7'] }
  ],
  columns: ['roe.TTM', 'debtRatio.Q', 'pbRatioRiverBand.5Y_1D'],
  sort: { field: 'roe.TTM', order: 'desc' }
}
const query = encodeScreenerQuery(state)
assert.deepEqual(query.f, ['roe.TTM:15~', '!debtRatio.Q:~60', 'peRatio.TTM:5.5~20', 'fundType:股票型,槓桿型／反向型', 'exDividendMonths.EOD:7'])
assert.equal(query.c, 'roe.TTM,debtRatio.Q,pbRatioRiverBand.5Y_1D')
assert.equal(query.sort, 'roe.TTM:desc')
assert.deepEqual(decodeScreenerQuery(query), state)

// 只有一個條件時網址給的是字串不是陣列
assert.deepEqual(decodeScreenerQuery({ f: 'roe.TTM:15~' })?.filters, [{ field: 'roe.TTM', min: 15, max: null, exclude: false }])

// 格式不對的整個略過，其他照收
const messy = decodeScreenerQuery({
  f: ['roe.TTM:abc~', 'roe.TTM:~', '1bad:1~2', 'x.Q:1~2~3', 'ok.Q:-3~', 'cat.EOD:,,', 'noColon', '<script>:1~'],
  c: 'roe.TTM,bad column,2x,ok.Q',
  sort: 'roe.TTM:up'
})
assert.deepEqual(messy, { filters: [{ field: 'ok.Q', min: -3, max: null, exclude: false }], columns: ['roe.TTM', 'ok.Q'], sort: null })

// 什麼都沒有（或全都不合格）回 null：頁面照平常開
assert.equal(decodeScreenerQuery({}), null)
assert.equal(decodeScreenerQuery({ f: 'bad', sort: 'x:sideways' }), null)
assert.equal(decodeScreenerQuery({ template: 'value' }), null)

// 上限：20 個條件、40 個欄位
const many = decodeScreenerQuery({ f: Array.from({ length: 25 }, (_, i) => `m${i}.Q:${i}~`), c: Array.from({ length: 50 }, (_, i) => `c${i}.Q`).join(',') })
assert.equal(many?.filters.length, 20)
assert.equal(many?.columns.length, 40)

// 同一組條件：順序、類別值的順序、數字或字串都不算
assert.ok(sameFilters(
  [{ field: 'a.Q', min: 1, max: null, exclude: false }, { field: 'm.EOD', min: null, max: null, exclude: false, values: [7, 6] }],
  [{ field: 'm.EOD', min: null, max: null, exclude: false, values: ['6', '7'] }, { field: 'a.Q', min: 1, max: null, exclude: false }]
))
assert.ok(!sameFilters([{ field: 'a.Q', min: 1, max: null, exclude: false }], [{ field: 'a.Q', min: 1, max: null, exclude: true }]))

console.log('PASS: screener url')
