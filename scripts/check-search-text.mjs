// 搜尋的比對鍵與股票搜尋的排序（app/utils/search-text.ts）：異體字、全形、大小寫、跟中文相鄰的空白；英文字之間的空白要留著
// Run: node scripts/check-search-text.mjs
import assert from 'node:assert/strict'
import { searchKey, searchStocks } from '../app/utils/search-text.ts'

const found = (name, query) => searchKey(name).includes(searchKey(query))

// 型錄統一成數字前後留空格（2026-11-04），有人打有人不打，兩種寫法都要對得到
for (const query of ['營收 3 年', '營收3年', '營收 3年', '營收3 年', ' 營收　3 年 ']) assert.ok(found('營收 3 年複合成長率', query), query)
assert.ok(found('營收3年複合成長率', '營收 3 年'))
assert.ok(found('距 52 週高點', '距52週'))
assert.ok(found('Altman Z-Score 危機預警分數', 'z-score 危機'))
// 英文字之間的空白不能拿掉：nameEnMatches 靠它認出多字查詢，拿掉的話「book value」搜不到 Book Value
assert.equal(searchKey('Book Value'), 'book value')
assert.equal(searchKey('  ROE '), 'roe')
assert.equal(searchKey('周轉率'), '週轉率')
assert.equal(searchKey('臺積電'), searchKey('台積電'))
assert.equal(searchKey('２３３０'), '2330')

const STOCKS = [
  ['0050', '元大台灣50'], ['0056', '元大高股息'], ['00878', '國泰永續高股息'], ['00679B', '元大美債20年'], ['006201', '元大富櫃50'],
  ['1101B', '台泥乙特'], ['2330', '台積電'], ['2834', '臺企銀'], ['2891', '中信金'], ['2891B', '中信金乙特'], ['00752', '中信中國50'],
  ['5007', '三星'], ['5601', '台聯櫃'], ['6201', '亞弘電']
].map(([code, name]) => ({ code, name }))
const codes = query => searchStocks(STOCKS, query).map(stock => stock.code)

// 開頭的零可以不打，而且排在開頭相同的代號前面
assert.equal(codes('878')[0], '00878')
assert.deepEqual(codes('56'), ['0056', '5601'])
assert.deepEqual(codes('50').slice(0, 2), ['0050', '5007'])
assert.equal(codes('679')[0], '00679B')
// 打滿四碼時是那一檔，不是開頭有零的 ETF
assert.deepEqual(codes('6201'), ['6201', '006201'])
// 臺／台、全形、大小寫
assert.deepEqual(codes('臺積電'), ['2330'])
assert.deepEqual(codes('台企銀'), ['2834'])
assert.deepEqual(codes('２３３０'), ['2330'])
assert.deepEqual(codes('1101b'), ['1101B'])
// 名稱比中的，公司本身排在它的 ETF、特別股前面
assert.deepEqual(codes('中信'), ['2891', '2891B', '00752'])
assert.deepEqual(codes('  '), [])
assert.deepEqual(codes('不存在'), [])
console.log('search key: ok')
