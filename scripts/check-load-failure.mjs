// 讀取失敗提示的行為檢查（2026-10-11，使用者：「太容易跳出來了，而且也不會自關掉」）。對著跑著的 `pnpm run dev`：
//   node scripts/check-load-failure.mjs            （LOAD_FAILURE_URL／LOAD_FAILURE_WIDTH 可覆寫）
// 只能攔瀏覽器發出的請求，所以每個情境挑的都是瀏覽器端的讀取：個股子頁「客戶端換頁」時的 /api/stock/…、
// ETF 專區掛上後才送的 POST /etf-screener、每頁都在瀏覽器抓的公司索引 GET /stocks。
// 時間點跟著 LOAD_FAILURE_GRACE_MS（8 秒）與第一次退避（5 秒）走，改了那兩個要一起改這裡。
import { chromium } from 'playwright'

const baseUrl = process.env.LOAD_FAILURE_URL ?? 'http://localhost:3000'
const width = Number(process.env.LOAD_FAILURE_WIDTH ?? 1440)
const GRACE_MS = 8_000

const browser = await chromium.launch()
const failures = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const fail502 = route => route.fulfill({ status: 502, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Bad Gateway', status: 502 }) })

async function scenario(name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const dialog = page.getByRole('dialog', { name: '資料暫時讀不到' })
  const notice = page.locator('.load-failure-notice')
  try {
    await run({ page, dialog, notice })
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push(name)
    console.log(`FAIL ${name}: ${error.message}`)
  } finally {
    await context.close()
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

// 客戶端換頁：伺服器端已渲染的頁面不會再打一次，換頁才會從瀏覽器送 /api/stock/…
async function clientNavigate(page, path) {
  await page.evaluate(target => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(target), path)
}

async function openStock(page) {
  await page.goto(`${baseUrl}/stock/2330`, { waitUntil: 'networkidle', timeout: 120_000 })
}

await scenario('一次 502 後恢復：寬限期內默默重試，什麼都不顯示', async ({ page, dialog, notice }) => {
  await openStock(page)
  let hits = 0
  await page.route('**/api/stock/2330/dupont', route => (++hits === 1 ? fail502(route) : route.continue()))
  await clientNavigate(page, '/stock/2330/dupont')
  await wait(GRACE_MS + 4_000)
  expect(hits >= 2, `沒有重試（請求 ${hits} 次）`)
  expect(!(await dialog.isVisible()) && !(await notice.isVisible()), '出現了提示')
})

await scenario('主要資料持續 502：寬限期後才開彈窗，恢復後自己關', async ({ page, dialog }) => {
  await openStock(page)
  await page.route('**/api/stock/2330/dupont', fail502)
  await clientNavigate(page, '/stock/2330/dupont')
  await wait(GRACE_MS - 3_000)
  expect(!(await dialog.isVisible()), '寬限期內就開了彈窗')
  await dialog.waitFor({ state: 'visible', timeout: 8_000 })
  await page.unroute('**/api/stock/2330/dupont')
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 })
})

await scenario('次要資料持續失敗：只有右下角提示，不開阻斷彈窗', async ({ page, dialog, notice }) => {
  // 公司索引三個來源（上市櫃、特別股、ETF）全掛才算讀不到；只掛一個是設計上的降級，不報
  await page.route(url => ['/api/core/stocks', '/api/core/stocks/preferred-stocks', '/api/core/etf-screener'].includes(url.pathname), fail502)
  await openStock(page)
  await notice.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
  expect(!(await dialog.isVisible()), '次要資料開了阻斷彈窗')
  expect((await notice.getAttribute('role')) === 'status', '提示沒有 role="status"')
  await notice.getByRole('button', { name: '關閉讀取失敗提示' }).click()
  await notice.waitFor({ state: 'hidden', timeout: 2_000 })
})

await scenario('首次載入就失敗：彈窗有倒數、會自動重試，恢復後自己關', async ({ page, dialog }) => {
  let hits = 0
  const etfScreener = url => url.pathname === '/api/core/etf-screener'
  await page.route(etfScreener, (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    hits += 1
    return fail502(route)
  })
  await page.goto(`${baseUrl}/etf-zone`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 15_000 })
  const before = await dialog.locator('.load-failure__status').innerText()
  expect(/秒後/.test(before), `沒有倒數：${before}`)
  await wait(2_000)
  const after = await dialog.locator('.load-failure__status').innerText()
  expect(before !== after, `倒數沒在走：${after}`)
  const hitsAtOpen = hits
  await wait(7_000)
  expect(hits > hitsAtOpen, '彈窗開著之後沒有自動重試')
  await page.unroute(etfScreener)
  await dialog.waitFor({ state: 'hidden', timeout: 30_000 })
})

await scenario('不存在的代號（4xx）：頁面自己說，不開彈窗', async ({ page, dialog, notice }) => {
  await page.goto(`${baseUrl}/stock/abcd`, { waitUntil: 'networkidle', timeout: 120_000 })
  await wait(GRACE_MS + 4_000)
  expect(!(await dialog.isVisible()) && !(await notice.isVisible()), '出現了讀取失敗提示')
})

await scenario('先關閉：同一批不再彈出，新的主要資料失敗才再開', async ({ page, dialog }) => {
  await openStock(page)
  await page.route('**/api/stock/2330/dupont', fail502)
  await clientNavigate(page, '/stock/2330/dupont')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
  await dialog.getByRole('button', { name: '先關閉' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 2_000 })
  // 期間背景照樣重試（第一次退避 5 秒），同一批失敗不該再開
  await wait(8_000)
  expect(!(await dialog.isVisible()), '同一批失敗又彈出來')
  await page.route('**/api/stock/2330/margins', fail502)
  await clientNavigate(page, '/stock/2330/margins')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
})

await browser.close()
console.log(failures.length ? `\n${failures.length} 個情境失敗` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
