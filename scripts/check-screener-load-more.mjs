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
await browser.close()

const passed = sentinelSeen && pages[0] === 1 && after > before
console.log(`查詢的頁碼 ${JSON.stringify(pages)}，列數 ${before} → ${after}，哨兵${sentinelSeen ? '有' : '沒有'}進畫面`)
if (!passed) {
  console.log('FAIL: 查詢途中捲到底，查完沒有載下一頁')
  process.exit(1)
}
console.log('PASS: screener load more')
