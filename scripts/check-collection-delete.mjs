// 帳戶管理（/holdings/accounts）、清單管理（/watchlist/lists）的刪除（SharedCollectionManager，2026-10-22，使用者：「已刪除「媽媽的帳戶」和它的所有交易
// 但是sidebar沒有馬上刪掉。我認為應馬上刪掉，用戶點選還原再還原」）：
// 刪除時清單與側欄要馬上少一個；按「復原」放回原位；10 秒後才真的送刪除；刪除失敗也放回去。
// 復原期間就寫入（2026-11-11，使用者：「我把觀察清單都清空了 可是想要新增觀察清單的個股時 跳出了 觀察清單已達免費版的上限」）：還沒送出的刪除
// 要先送完再送新增（undo-toast.ts 的 commitUndoToasts），業務中台還算著它們。觀察清單 10 檔（免費版上限）全部移除後馬上加一檔、刪掉一組清單
// 或一個帳戶後馬上新增一組
// 假資料（同 check-reload-flash）：兩個帳戶、兩份清單；刪除與新增在瀏覽器裡就回應（新增照額度數伺服器上還有幾檔），報價讀本機業務中台，
// 其他寫入一律擋下，不碰測試帳號的資料
import { chromium } from 'playwright'

// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-collection-delete.mjs（要 A11Y_TEST_EMAIL／PASSWORD）
const base = process.env.COLLECTION_DELETE_URL ?? 'http://localhost:3000'
const STUBS = {
  '/api/core/portfolios': { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }, { id: 'p-b', name: '國泰', brokerCode: null, position: 1, createdAt: '2026-10-02T00:00:00Z' }] },
  '/api/core/holdings': { holdings: [] },
  '/api/core/watchlists': { watchlists: [{ id: 'w-a', name: '存股名單', sourceShareToken: null }, { id: 'w-b', name: '成長股', sourceShareToken: null }] },
  '/api/core/billing/entitlement': { tier: 'FREE', source: 'none', status: null, currentPeriodEnd: null, trialEndsAt: null, renewalMode: null, quotas: { watchlistItems: 10, watchlists: 3, portfolios: 3, customHoldingColumns: 10, screenerPresets: 3, columnPresets: 3 }, usage: {} }
}
const ITEM_LIMIT = 10
const TEN = ['2330', '2317', '2454', '2412', '1301', '1303', '2882', '2881', '2886', '2891']
// 伺服器上的觀察清單項目；writes 記瀏覽器送出寫入的先後
let serverItems = []
const writes = []
let deleteStatus = 204
const deletes = []
const stub = context => context.route('**/*', (route) => {
  const request = route.request()
  const path = new URL(request.url()).pathname
  const method = request.method()
  if (method === 'GET' && STUBS[path]) return route.fulfill({ json: STUBS[path] })
  if (method === 'GET' && path === '/api/core/watchlist') return route.fulfill({ json: { items: serverItems } })
  if (method === 'DELETE' && /^\/api\/core\/(portfolios|watchlists)\/[\w-]+$/.test(path)) {
    deletes.push(path)
    writes.push(`DELETE ${path}`)
    return route.fulfill({ status: deleteStatus, body: deleteStatus === 204 ? '' : '{"title":"Server Error","status":500}', contentType: 'application/problem+json' })
  }
  if (method === 'DELETE' && path.startsWith('/api/core/watchlist/')) {
    writes.push(`DELETE ${path}`)
    serverItems = serverItems.filter(item => `/api/core/watchlist/${item.id}` !== path)
    return route.fulfill({ status: 204, body: '' })
  }
  if (method === 'POST' && path === '/api/core/watchlist') {
    writes.push(`POST ${path}`)
    if (serverItems.length >= ITEM_LIMIT) return route.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Forbidden', status: 403, code: 'quota_exceeded' }) })
    const { watchlistId, symbol } = JSON.parse(request.postData() ?? '{}')
    const item = { id: `i-new-${symbol}`, watchlistId, symbol, note: null, createdAt: 'x', updatedAt: 'y' }
    serverItems = [...serverItems, item]
    return route.fulfill({ status: 201, json: { item } })
  }
  if (method === 'POST' && (path === '/api/core/watchlists' || path === '/api/core/portfolios')) {
    writes.push(`POST ${path}`)
    const { name } = JSON.parse(request.postData() ?? '{}')
    return route.fulfill({ status: 201, json: path.endsWith('watchlists') ? { watchlist: { id: 'w-new', name, sourceShareToken: null } } : { portfolio: { id: 'p-new', name, brokerCode: null } } })
  }
  if (method === 'GET' || path === '/api/core/screener/values' || path === '/api/core/etf-screener' || /identitytoolkit|securetoken/.test(request.url())) return route.continue()
  return route.abort()
})

