// 冷啟動測試（2026-10-29 收進 repo，使用者：「沒把測試流程commit?」；之前每次都是暫存資料夾的臨時腳本，結果記在
// docs/cloudflare-migration-plan.md 的冷啟動各節）。量「Worker 冷、KV 沒有、業務中台與數據中台都冷」時，使用者打開一頁要等多久、等在哪裡。
//
// 流程（照順序，每一步都不能省）：
//   1. 先通知管理站（oingg-admin-vue）停掉打 DEV 的輪詢（例如 /admin/health 每 30 秒一次），並請其他 session 測試期間別打 DEV。
//      有人在打，後端就不會冷，量到的是熱的。
//   2. 選一頁「從來沒被打開過」的頁面（KV 的鍵永遠不過期，開過一次就一直命中），例如沒人看過的代號的 /stock/{代號}/dividend；
//      不要先用 curl 試，試一次就熱了。歷次用過：1104、1108、1235、1237、1238、2002、1301。
//   3. 跑這支：它先查兩個後端的 Cloud Run 請求紀錄，最後一個請求離現在不到 COLD_IDLE_MINUTES（預設 20，Cloud Run 閒置約 15 分鐘縮到 0）
//      就停下來、列出是誰在打；閒置夠久才用真的瀏覽器打開那一頁（瀏覽器的冷啟動回報也會送出，管理站的冷啟動頁看得到）。
//   4. 印出一列結果，欄位同計畫文件的表；後端那一側的拆解（開容器、連庫）看管理站的冷啟動頁或兩邊的 Cloud Logging。
//   5. 結果記進計畫文件（日期、台北時刻、條件、入口與 rtt、n），再通知管理站恢復輪詢。
//
// Run: node scripts/measure-cold-start.mjs /stock/1240/dividend
//   COLD_BASE（預設 DEV）、COLD_IDLE_MINUTES、COLD_SKIP_IDLE_CHECK=1（只在刻意量「後端熱」的對照組時用）
// 需要本機 gcloud 已登入（讀兩邊的 Cloud Run 請求紀錄）與 playwright。
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const path = process.argv[2]
if (!path?.startsWith('/')) {
  console.error('用法：node scripts/measure-cold-start.mjs /stock/{沒開過的代號}/dividend')
  process.exit(2)
}
const base = process.env.COLD_BASE ?? 'https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev'
const idleMinutes = Number(process.env.COLD_IDLE_MINUTES ?? 20)
const BACKENDS = [
  { name: '業務中台', project: 'oingg-business', service: 'oingg-business-go-dev' },
  { name: '數據中台', project: 'oingg-data', service: 'oingg-data-rust-dev' }
]
const taipei = iso => new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(5, 19).replace('T', ' ')

// 最近的請求（Cloud Logging API；gcloud 只拿 token，過濾條件不經 shell）
async function recentRequests({ project, service }) {
  // 字串指令（Windows 的 gcloud 是 .cmd，要經 shell；沒有使用者給的參數）
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  const since = new Date(Date.now() - 6 * 3600e3).toISOString()
  const res = await fetch('https://logging.googleapis.com/v2/entries:list', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceNames: [`projects/${project}`],
      filter: `logName="projects/${project}/logs/run.googleapis.com%2Frequests" AND resource.labels.service_name="${service}" AND timestamp>="${since}"`,
      orderBy: 'timestamp desc',
      pageSize: 5
    })
  })
  if (!res.ok) throw new Error(`Cloud Logging 回 ${res.status}: ${await res.text()}`)
  return ((await res.json()).entries ?? []).map(entry => ({ at: entry.timestamp, url: entry.httpRequest?.requestUrl ?? '' }))
}

if (process.env.COLD_SKIP_IDLE_CHECK !== '1') {
  let busy = false
  for (const backend of BACKENDS) {
    const requests = await recentRequests(backend)
    const idle = requests.length ? (Date.now() - Date.parse(requests[0].at)) / 60000 : Infinity
    console.log(`${backend.name}：${requests.length ? `閒置 ${idle.toFixed(1)} 分鐘（最後一個請求 ${taipei(requests[0].at)}）` : '6 小時內沒有請求'}`)
    if (idle < idleMinutes) {
      busy = true
      for (const request of requests) console.log(`  ${taipei(request.at)} ${request.url.replace(/^https:\/\/[^/]+/, '')}`)
    }
  }
  if (busy) {
    console.error(`有後端閒置不到 ${idleMinutes} 分鐘，不是冷的；先請打它的人停下來（見上面的網址），等夠久再跑`)
    process.exit(1)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage()
const beacons = []
const timings = []
page.on('request', request => {
  if (request.url().endsWith('/api/cold-start-timing')) beacons.push(JSON.parse(request.postData() ?? '{}'))
})
page.on('response', response => {
  const timing = response.headers()['server-timing']
  if (timing?.includes('web;')) timings.push(`${new URL(response.url()).pathname} ${timing}`)
})
const startedAt = new Date()
const main = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 180000 })
const nav = await page.evaluate(() => {
  const entry = performance.getEntriesByType('navigation')[0]
  return { requestStart: entry.requestStart, ttfb: entry.responseStart - entry.requestStart }
})
// 冷啟動回報在頁面載入後才送
await page.waitForTimeout(6000)
await browser.close()

console.log(`\n${taipei(startedAt.toISOString())} ${base}${path} → ${main?.status()}`)
for (const line of timings) console.log(`server-timing ${line}`)
const report = beacons.find(beacon => beacon.kind === 'document') ?? beacons[0]
const ms = value => (typeof value === 'number' ? `${(value / 1000).toFixed(2)}` : '—')
console.log('\n| 台北 | 入口（rtt） | 業務中台最久那支 cold | waitall | Worker 自己 | 送出請求到第一個位元組 | webColdOffsetMs | 叫醒：送出／換 token／總長 |')
console.log(`| ${taipei(startedAt.toISOString()).slice(6, 11)} | ${report?.edgeColo ?? '—'}（${report?.clientTcpRttMs ?? '—'}） | ${ms(Math.max(...beacons.map(beacon => beacon.webColdWaitMs ?? 0)) || undefined)} | ${ms(report?.webBusinessWaitMs)} | ${ms(report ? report.webServerMs - report.webBusinessWaitMs : undefined)} | ${ms(nav.ttfb)} | ${report?.webColdOffsetMs ?? '—'} ms | ${report?.webWakeOffsetMs ?? '—'}／${report?.webWakeTokenMs ?? '—'}／${report?.webWakeMs ?? '—'} ms |`)
if (!beacons.length) console.log('（沒有冷啟動回報：這一頁沒有叫醒任何後端，可能 KV 命中或後端是熱的）')
console.log('\n記進 docs/cloudflare-migration-plan.md 的冷啟動一節，再通知管理站恢復輪詢。')
