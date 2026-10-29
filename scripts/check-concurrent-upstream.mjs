// 一頁同時打很多支上游、快取又沒有時，每個請求都要 200（2026-10-29，寶雅指標速覽的月營收 500）：business.ts 原本全部請求共用「最多
// 12 支同時」，Workers 上排隊的請求自己沒有 I/O，被當成卡住取消、回 500，位子還會漏掉。同一個鍵同時讀（nitropack 的 pending）也一起測。
// 在本機 workerd（只有一個 isolate，請求一定撞在一起）配慢的假業務中台才會穩定重現；打 DEV 會分散到不同 isolate，過了不代表沒事。
//
// Run（CI 的 workers smoke 照這樣跑）：
//   node scripts/check-concurrent-upstream.mjs serve &       # 假業務中台，127.0.0.1:8799，每次 1.5 秒才回
//   wrangler dev --port 8788 --var NUXT_BUSINESS_BASE:http://127.0.0.1:8799 …
//   CHECK_BASE=http://127.0.0.1:8788 node scripts/check-concurrent-upstream.mjs
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

if (process.argv[2] === 'serve') {
  createServer((req, res) => setTimeout(() => {
    res.setHeader('content-type', 'application/json')
    res.end('{"symbol":"2330","entries":[]}')
  }, 1500)).listen(8799, '127.0.0.1')
} else {
  const base = process.env.CHECK_BASE ?? 'http://127.0.0.1:8788'
  // daily-price-history?limit=<隨機>：每次都是沒快取的新鍵（業務中台上限 2000；頁面用的是 2 與 2000）
  const fresh = () => `${base}/api/cached/stocks/2330/daily-price-history?limit=${3 + Math.floor(Math.random() * 1996)}`
  const statuses = urls => Promise.all(urls.map(url => fetch(url).then(res => res.status)))

  const same = fresh()
  assert.deepEqual(await statuses([same, same, same]), [200, 200, 200], `同一個鍵同時 3 個：${same}`)
  const distinct = await statuses(Array.from({ length: 20 }, fresh))
  assert.deepEqual(distinct, Array(20).fill(200), `不同的鍵同時 20 個：${distinct.join(',')}`)
  console.log('PASS: concurrent upstream reads')
}
