// 全站載入時的版面位移（2026-10-18，使用者：「全面檢查頁面的加載彈跳行為」）。每一種頁面模板至少一頁，1440／375 兩種寬度各載一次，
// 加總不是使用者操作造成的 layout-shift（CLS 的原始值，不切 session window：任何一段彈跳都要看到），並列出是哪個元素、從哪裡移到哪裡。
//
// 只對打包過的伺服器有意義：pnpm dev 不內嵌元件樣式，會量到正式建置沒有的位移（記憶 project_lighthouse_dev_baseline），遇到 dev 直接停。
// CPU 放慢 4 倍（同 PSI 的機器），不然頁首這種小位移在第一次繪製前就結束、量不到。每頁先用 HTTP 暖機一次（Nitro 快取），量的是熱的伺服器。
//
// 用法：
//   pnpm build && PORT=3100 node --env-file=.env .output/server/index.mjs
//   node scripts/check-layout-shift.mjs
//   LAYOUT_SHIFT_ROUTES=/,/stock/2330 LAYOUT_SHIFT_WIDTHS=375 node scripts/check-layout-shift.mjs   只跑幾頁、幾種寬度
//   LAYOUT_SHIFT_REPORT=report.json   另存完整紀錄（每一段的元素與前後位置）
//   LAYOUT_SHIFT_LOGIN=1 node --env-file=.env scripts/check-layout-shift.mjs   登入後的會員頁（測試帳號，唯讀）
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { ALL_ROUTES } from './site-routes.mjs'

const baseUrl = process.env.LAYOUT_SHIFT_URL ?? 'http://localhost:3100'
const widths = (process.env.LAYOUT_SHIFT_WIDTHS ?? '1440,375').split(',').map(Number).filter(Boolean)
// 同 check-screener-consistency 的門檻：要抓得到頁首那種最小的一段（0.011）
const CLS_LIMIT = 0.005

// 登入模式（LAYOUT_SHIFT_LOGIN=1，帳密從 .env 的 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD 讀，用 node --env-file=.env 跑）：會員頁與會隨帳號
// 改變的頁面。登入狀態在瀏覽器的 IndexedDB，登入一次後連 IndexedDB 存下來（Playwright 1.51+），每次量測帶著它開新分頁。
// 全程擋寫入：除了登入本身與公開的查詢 POST，非 GET 一律攔下，不寫進測試帳號
const login = process.env.LAYOUT_SHIFT_LOGIN === '1'
const MEMBER_ROUTES = ['/holdings', '/holdings/realized', '/holdings/dividends', '/holdings/columns', '/holdings/analysis', '/holdings/performance',
  '/holdings/statistics', '/holdings/risk', '/watchlist', '/profile', '/calendar', '/stock/2330', '/etf/0050', '/screener/common', '/screener/etf']
const READ_ONLY_POST = /identitytoolkit|securetoken|\/screener\/values|\/screener$|\/etf-screener$/
const filter = (process.env.LAYOUT_SHIFT_ROUTES ?? '').split(',').map(entry => entry.trim()).filter(Boolean)
const pool = login ? MEMBER_ROUTES : ALL_ROUTES
const routes = filter.length ? pool.filter(route => filter.includes(route)).concat(filter.filter(route => !pool.includes(route))) : pool

const isDevServer = (await (await fetch(baseUrl)).text()).includes('/@vite/client')
if (isDevServer) {
  console.error('這是 pnpm dev（不內嵌元件樣式），量出來的位移不準。請先 pnpm build，再用 PORT=3100 node --env-file=.env .output/server/index.mjs 開正式建置')
  process.exit(2)
}

// 暖機：Nitro 快取與上游的冷查詢不算在量測裡
for (const route of routes) await fetch(`${baseUrl}${route}`).catch(() => null)

const browser = await chromium.launch()
let blockedWrites = 0
const blockWrites = context => context.route('**/*', (route) => {
  const request = route.request()
  if (request.method() === 'GET' || READ_ONLY_POST.test(request.url().replace(/\?.*/, ''))) return route.continue()
  blockedWrites++
  return route.abort()
})
let storageState
if (login) {
  if (!process.env.A11Y_TEST_EMAIL || !process.env.A11Y_TEST_PASSWORD) {
    console.error('登入模式要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD：node --env-file=.env scripts/check-layout-shift.mjs')
    process.exit(2)
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await blockWrites(context)
  const page = await context.newPage()
  // 要等 hydration 完：SSR 的「登入」按鈕在那之前點了沒反應（同 check-a11y-pages 的 signIn）
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('button[title="登入"]').first().click()
  const ui = page.locator('#firebaseui-auth-container')
  await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
  await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL)
  await ui.locator('.firebaseui-id-submit').click()
  await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD)
  await ui.locator('.firebaseui-id-submit').click()
  await page.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
  await page.locator('.post-login-loader').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
  storageState = await context.storageState({ indexedDB: true })
  await context.close()
}

const results = []
for (const route of routes) {
  for (const width of widths) {
    const mobile = width < 768
    const context = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile, storageState })
    if (login) await blockWrites(context)
    const page = await context.newPage()
    await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(() => {
      window.__shifts = []
      // 元素描述：標籤＋id＋前兩個 class；文字節點往上找有 class 的祖先
      const describe = (node) => {
        let element = node
        while (element && element.nodeType !== 1) element = element.parentNode
        if (!element) return '(removed)'
        let target = element
        while (target && !target.className && target.parentElement) target = target.parentElement
        const classes = typeof target.className === 'string' ? target.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''
        return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${classes ? `.${classes}` : ''}`
      }
      const rect = r => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue
          window.__shifts.push({
            value: entry.value,
            at: Math.round(entry.startTime),
            sources: entry.sources.map(source => ({ node: describe(source.node), from: rect(source.previousRect), to: rect(source.currentRect) }))
          })
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let shifts = []
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 180000 })
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
      // 瀏覽器端才抓的資料（server: false 的圖、型錄）晚到的那一段也要算
      await page.waitForTimeout(3000)
      shifts = await page.evaluate(() => window.__shifts)
    } catch (error) {
      errors.push(`load: ${error.message.split('\n')[0]}`)
    }
    const total = shifts.reduce((sum, shift) => sum + shift.value, 0)
    results.push({ route, width, total, shifts, errors })
    const top = [...shifts].sort((a, b) => b.value - a.value).slice(0, 3)
      .map(shift => `${shift.value.toFixed(3)}@${shift.at}ms ${shift.sources.slice(0, 2).map(source => `${source.node} ${source.from}→${source.to}`).join(' + ')}`)
    console.log(`${total > CLS_LIMIT ? 'FAIL' : 'ok  '} ${total.toFixed(3)} ${String(width).padStart(4)} ${route}${top.length ? `\n       ${top.join('\n       ')}` : ''}${errors.length ? `\n       errors: ${errors.join(' | ').slice(0, 300)}` : ''}`)
    await context.close()
  }
}
await browser.close()

if (process.env.LAYOUT_SHIFT_REPORT) writeFileSync(process.env.LAYOUT_SHIFT_REPORT, JSON.stringify(results, null, 2))
const failed = results.filter(result => result.total > CLS_LIMIT)
console.log(`\n${results.length} 次載入，${failed.length} 次超過 ${CLS_LIMIT}${login ? `；登入模式擋下 ${blockedWrites} 次寫入` : ''}`)
for (const result of [...failed].sort((a, b) => b.total - a.total)) console.log(`  ${result.total.toFixed(3)} ${result.width} ${result.route}`)
process.exitCode = failed.length ? 1 : 0
