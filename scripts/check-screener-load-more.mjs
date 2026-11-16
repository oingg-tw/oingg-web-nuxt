// 查詢途中捲到底，下一頁不能就這樣沒了（2026-11-05，check-screener-operations 偶爾「捲到底沒有多載一頁」，等 45 秒都沒有請求）。
// 那次碰到底被 loadMoreResults 擋掉（還在查），查完列數一樣是 20，哨兵也還在畫面裡，IntersectionObserver 不會再通知；使用者要捲開再捲回來才動。
// 把查詢放慢就能穩定重現。訪客，查詢是真的，只是放慢。
// Run: 本機 dev（:3000）開著，node scripts/check-screener-load-more.mjs（BASE_URL 可換 DEV）
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()

const pages = []
let delay = 0
await page.route('**/api/core/etf-screener', async (route) => {
  pages.push(JSON.parse(route.request().postData() ?? '{}').page ?? null)
  if (delay) await new Promise(resolve => setTimeout(resolve, delay))
  await route.continue()
})

const rows = page.locator('.el-table__body tbody tr')
const sentinel = page.locator('.screener-result-table__load-more:not(.screener-result-table__load-more--end)')

await page.goto(`${base}/screener/etf`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await rows.first().waitFor({ timeout: 60000 })
const before = await rows.count()

// 用不會超過一頁的距離停在表格上方，這時哨兵不在畫面裡
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(500)
delay = 2500
pages.length = 0
await page.locator('.screener-result-table__head', { hasText: '淨值' }).first().click()
await page.locator('.column-menu [role="menu"]').getByRole('menuitem', { name: /由大到小/ }).click()
await page.waitForTimeout(400)
// 查詢還在跑，捲到底：哨兵進到畫面裡，這一次被擋掉
await sentinel.first().scrollIntoViewIfNeeded()
const sentinelSeen = await sentinel.first().isVisible()
delay = 0

const start = Date.now()
let after = before
while (Date.now() - start < 12000) {
  after = await rows.count()
  if (after > before) break
  await page.waitForTimeout(250)
}
const loadMorePassed = sentinelSeen && pages[0] === 1 && after > before
console.log(`查詢的頁碼 ${JSON.stringify(pages)}，列數 ${before} → ${after}，哨兵${sentinelSeen ? '有' : '沒有'}進畫面`)

// 換排序那一次逾時（useScreenerTabs 的 12 秒）：舊排序的列與頁數不能留著（2026-11-16，使用者換排序後往下捲，兩個技嘉、兩個大山）。
// 留著的話，往下捲會拿新排序的第 N+1 頁接在舊的列後面。普通股、訪客、真的查詢，只把換排序那一次的第一頁放慢到逾時之後
const common = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const sent = []
let holdFirstPage = false
await common.route('**/api/core/screener', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}')
  sent.push({ sort: `${body.sortField}:${body.order}`, page: body.page })
  if (holdFirstPage && body.page === 1) {
    holdFirstPage = false
    await new Promise(resolve => setTimeout(resolve, 14000))
  }
  await route.continue().catch(() => {})
})
const commonRows = common.locator('.el-table__body tbody tr')
await common.goto(`${base}/screener/common?f=roe.TTM:15~&c=exchangePeRatio.EOD,livePbRatio.EOD,roe.TTM&sort=livePbRatio.EOD:desc`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await commonRows.first().waitFor({ timeout: 60000 })
for (let i = 0; i < 2; i++) {
  await common.mouse.wheel(0, 4000)
  await common.waitForTimeout(1500)
}
const loadedPages = Math.max(...sent.map(entry => entry.page))
holdFirstPage = true
await common.locator('.screener-result-table__head', { hasText: '本益比' }).first().click()
await common.locator('.column-menu [role="menu"]').getByRole('menuitem', { name: /由大到小/ }).click()
await common.waitForTimeout(12500)
for (let i = 0; i < 3; i++) {
  await common.mouse.wheel(0, 4000)
  await common.waitForTimeout(1500)
}
await common.waitForTimeout(4000)
const symbols = await commonRows.evaluateAll(trs => trs.map(tr => tr.querySelector('.screener-result-table__code')?.textContent?.trim() ?? ''))
await browser.close()

const newSort = sent.filter(entry => entry.sort === 'exchangePeRatio.EOD:desc').map(entry => entry.page)
const firstLater = newSort.find(page => page > 1)
const duplicates = symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index)
const timeoutPassed = loadedPages >= 2 && (firstLater === undefined || firstLater === 2) && !duplicates.length
console.log(`換排序前載入 ${loadedPages} 頁；新排序請求的頁碼 ${JSON.stringify(newSort)}；畫面上重複 ${duplicates.length} 檔 ${duplicates.slice(0, 5).join(' ')}`)

if (!loadMorePassed) console.log('FAIL: 查詢途中捲到底，查完沒有載下一頁')
if (!timeoutPassed) console.log('FAIL: 換排序那一次逾時之後，新排序的下一頁接在舊的列後面')
if (!loadMorePassed || !timeoutPassed) process.exit(1)
console.log('PASS: screener load more')
