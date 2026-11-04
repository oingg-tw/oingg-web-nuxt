// 指標搜尋的比對鍵（app/utils/search-text.ts）：異體字、大小寫、跟中文相鄰的空白；英文字之間的空白要留著
// Run: node scripts/check-search-text.mjs
import assert from 'node:assert/strict'
import { searchKey } from '../app/utils/search-text.ts'

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
console.log('search key: ok')