let failures = 0
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `（${detail}）` : ''}`); if (!ok) failures++ }

const browser = await chromium.launch()
const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await stub(loginContext)
const login = await loginContext.newPage()
await login.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await login.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
await login.locator('button[title="登入"]:visible').first().click()
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

async function scenario(path, name, sidebarHas) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(context)
  const page = await context.newPage()
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.collection-manager__row', { hasText: name }).first().waitFor({ timeout: 30000 })
  const managerHas = async () => (await page.locator('.collection-manager__row', { hasText: name }).count()) > 0
  check(await sidebarHas(page, name), `${path} 一開始側欄有「${name}」`)
  await page.getByRole('button', { name: new RegExp(`^刪除「${name}」`) }).click()
  await page.mouse.move(5, 890)
  await page.evaluate(() => (document.activeElement)?.blur?.())
  await page.waitForTimeout(400)
  check(!(await managerHas()) && !(await sidebarHas(page, name)), `${path} 按刪除後，清單與側欄馬上都沒有「${name}」`)
  await page.getByRole('button', { name: '復原' }).click()
  await page.waitForTimeout(400)
  check((await managerHas()) && (await sidebarHas(page, name)), `${path} 按復原後，清單與側欄都回來了`)
  const before = deletes.length
  await page.getByRole('button', { name: new RegExp(`^刪除「${name}」`) }).click()
  await page.mouse.move(5, 890)
  await page.evaluate(() => (document.activeElement)?.blur?.())
  await page.waitForTimeout(3000)
  check(deletes.length === before, `${path} 3 秒時還沒送出刪除`)
  await page.waitForTimeout(9000)
  check(deletes.length === before + 1, `${path} 10 秒後送出一次刪除`, deletes.slice(before).join(' '))
  check(!(await managerHas()) && !(await sidebarHas(page, name)), `${path} 刪掉之後沒有回來`)
  await context.close()
}

const accountInSidebar = async (page, name) => (await page.locator('.scope-switch__item', { hasText: name }).count()) > 0
const listInSidebar = async (page, name) => (await page.locator('.rail-item', { hasText: name }).count()) > 0

await scenario('/holdings/accounts', '國泰', accountInSidebar)
await scenario('/watchlist/lists', '成長股', listInSidebar)

// 刪掉一組、提示還開著就新增一組：刪除先送出（舊版先送新增，刪除 10 秒後才送，業務中台那時還算著被刪的那一組）
async function deleteThenAdd(path, name, newName) {
  writes.length = 0
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(context)
  const page = await context.newPage()
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.collection-manager__row', { hasText: name }).first().waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: new RegExp(`^刪除「${name}」`) }).click()
  await page.locator('.collection-manager__new input').fill(newName)
  await page.locator('.collection-manager__new input').press('Enter')
  await page.waitForTimeout(1500)
  const deleted = writes.findIndex(line => line.startsWith('DELETE'))
  const created = writes.findIndex(line => line.startsWith('POST'))
  check(deleted >= 0 && created > deleted, `${path} 刪除還在復原期間就新增：先送出刪除，再新增`, writes.join(' → '))
  await context.close()
}
await deleteThenAdd('/holdings/accounts', '國泰', '新帳戶')
await deleteThenAdd('/watchlist/lists', '成長股', '新清單')

// 使用者回報的那一條：免費版 10 檔全部移除，提示還開著就加一檔
{
  serverItems = TEN.map(symbol => ({ id: `i-${symbol}`, watchlistId: 'w-a', symbol, note: null, createdAt: 'x', updatedAt: 'y' }))
  writes.length = 0
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(context)
  const page = await context.newPage()
  await page.goto(`${base}/watchlist?list=w-a`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => document.querySelector('button.watchlist-page__edit:not([disabled])'), null, { timeout: 60000 })
  await page.locator('button.watchlist-page__edit').click()
  const removeButtons = page.getByRole('button', { name: /^從觀察清單移除/ })
  await removeButtons.first().waitFor({ timeout: 30000 })
  // 疊起來的提示會蓋住表格，直接對按鈕送 click
  for (let index = 0; index < TEN.length; index++) await removeButtons.first().dispatchEvent('click')
  const input = page.locator('.watchlist-page__add input')
  await input.fill('2603')
  await page.locator('.el-autocomplete-suggestion li', { hasText: '2603' }).first().waitFor({ state: 'attached', timeout: 30000 })
  await input.press('Enter')
  await page.waitForTimeout(2500)
  const firstPost = writes.indexOf('POST /api/core/watchlist')
  const removedBefore = writes.slice(0, firstPost).filter(line => line.startsWith('DELETE /api/core/watchlist/')).length
  check(firstPost >= 0 && removedBefore === TEN.length, '/watchlist 10 檔全部移除後馬上加一檔：10 個移除先送出，再送新增', writes.join(' → '))
  check(!(await page.locator('.quota-dialog__title').isVisible()), '/watchlist 沒有跳出「觀察清單已達免費版的上限」')
  check(serverItems.length === 1 && serverItems[0].symbol === '2603', '/watchlist 伺服器上只剩新加的 2603', serverItems.map(item => item.symbol).join(','))
  const rows = await removeButtons.count()
  check(rows === 1, '/watchlist 畫面上只有新加的那一檔，移除的沒有被重抓回來', `${rows} 列`)
  await context.close()
}

// 伺服器刪除失敗：放回去
deleteStatus = 500
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await stub(context)
  const page = await context.newPage()
  await page.goto(`${base}/holdings/accounts`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.collection-manager__row', { hasText: '國泰' }).first().waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: /^刪除「國泰」/ }).click()
  await page.mouse.move(5, 890)
  await page.evaluate(() => (document.activeElement)?.blur?.())
  await page.waitForTimeout(12000)
  check((await page.locator('.collection-manager__row', { hasText: '國泰' }).count()) > 0 && await accountInSidebar(page, '國泰'), '刪除失敗時「國泰」放回清單與側欄')
  await context.close()
}

await browser.close()
console.log(failures ? `\nFAIL ${failures}` : '\nPASS')
process.exit(failures ? 1 : 0)
