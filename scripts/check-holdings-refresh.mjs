// 寫入帳本之後，畫面上依帳本算的數字都要換新（2026-11-07，使用者：「我希望更新交易的時候 連動數字也要重算 我想確保這件事情不出錯」）：
//   - 記一筆賣出：對話框關掉的時候總覽已經是新數字；讀過的報表頁再打開要重讀，不能拿快取
//   - 刪一檔持股的 10 秒內換到報表頁：換頁才送出 DELETE，報表頁讀到的是刪除前的帳本，刪除完成後要自己重讀（不管那一份已經回來還是還在路上）
//   - 刪帳戶、看全部帳戶：範圍沒變，各頁不會自己重讀，持股與報表要跟著換
// 數字怎麼算是業務中台的事，這支只驗網站有沒有在寫入之後重問：帳本是假的，寫入成功就換一版，回應帶著讀到的版本。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-holdings-refresh.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD；BASE= 換伺服器）
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const PERFORMANCE = '/api/core/holdings/performance'
const row = (symbol, quantity) => ({ symbol, quantity, costUnknownQuantity: 0, averageCost: 50, totalCost: quantity * 50, realizedProfitLoss: 0, close: 100, tradeDate: '2026-10-16', dayClose: 100, dayCloseTradeDate: '2026-10-16', previousClose: 98 })
const ledgers = {
  // 2330 與 2317 各 1,000 股、收盤 100：總市值 200,000
  1: [row('2330', 1000), row('2317', 1000)],
  // 賣掉 500 股 2330：150,000
  2: [row('2330', 500), row('2317', 1000)],
  // 再少一檔：50,000
  3: [row('2330', 500)]
}
const newState = () => ({
  version: 1,
  portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }, { id: 'p-b', name: '國泰', brokerCode: null, position: 1, createdAt: '2026-10-01T00:00:00Z' }],
  performanceReads: 0,
  // 這幾毫秒之後才回；回應是收到請求當下的帳本
  performanceDelay: 0,
  deleteDelay: 0,
  blocked: []
})
// 報表的內容這支不看：twr 是 null 時頁面寫「這段期間沒有持股」
const performanceBody = version => ({ from: '2026-01-01', to: '2026-10-16', returnBasis: 'price', twr: null, mwr: null, benchmarkReturn: null, annualized: { twr: null, mwr: null }, series: [], periodReturns: [], version })

const stub = (ctx, state) => ctx.route('**/*', async (route) => {
  const request = route.request()
  const { pathname: path } = new URL(request.url())
  const method = request.method()
  if (path === '/api/core/portfolios' && method === 'GET') return route.fulfill({ json: { portfolios: state.portfolios } })
  if (path === '/api/core/holdings' && method === 'GET') return route.fulfill({ json: { holdings: ledgers[state.version] } })
  if (path === PERFORMANCE && method === 'GET') {
    state.performanceReads++
    const body = performanceBody(state.version)
    await wait(state.performanceDelay)
    return route.fulfill({ json: body })
  }
  if (path === '/api/core/transactions' && method === 'POST') {
    state.version = 2
    return route.fulfill({ json: { transaction: { id: 't-1' } } })
  }
  if ((path === '/api/core/holdings/2317' || path === '/api/core/portfolios/p-b') && method === 'DELETE') {
    await wait(state.deleteDelay)
    state.version = 3
    return route.fulfill({ status: 204 })
  }
  if (method === 'GET' || /identitytoolkit|securetoken|\/screener\/values/.test(request.url())) return route.continue()
  state.blocked.push(`${method} ${path}`)
  return route.abort()
})

const browser = await chromium.launch()
const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await stub(loginContext, newState())
const login = await loginContext.newPage()
await login.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await login.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
await login.waitForTimeout(500)
await login.locator('button[title="登入"]:visible').first().click()
const ui = login.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL)
await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD)
await ui.locator('.firebaseui-id-submit').click()
await login.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
const storageState = await loginContext.storageState({ indexedDB: true })
await loginContext.close()

const open = async (state) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(ctx, state)
  const page = await ctx.newPage()
  await page.goto(`${base}/holdings`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.holdings-page__overview').waitFor({ state: 'visible', timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.app-skeleton'), null, { timeout: 60000 })
  await page.waitForTimeout(500)
  return { ctx, page }
}
const go = (page, path) => page.evaluate(target => window.useNuxtApp().$router.push(target), path)
const marketValue = page => page.locator('.holdings-overview__hero dd').first().innerText()

console.log('記一筆賣出')
{
  const state = newState()
  const { ctx, page } = await open(state)
  check((await marketValue(page)).includes('200,000'), `一開始總市值 200,000（${await marketValue(page)}）`)
  await go(page, '/holdings/performance')
  await page.waitForTimeout(1500)
  check(state.performanceReads === 1, `報表讀過一次（${state.performanceReads}）`)
  await go(page, '/holdings')
  await page.locator('.holdings-page__overview').waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: '記一筆交易' }).first().click()
  const dialog = page.getByRole('dialog', { name: '記一筆交易' })
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByPlaceholder('代號或名稱，例如 2330').fill('2330')
  await page.locator('.el-autocomplete-suggestion li:visible').first().click()
  await dialog.getByText('賣出', { exact: true }).click()
  await dialog.getByLabel('股數（股）').fill('500')
  await dialog.getByLabel('成交價（元／股）').fill('100')
  await dialog.getByRole('button', { name: '儲存' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 15000 })
  check((await marketValue(page)).includes('150,000'), `對話框關掉時總市值已經是 150,000（${await marketValue(page)}）`)

  await go(page, '/holdings/performance')
  await page.waitForTimeout(1500)
  check(state.performanceReads === 2, `讀過的報表重讀，不拿快取（${state.performanceReads}）`)
  check(state.blocked.length === 0, `沒有意料外的寫入（${state.blocked.join('、')}）`)
  await ctx.close()
}

for (const [name, performanceDelay] of [['報表還在路上', 1500], ['報表已經回來', 0]]) {
  console.log(`刪一檔持股後馬上換頁：${name}`)
  const state = { ...newState(), version: 2, performanceDelay, deleteDelay: 600 }
  const { ctx, page } = await open(state)
  await page.getByRole('button', { name: /明細.*2317/ }).filter({ visible: true }).first().click()
  await page.getByRole('button', { name: /刪除這檔：.*2317/ }).filter({ visible: true }).first().click()
  await page.waitForTimeout(300)
  await go(page, '/holdings/performance')
  await page.waitForTimeout(4000)
  check(state.version === 3, '換頁送出了 DELETE')
  check(state.performanceReads >= 2, `刪除完成後重讀報表（${state.performanceReads} 次）`)
  await ctx.close()
}

console.log('刪帳戶、看全部帳戶')
{
  const state = { ...newState(), version: 2 }
  const { ctx, page } = await open(state)
  check((await marketValue(page)).includes('150,000'), `一開始總市值 150,000（${await marketValue(page)}）`)
  await go(page, '/holdings/accounts')
  await page.locator('.collection-manager__section').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /刪除「國泰」/ }).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)
  check(state.version === 3 || await page.locator('.el-message').count() > 0, '送出刪除或提示還開著')
  await go(page, '/holdings')
  await page.locator('.holdings-page__overview').waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1500)
  check(state.version === 3, '帳戶刪掉了')
  check((await marketValue(page)).includes('50,000') && !(await marketValue(page)).includes('150,000'), `回到持股，總市值是 50,000（${await marketValue(page)}）`)
  await ctx.close()
}

await browser.close()
if (failures) {
  console.log(`\n${failures} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
