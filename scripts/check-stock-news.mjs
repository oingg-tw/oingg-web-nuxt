// app/utils/stock-news.ts：近期新聞依台北日期分組（今天／昨天）、台北時刻，24 小時內的「N 分鐘前／N 小時前」。
// Run: node scripts/check-stock-news.mjs
import assert from 'node:assert/strict'
import { stockNewsAgo, stockNewsGroups, announcementGroups } from '../app/utils/stock-news.ts'

const article = (publishedAt, title = publishedAt) => ({ title, source: '三立新聞網', link: `https://example.com/${title}`, publishedAt })
const groups = stockNewsGroups([
  article('2026-11-12T16:30:00Z'), // 台北 11-13 00:30：過了台北午夜就是隔天
  article('2026-11-12T08:48:00.000Z'), // 合約的格式：UTC、帶毫秒
  article('2026-11-12T01:05:00+08:00'),
  article('not a date'),
  article('2026-11-11T12:41:00Z'),
  article('2026-11-10T10:03:00Z')
], '2026-11-13')
assert.deepEqual(groups.map(group => [group.day, group.prefix, group.items.map(item => item.time)]), [
  ['2026-11-13', '今天', ['00:30']],
  ['2026-11-12', '昨天', ['16:48', '01:05']],
  ['2026-11-11', '', ['20:41']],
  ['2026-11-10', '', ['18:03']]
], '依台北日期分組，讀不懂的時間那則不列')

const now = Date.parse('2026-11-12T09:30:00Z')
assert.equal(stockNewsAgo('2026-11-12T08:48:00Z', now), '（42 分鐘前）')
assert.equal(stockNewsAgo('2026-11-12T09:29:40Z', now), '（1 分鐘前）', '不到 1 分鐘算 1 分鐘')
assert.equal(stockNewsAgo('2026-11-12T03:05:00Z', now), '（6 小時前）')
assert.equal(stockNewsAgo('2026-11-11T09:31:00Z', now), '（23 小時前）')
assert.equal(stockNewsAgo('2026-11-11T09:30:00Z', now), '', '滿 24 小時只寫時刻')
assert.equal(stockNewsAgo('2026-11-12T09:35:00Z', now), '', '未來的時間不寫')
assert.equal(stockNewsAgo('not a date', now), '')
// 重大訊息（2026-11-21）：依發言日期分組，今天／昨天，時刻取時：分，沒有時刻寫空的
const announced = announcementGroups([
  { market: 'sii', announcementDate: '2026-11-12', announcementTime: '21:01:11', announcedAt: '2026-11-12T13:01:11.000Z', factDate: null, generatedDate: null, subject: 'a', clauseNo: 51, description: '' },
  { market: 'sii', announcementDate: '2026-11-11', announcementTime: '16:09:03', announcedAt: null, factDate: null, generatedDate: null, subject: 'b', clauseNo: null, description: '' },
  { market: 'sii', announcementDate: '2026-11-11', announcementTime: null, announcedAt: null, factDate: null, generatedDate: null, subject: 'c', clauseNo: null, description: '' },
  { market: 'sii', announcementDate: '2026-11-03', announcementTime: '09:00:00', announcedAt: null, factDate: null, generatedDate: null, subject: 'd', clauseNo: null, description: '' }
], '2026-11-12')
assert.deepEqual(announced.map(group => [group.day, group.prefix, group.items.map(item => item.time)]), [['2026-11-12', '今天', ['21:01']], ['2026-11-11', '昨天', ['16:09', '']], ['2026-11-03', '', ['09:00']]])
console.log('PASS: stock news time and announcement groups')
