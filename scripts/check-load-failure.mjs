// 讀取失敗提示的行為檢查（2026-10-11，使用者：「太容易跳出來了，而且也不會自關掉」）。對著跑著的 `pnpm run dev`：
//   node scripts/check-load-failure.mjs            （LOAD_FAILURE_URL／LOAD_FAILURE_WIDTH 可覆寫）
// 只能攔瀏覽器發出的請求，所以每個情境挑的都是瀏覽器端的讀取：個股子頁「客戶端換頁」時的 /api/stock/…、
// ETF 專區掛上後才送的 POST /etf-screener、每頁都在瀏覽器抓的公司索引 GET /securities；連不上伺服器的橫幅是假造 /api/system-health。
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
  // 公司索引 2026-10-16 起只有 GET /securities 一個來源（useCompanyIndex；原本是三個，這裡沒跟著改，之後這個情境一直是假失敗）
  await page.route(url => url.pathname === '/api/cached/securities', fail502)
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
  await page.goto(`${baseUrl}/screener/etf`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
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

// 連不上伺服器的橫幅（AppSystemHealthBanner，2026-10-21）：第一次健康檢查在 onNuxtReady 之後，橫幅永遠比元件晚出現——原本在
// onMounted 量高度，從來沒量到，橫幅一直蓋住頁面最上面。對比也量：字 ≥ 4.5:1、底線對頁面底 ≥ 3:1（原本深色模式的字只有 3.06:1）
const luminance = color => color.match(/\d+/g).slice(0, 3).map(value => value / 255)
  .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

await scenario('連不上伺服器的橫幅：晚出現也把頁面往下推、淺深色都夠對比，關掉後收回', async ({ page }) => {
  let ok = true
  await page.route('**/api/system-health**', route => route.fulfill({ json: { ok } }))
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 120_000 })
  ok = false
  // 不等 30 秒的輪詢：分頁回到前景會立刻重查
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const banner = page.locator('.app-system-health-banner')
  await banner.waitFor({ state: 'visible', timeout: 10_000 })
  for (const [viewportWidth, dark] of [[width, false], [width, true], [375, false]]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 })
    await page.evaluate(isDark => document.documentElement.classList.toggle('dark', isDark), dark)
    await wait(300)
    const seen = await page.evaluate(() => {
      const box = document.querySelector('.app-system-health-banner')
      const style = getComputedStyle(box)
      return { bannerBottom: box.getBoundingClientRect().bottom, h1Top: document.querySelector('main h1').getBoundingClientRect().top, text: style.color, fill: style.backgroundColor, line: style.borderBottomColor, pageFill: getComputedStyle(document.body).backgroundColor }
    })
    const where = `${viewportWidth}${dark ? ' 深色' : ''}`
    expect(seen.h1Top >= seen.bannerBottom, `${where}：橫幅蓋住標題（h1 ${seen.h1Top}、橫幅底 ${seen.bannerBottom}）`)
    expect(contrast(seen.text, seen.fill) >= 4.5, `${where}：字對橫幅底 ${contrast(seen.text, seen.fill).toFixed(2)}:1`)
    expect(contrast(seen.line, seen.pageFill) >= 3, `${where}：底線對頁面底 ${contrast(seen.line, seen.pageFill).toFixed(2)}:1`)
  }
  await banner.getByRole('button', { name: '關閉' }).click()
  await banner.waitFor({ state: 'hidden', timeout: 2_000 })
  const height = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-banner-height').trim())
  expect(height === '0px', `關掉後 --app-banner-height 是 ${height}`)
})

await browser.close()
console.log(failures.length ? `\n${failures.length} 個情境失敗` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
