// 會員頁讀業務中台的資料（2026-10-30，使用者：「你不先驗完嗎」——拿掉 Go／TS 並存後，會員頁要用業務中台現在的格式驗過才推）。
// 登入測試帳號，把會員端點換成業務中台現在格式的假資料，逐頁確認那個數字真的畫出來（不是空白或「－」）：持股績效（逐月的 yearMonth、
// 走勢的 tradeDate）、績效統計的無風險利率（sourceYearMonth）、持股特色的大盤（benchmark）、配息（除息日 exDividendDate）、
// 持股分享頁的報酬率（returnPct 百分比）。持股績效用 scripts/fixtures/holdings 的合成資料。check-reload-flash 驗閃動，這支驗內容。
// 寫入一律擋下。Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-member-data.mjs（BASE= 換伺服器）
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
if (!process.env.A11Y_TEST_EMAIL || !process.env.A11Y_TEST_PASSWORD) throw new Error('要用 node --env-file=.env 跑（測試帳號的帳密在 .env）')
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/holdings/${name}.json`, import.meta.url), 'utf8'))

const performance = fixture('a-normal-1y.performance')
const trait = value => ({ value, coverage: '1.000000' })
const TRAITS = { asOf: '2026-10-16', portfolio: { peRatio: trait('14.2'), dividendYield: trait('5.1') }, benchmark: { peRatio: trait('17.84'), dividendYield: trait('2.9') } }
const SHARE_TOKEN = 'check-member-data-0001'
const STUBS = {
  '/api/core/portfolios': { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] },
  '/api/core/holdings': { holdings: ['2330', '2317', '0056'].map(symbol => ({ symbol, quantity: 1000, costUnknownQuantity: 0, averageCost: '50', totalCost: '50000', realizedProfitLoss: '0' })) },
  '/api/core/holdings/performance': performance,
  '/api/core/holdings/traits': TRAITS,
  '/api/core/holdings/dividends': {
    from: '2025-10-30', to: '2027-01-30', asOf: '2026-10-30',
    dividends: [{ symbol: '2330', exDividendDate: '2026-09-16', exRightsDate: null, paymentDate: '2026-10-09', status: 'paid', cashPerShare: 5, stockRatio: null, sharesHeld: 1000, sharesHeldIsEstimate: false, cashAmount: 5000, stockShares: null, fractionalShares: null }]
  },
  [`/api/core/public/shares/${SHARE_TOKEN}`]: { kind: 'holdings', displayName: '檢查用分享', columns: [{ key: 'pnlPct', label: '報酬率' }], asOf: '2026-10-29', holdings: [{ symbol: '2330', returnPct: '12.3456' }], traits: TRAITS }
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
const browser = await chromium.launch()

// 登入一次（同 check-reload-flash），之後每頁帶著登入狀態開新分頁
const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await stub(loginContext)
const login = await loginContext.newPage()
await login.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await login.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }).catch(() => {})
await login.locator('button[title="登入"]').first().click()
const ui = login.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL)
await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD)
await ui.locator('.firebaseui-id-submit').click()
await login.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
await loginContext.addCookies([{ name: 'analytics-consent', value: 'denied', url: base }])
const storageState = await loginContext.storageState({ indexedDB: true })
await loginContext.close()

// 頁面文字（含收合的 <details>）出現那幾段字才算過；{ cell } 要有一格表格的內容剛好是它
async function expectTexts(page, label, texts) {
  for (const text of texts) {
    const found = await page.waitForFunction(value => (typeof value === 'string'
      ? document.body.textContent.includes(value)
      : [...document.querySelectorAll('th, td')].some(cell => cell.textContent.trim() === value.cell)), text, { timeout: 30000 }).then(() => true, () => false)
    console.log(`  ${found ? 'PASS' : 'FAIL'}  ${label}：${typeof text === 'string' ? text : `表格有一格「${text.cell}」`}`)
    if (!found) failures++
  }
}

const monthly = performance.periodReturns.monthly[0]
const firstPoint = performance.series.find(point => point.cumulative !== null)
const rate = performance.riskFree.rates.at(-1)
const PAGES = [
  ['/holdings/performance', '逐月報酬的月份（yearMonth）、走勢起點（tradeDate）', [{ cell: monthly.yearMonth }, firstPoint.tradeDate]],
  ['/holdings/statistics', '無風險利率的月份（sourceYearMonth）', [`無風險利率：五大銀行一年期定存 ${rate.ratePct.toFixed(2)}%（${rate.sourceYearMonth}）`]],
  ['/holdings/analysis', '持股特色的大盤（benchmark）', ['17.84', '2.9%']],
  ['/holdings/dividends', '配息的除息日（exDividendDate → exDate＋exType，頁面寫成斜線）', ['2026/09/16 除息']]
]
for (const [route, label, texts] of PAGES) {
  console.log(route)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(context)
  const page = await context.newPage()
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 180000 })
  await expectTexts(page, label, texts)
  await context.close()
}

// 分享頁伺服器端取資料攔不到：先開別頁，再在瀏覽器裡換頁過去，這時才從瀏覽器抓
console.log(`/share/${SHARE_TOKEN}`)
const shareContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await stub(shareContext)
const share = await shareContext.newPage()
await share.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await share.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }).catch(() => {})
await share.evaluate(path => window.useNuxtApp().$router.push(path), `/share/${SHARE_TOKEN}`)
await expectTexts(share, '分享頁的報酬率（returnPct 12.3456 → +12.35%）、持股特色的大盤', ['+12.35%', '17.84'])
await shareContext.close()

await browser.close()
if (blocked.length) console.log(`擋下的寫入：${[...new Set(blocked)].join('、')}`)
console.log(failures ? `FAIL: ${failures} 項沒畫出來` : 'PASS: member data')
process.exit(failures ? 1 : 0)
