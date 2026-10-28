// 冷啟動等待的量測：讀業務中台的 cold 標記、瀏覽器組回報、伺服器檢查回報（shared/utils/cold-start-timing.ts）。
// Run: node scripts/check-cold-start-timing.mjs（selfcheck 也會跑）
import assert from 'node:assert/strict'
import { coldStartIdOf, coldStartServerTiming, coldStartReportsOf, cleanColdStartReport, unionMs } from '../shared/utils/cold-start-timing.ts'

const ID = '0b6f3c1e-8d2a-4f5b-9c7e-1a2b3c4d5e6f'

// 業務中台的標頭：只在冷的那次有 cold；跟其他項目串在一起也找得到；沒有或不是 UUID 就是 null
assert.equal(coldStartIdOf(`cold;desc="${ID}"`), ID)
assert.equal(coldStartIdOf(`app;dur=12, cold;desc="${ID.toUpperCase()}"`), ID)
assert.equal(coldStartIdOf('app;dur=12, upstream;dur=3'), null)
assert.equal(coldStartIdOf('cold;desc="not-a-uuid"'), null)
assert.equal(coldStartIdOf(null), null)

// web-nuxt 寫給瀏覽器的：只有 web-nuxt 自己的數字；一頁叫醒幾個容器就有幾項 cold，dur 是等那一支多久
const ID2 = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
assert.equal(coldStartServerTiming([{ id: ID, waitMs: 5612.4 }], 5650, 5700.2, true, null), `cold;dur=5612;desc="${ID}", waitall;dur=5650, web;dur=5700, webcold`)
assert.equal(coldStartServerTiming([{ id: ID, waitMs: 452 }, { id: ID2, waitMs: 7045 }], 9000, 16141, false, null), `cold;dur=452;desc="${ID}", cold;dur=7045;desc="${ID2}", waitall;dur=9000, web;dur=16141`)
// 沒有冷啟動的回應也寫，只是沒有 cold
assert.equal(coldStartServerTiming([], 120, 340, false, null), 'waitall;dur=120, web;dur=340')
// 入口機房寫在最後
assert.equal(coldStartServerTiming([{ id: ID, waitMs: 452 }], 452, 900, true, 'SJC'), `cold;dur=452;desc="${ID}", waitall;dur=452, web;dur=900, webcold, colo;desc="SJC"`)

// 等所有業務中台呼叫的時間：重疊的只算一次，包在裡面的不加，隔開的相加
assert.equal(unionMs([]), 0)
assert.equal(unionMs([[0, 100], [50, 150]]), 150)
assert.equal(unionMs([[0, 100], [20, 30]]), 100)
assert.equal(unionMs([[200, 300], [0, 100]]), 200)
assert.equal(unionMs([[0, 100], [100, 200], [150, 160]]), 200)

// 瀏覽器：document 從 0 算；連線重用（secureConnectionStart 0）的 TLS 是 null；沒有 cold 就不回報
const navigation = {
  name: 'https://example.test/stock/2330/dividend?tab=1',
  startTime: 0,
  domainLookupStart: 5,
  domainLookupEnd: 25,
  connectStart: 25,
  connectEnd: 80,
  secureConnectionStart: 40,
  requestStart: 85,
  responseStart: 5900,
  responseEnd: 6100,
  serverTiming: [
    { name: 'cold', duration: 5612, description: ID },
    { name: 'waitall', duration: 5650, description: '' },
    { name: 'web', duration: 5700, description: '' },
    { name: 'webcold', duration: 0, description: '' },
    { name: 'l2gfet4t7', duration: 5800, description: '' },
    { name: 'colo', duration: 0, description: 'SJC' }
  ]
}
const [report, ...rest] = coldStartReportsOf(navigation, 'document', Date.parse('2026-10-26T01:00:00.000Z'))
assert.equal(rest.length, 0)
assert.deepEqual(report, {
  id: ID,
  route: '/stock/2330/dividend',
  kind: 'document',
  at: '2026-10-26T01:00:00.000Z',
  webColdWaitMs: 5612,
  webBusinessWaitMs: 5650,
  webServerMs: 5700,
  isWebCold: true,
  requestStartMs: 85,
  responseStartMs: 5900,
  responseEndMs: 6100,
  dnsMs: 20,
  connectMs: 55,
  tlsMs: 40,
  edgeColo: 'SJC'
})
const api = { ...navigation, name: 'https://example.test/api/core/watchlists', startTime: 9000, requestStart: 9010, responseStart: 9300, responseEnd: 9320, secureConnectionStart: 0, serverTiming: navigation.serverTiming.slice(0, 3) }
const [apiReport] = coldStartReportsOf(api, 'api', 0)
assert.equal(apiReport.responseStartMs, 300)
assert.equal(apiReport.requestStartMs, 10)
assert.equal(apiReport.tlsMs, null)
assert.equal(apiReport.isWebCold, false)
assert.equal(apiReport.edgeColo, null)
assert.deepEqual(coldStartReportsOf({ ...navigation, serverTiming: [] }, 'document', 0), [])
// 一頁叫醒兩個容器：兩份，各自的等待時間，其餘相同
const both = coldStartReportsOf({ ...navigation, serverTiming: [{ name: 'cold', duration: 452, description: ID }, { name: 'cold', duration: 7045, description: ID2 }, ...navigation.serverTiming.slice(1)] }, 'document', 0)
assert.deepEqual(both.map(item => [item.id, item.webColdWaitMs]), [[ID, 452], [ID2, 7045]])
assert.equal(both[1].responseStartMs, both[0].responseStartMs)

// 伺服器：定好的欄位才收；其他欄位、壞的 id／路徑／kind／時間、超出範圍的數字整筆不收；沒給的數字是 null
assert.deepEqual(cleanColdStartReport(report), report)
assert.equal(cleanColdStartReport({ ...report, email: 'a@b.c' }), null)
// 10/28 改名前的舊名也算不認得的欄位
assert.equal(cleanColdStartReport({ ...report, ttfbMs: 1 }), null)
assert.equal(cleanColdStartReport({ ...report, id: 'x' }), null)
assert.equal(cleanColdStartReport({ ...report, route: '/stock?x=1' }), null)
assert.equal(cleanColdStartReport({ ...report, route: 'stock' }), null)
assert.equal(cleanColdStartReport({ ...report, kind: 'img' }), null)
assert.equal(cleanColdStartReport({ ...report, at: 'yesterday' }), null)
assert.equal(cleanColdStartReport({ ...report, responseStartMs: 600_001 }), null)
assert.equal(cleanColdStartReport({ ...report, responseStartMs: -1 }), null)
assert.equal(cleanColdStartReport({ ...report, isWebCold: 'yes' }), null)
assert.equal(cleanColdStartReport({ ...report, edgeColo: 'sjc' }), null)
assert.equal(cleanColdStartReport({ ...report, edgeColo: 'SJC"' }), null)
assert.equal(cleanColdStartReport([report]), null)
const { tlsMs: _tls, ...withoutTls } = report
assert.equal(cleanColdStartReport({ ...withoutTls, responseStartMs: 12.6 }).tlsMs, null)
assert.equal(cleanColdStartReport({ ...withoutTls, edgeColo: undefined }).edgeColo, null)
assert.equal(cleanColdStartReport({ ...withoutTls, responseStartMs: 12.6 }).responseStartMs, 13)

console.log('PASS: cold start timing')
