// 冷啟動等待的量測：讀業務中台的 cold 標記、瀏覽器組回報、伺服器檢查回報（shared/utils/cold-start-timing.ts）。
// Run: node scripts/check-cold-start-timing.mjs（selfcheck 也會跑）
import assert from 'node:assert/strict'
import { coldStartIdOf, coldStartServerTiming, coldStartReportOf, cleanColdStartReport } from '../shared/utils/cold-start-timing.ts'

const ID = '0b6f3c1e-8d2a-4f5b-9c7e-1a2b3c4d5e6f'

// 業務中台的標頭：只在冷的那次有 cold；跟其他項目串在一起也找得到；沒有或不是 UUID 就是 null
assert.equal(coldStartIdOf(`cold;desc="${ID}"`), ID)
assert.equal(coldStartIdOf(`app;dur=12, cold;desc="${ID.toUpperCase()}"`), ID)
assert.equal(coldStartIdOf('app;dur=12, upstream;dur=3'), null)
assert.equal(coldStartIdOf('cold;desc="not-a-uuid"'), null)
assert.equal(coldStartIdOf(null), null)

// web-nuxt 寫給瀏覽器的：只有 web-nuxt 自己的數字
assert.equal(coldStartServerTiming(ID, 5612.4, 5700.2, 812.6, true), `cold;desc="${ID}", wait;dur=5612, web;dur=5700, webup;dur=813, webcold`)
assert.equal(coldStartServerTiming(ID, 10, 20, 30, false).includes('webcold'), false)

// 瀏覽器：document 從 0 算；連線重用（secureConnectionStart 0）的 TLS 是 null；沒有 cold 就不回報
const navigation = {
  name: 'https://example.test/stock/2330/dividend?tab=1',
  startTime: 0,
  domainLookupStart: 5,
  domainLookupEnd: 25,
  connectStart: 25,
  connectEnd: 80,
  secureConnectionStart: 40,
  responseStart: 5900,
  responseEnd: 6100,
  serverTiming: [
    { name: 'cold', duration: 0, description: ID },
    { name: 'wait', duration: 5612, description: '' },
    { name: 'web', duration: 5700, description: '' },
    { name: 'webup', duration: 813, description: '' },
    { name: 'webcold', duration: 0, description: '' }
  ]
}
const report = coldStartReportOf(navigation, 'document', Date.parse('2026-10-26T01:00:00.000Z'))
assert.deepEqual(report, {
  id: ID,
  route: '/stock/2330/dividend',
  kind: 'document',
  at: '2026-10-26T01:00:00.000Z',
  webWaitMs: 5612,
  webServerMs: 5700,
  webCold: true,
  webUptimeMs: 813,
  ttfbMs: 5900,
  responseEndMs: 6100,
  dnsMs: 20,
  connectMs: 55,
  tlsMs: 40
})
const api = { ...navigation, name: 'https://example.test/api/core/watchlists', startTime: 9000, responseStart: 9300, responseEnd: 9320, secureConnectionStart: 0, serverTiming: navigation.serverTiming.slice(0, 4) }
const apiReport = coldStartReportOf(api, 'api', 0)
assert.equal(apiReport.ttfbMs, 300)
assert.equal(apiReport.tlsMs, null)
assert.equal(apiReport.webCold, false)
assert.equal(coldStartReportOf({ ...navigation, serverTiming: [] }, 'document', 0), null)

// 伺服器：定好的欄位才收；其他欄位、壞的 id／路徑／kind／時間、超出範圍的數字整筆不收；沒給的數字是 null
assert.deepEqual(cleanColdStartReport(report), report)
assert.equal(cleanColdStartReport({ ...report, email: 'a@b.c' }), null)
assert.equal(cleanColdStartReport({ ...report, id: 'x' }), null)
assert.equal(cleanColdStartReport({ ...report, route: '/stock?x=1' }), null)
assert.equal(cleanColdStartReport({ ...report, route: 'stock' }), null)
assert.equal(cleanColdStartReport({ ...report, kind: 'img' }), null)
assert.equal(cleanColdStartReport({ ...report, at: 'yesterday' }), null)
assert.equal(cleanColdStartReport({ ...report, ttfbMs: 600_001 }), null)
assert.equal(cleanColdStartReport({ ...report, ttfbMs: -1 }), null)
assert.equal(cleanColdStartReport({ ...report, webCold: 'yes' }), null)
assert.equal(cleanColdStartReport([report]), null)
const { tlsMs: _tls, ...withoutTls } = report
assert.equal(cleanColdStartReport({ ...withoutTls, ttfbMs: 12.6 }).tlsMs, null)
assert.equal(cleanColdStartReport({ ...withoutTls, ttfbMs: 12.6 }).ttfbMs, 13)

console.log('PASS: cold start timing')
