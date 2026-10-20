// 會員頁重新整理時的閃動（2026-10-20，使用者：「holdings/analysis 重新整理還是有閃一下」「像是卡片的部分顯示閃動」「好像其他畫面也有」）。
// check-layout-shift 量不到兩種情況：一是沒有位移的換畫面（v-loading 的白色遮罩淡入、轉圈換手、先寫「還沒有…」再換成內容），二是有內容時
// 的樣子——它登入的測試帳號沒有持股、清單也是空的。這支用假資料（一個帳戶、六檔持股、持股特色、一組六檔的觀察清單；報價是真的公開讀取），
// 每頁重新整理一次，從伺服器的第一個畫面看到內容出來，驗：
//   - 第一個畫面就是佔位（伺服器畫的轉圈），不是訪客卡或空狀態
//   - 沒有出現過 v-loading 的遮罩（.el-loading-mask）
//   - 佔位只有伺服器畫的那一個：之後沒有再加新的 .app-loading-placeholder（換手、hydration 對不上都會加）
//   - 中間狀態的字一次都沒出現；最後有畫出內容（假資料沒接上時不能空過）
// 寫入一律擋下。Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-reload-flash.mjs（BASE= 換伺服器）
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
// 頁面 → 內容出來的記號
const ROUTES = {
  '/holdings': '.holdings-page__overview',
  '/holdings/analysis': '.holdings-traits__panel',
  '/holdings/columns': '.formula-bar',
  '/holdings/risk': '.risk-page__body',
  '/watchlist': '.watchlist-page__count',
  '/watchlist/lists': '.collection-manager__section'
}
const INTERIM = ['還沒有記錄任何持股', '還沒有追蹤任何股票', '產業分類載入中', '目前沒有報價']

const trait = value => ({ value, coverage: '1.000000' })
const TRAITS = { asOf: '2026-10-16', portfolio: { peRatio: trait('14.2'), dividendYield: trait('5.1'), roe: trait('12.3'), beta: trait('0.7'), top3HoldingsPct: trait('60.00') }, market: null }
const SYMBOLS = ['2330', '2317', '2412', '2884', '1216', '0056']
const HOLDINGS = SYMBOLS.map(symbol => ({ symbol, quantity: 1000, costUnknownQuantity: 0, averageCost: '50', totalCost: '50000', realizedProfitLoss: '0' }))
const STUBS = {
  '/api/core/portfolios': { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] },
  '/api/core/holdings': { holdings: HOLDINGS },
  '/api/core/holdings/traits': TRAITS,
  '/api/core/watchlists': { watchlists: [{ id: 'w-a', name: '存股名單', sourceShareToken: null }] },
  '/api/core/watchlist': { items: SYMBOLS.map((symbol, index) => ({ id: `i${index}`, watchlistId: 'w-a', symbol, note: null })) }
}
const blocked = []
const stub = context => context.route('**/*', (route) => {
  const request = route.request()
  const path = new URL(request.url()).pathname
  if (request.method() === 'GET' && STUBS[path]) return route.fulfill({ json: STUBS[path] })
  if (request.method() === 'GET' || /identitytoolkit|securetoken|\/screener\/values/.test(request.url())) return route.continue()
  blocked.push(`${request.method()} ${path}`)
  return route.abort()
})

let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const browser = await chromium.launch()
const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await stub(loginContext)
const login = await loginContext.newPage()
await login.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await login.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }).catch(() => {})
await login.waitForTimeout(500)
await login.locator('button[title="登入"]').first().click()
const ui = login.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL)
await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD)
await ui.locator('.firebaseui-id-submit').click()
await login.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
const storageState = await loginContext.storageState({ indexedDB: true })
await loginContext.close()

for (const [route, marker] of Object.entries(ROUTES)) {
  console.log(route)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(context)
  const page = await context.newPage()
  await page.addInitScript((interim) => {
    const seen = { first: null, masks: 0, placeholders: 0, interim: new Set() }
    window.__flash = seen
    // 伺服器的 HTML 解析完之後才算「瀏覽器加的」
    new MutationObserver((records) => {
      if (document.readyState === 'loading') return
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue
        if (node.matches('.el-loading-mask') || node.querySelector('.el-loading-mask')) seen.masks++
        if (node.matches('.app-loading-placeholder') || node.querySelector('.app-loading-placeholder')) seen.placeholders++
      }
    }).observe(document, { childList: true, subtree: true })
    const tick = () => {
      const container = document.querySelector('.holdings-shell, .watchlist-page, .app-page')
      if (container) {
        seen.first ??= !!container.querySelector('.app-loading-placeholder')
        for (const text of interim) if (container.innerText.includes(text)) seen.interim.add(text)
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, INTERIM)
  // 先開一次（暖快取），量的是重新整理
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.reload({ waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForTimeout(2000)
  const seen = await page.evaluate(() => ({ ...window.__flash, interim: [...window.__flash.interim] }))
  check(seen.first === true, '第一個畫面是佔位')
  check(seen.masks === 0, `沒有 v-loading 遮罩（${seen.masks}）`)
  check(seen.placeholders === 0, `佔位沒有換手（瀏覽器加了 ${seen.placeholders} 個）`)
  check(seen.interim.length === 0, `沒有中間狀態的字（${seen.interim.join('、') || '無'}）`)
  check(await page.locator(marker).count() > 0 && await page.locator('.app-loading-placeholder').count() === 0, `內容畫出來了（${marker}）`)
  await context.close()
}

// 等資料到齊的閘門不能讓側欄切頁也轉圈：持股、特色、產業分類都讀過了，切回持股分析時一個轉圈的畫面都不該畫出來（rAF 時還在＝會畫出來）
console.log('側欄切回讀過的持股分析')
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
await stub(context)
const page = await context.newPage()
await page.goto(`${base}/holdings/analysis`, { waitUntil: 'networkidle', timeout: 180000 })
await page.locator('.holdings-traits__panel').waitFor({ timeout: 30000 })
await page.locator('a[href="/holdings"]:visible').first().click()
await page.locator('.holdings-page__overview').waitFor({ timeout: 30000 })
await page.evaluate(() => {
  window.__spinnerFrames = 0
  const tick = () => { if (document.querySelector('.app-loading-placeholder')) window.__spinnerFrames++; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
await page.locator('a[href="/holdings/analysis"]:visible').first().click()
await page.locator('.holdings-traits__panel').waitFor({ timeout: 30000 })
await page.waitForTimeout(500)
const spinnerFrames = await page.evaluate(() => window.__spinnerFrames)
check(spinnerFrames === 0, `沒有畫出轉圈（${spinnerFrames} 個畫面）`)
await context.close()
await browser.close()

console.log(`被擋下的寫入： ${JSON.stringify(blocked)}`)
console.log(failures ? `\n${failures} 項失敗` : '\n全部通過')
process.exitCode = failures ? 1 : 0
