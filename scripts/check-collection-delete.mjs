// 帳戶管理（/holdings/accounts）、清單管理（/watchlist/lists）的刪除（SharedCollectionManager，2026-10-22，使用者：「已刪除「媽媽的帳戶」和它的所有交易
// 但是sidebar沒有馬上刪掉。我認為應馬上刪掉，用戶點選還原再還原」）：
// 刪除時清單與側欄要馬上少一個；按「復原」放回原位；10 秒後才真的送刪除；刪除失敗也放回去。
// 假資料（同 check-reload-flash）：兩個帳戶、兩份清單；DELETE 在瀏覽器裡就回應（成功或失敗），其他寫入一律擋下，不碰測試帳號的資料
import { chromium } from 'playwright'

// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-collection-delete.mjs（要 A11Y_TEST_EMAIL／PASSWORD）
const base = process.env.COLLECTION_DELETE_URL ?? 'http://localhost:3000'
const STUBS = {
  '/api/core/portfolios': { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }, { id: 'p-b', name: '國泰', brokerCode: null, position: 1, createdAt: '2026-10-02T00:00:00Z' }] },
  '/api/core/holdings': { holdings: [] },
  '/api/core/watchlists': { watchlists: [{ id: 'w-a', name: '存股名單', sourceShareToken: null }, { id: 'w-b', name: '成長股', sourceShareToken: null }] },
  '/api/core/watchlist': { items: [] }
}
let deleteStatus = 204
const deletes = []
const stub = context => context.route('**/*', (route) => {
  const request = route.request()
  const path = new URL(request.url()).pathname
  if (request.method() === 'GET' && STUBS[path]) return route.fulfill({ json: STUBS[path] })
  if (request.method() === 'DELETE' && /^\/api\/core\/(portfolios|watchlists)\/[\w-]+$/.test(path)) {
    deletes.push(path)
    return route.fulfill({ status: deleteStatus, body: deleteStatus === 204 ? '' : '{"title":"Server Error","status":500}', contentType: 'application/problem+json' })
  }
  if (request.method() === 'GET' || /identitytoolkit|securetoken/.test(request.url())) return route.continue()
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
