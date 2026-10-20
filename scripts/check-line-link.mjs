// 綁定 LINE（2026-10-20，使用者：「之前用 gmail 登入，現在用 Line 登入卻沒看到任何交易紀錄…該如何綁定？」，與業務中台共同設計）：
//   - 個人資料「登入方式」：lineLinked false 有「綁定 LINE」、true 寫「已綁定」；舊版 業務中台（沒有這欄）不顯示 LINE 那一列
//   - 按「綁定 LINE」導向 access.line.me：scope 是 openid profile（不拿 email，使用者決定不做 email 自動對應）、sessionStorage 記著 intent link
//   - 回呼頁的綁定那條：帶 Bearer 打 POST /auth/line/link、不打登入用的 /auth/line、uid 不變；成功回個人資料並提示；
//     409 line_already_linked／account_already_linked／line_account_has_data、400 line_account_cannot_link、401 reauth_required 各自說明
// LINE 與 業務中台 全部攔截（測試帳號沒有 LINE）；其他寫入一律擋下。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-line-link.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD；DIR=資料夾 會存截圖）
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const base = 'http://localhost:3000'
const dir = process.env.DIR
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const calls = []
const blocked = []
const mock = async (ctx, { lineLinked = false, linkResponse = { status: 200, json: { lineLinked: true } } } = {}) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (url.host === 'access.line.me') {
      calls.push(`LINE ${url.search}`)
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>LINE</title>' })
    }
    if (p === '/api/core/users/me' && m === 'GET') {
      return route.fulfill({ json: { user: { id: 'u-1', firebaseUid: 'x', email: null, displayName: null, createdAt: '2026-10-01T00:00:00Z', ...(lineLinked === 'absent' ? {} : { lineLinked }) } } })
    }
    if (p === '/api/core/auth/line/link' && m === 'POST') {
      calls.push(`LINK ${req.headers().authorization?.startsWith('Bearer ') ? 'bearer' : 'no-auth'} ${req.postData()}`)
      const { status, json } = linkResponse
      return route.fulfill({ status, contentType: status === 200 ? 'application/json' : 'application/problem+json', body: JSON.stringify(json) })
    }
    if (p === '/api/core/auth/line') {
      calls.push('LOGIN')
      return route.abort()
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    blocked.push(`${m} ${p}`)
    return route.abort()
  })
}

const browser = await chromium.launch()
const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await mock(loginCtx)
const lp = await loginCtx.newPage()
await lp.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await lp.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }); await lp.waitForTimeout(500)
await lp.locator('button[title="登入"]:visible').first().click()
const ui = lp.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL); await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD); await ui.locator('.firebaseui-id-submit').click()
await lp.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
const storageState = await loginCtx.storageState({ indexedDB: true })
await loginCtx.close()

const open = async (ctx, path) => {
  const page = await ctx.newPage()
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(1500)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  return page
}
const uidOf = page => page.evaluate(() => window.useNuxtApp().$firebaseAuth.currentUser?.uid ?? null)
const section = page => page.locator('section', { has: page.getByRole('heading', { name: '登入方式' }) })

console.log('個人資料「登入方式」')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx)
  const page = await open(ctx, '/profile')
  const methods = section(page)
  check(await methods.isVisible() && (await methods.innerText()).includes('電子郵件'), '有「登入方式」，列出電子郵件')
  const button = methods.getByRole('button', { name: '綁定 LINE' })
  check(await button.isVisible(), 'lineLinked false：LINE 那一列是「綁定 LINE」')
  await page.mouse.move(0, 0); await page.waitForTimeout(400)
  const violations = (await new AxeBuilder({ page }).include('.profile-page').analyze()).violations.map(v => `${v.id}(${v.nodes.length})`).join(',') || '0'
  check(violations === '0', `個人資料頁 axe 0（${violations}）`)
  if (dir) await methods.screenshot({ path: `${dir}/sign-in-methods.png` })
  // 剛登入（5 分鐘內）不用重新驗證，直接跳 LINE
  const uid = await uidOf(page)
  await button.click()
  await page.waitForURL(/access\.line\.me/, { timeout: 15000 })
  const authorize = new URL(page.url())
  check(authorize.searchParams.get('scope') === 'openid profile' && authorize.searchParams.get('redirect_uri') === `${base}/auth/line`, `導向 LINE：scope「${authorize.searchParams.get('scope')}」、redirect_uri 不變`)
  // 回到回呼頁（LINE 會帶 code 與同一個 state 回來）
  await page.goto(`${base}/auth/line?code=fake-code&state=${authorize.searchParams.get('state')}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForURL('**/profile', { timeout: 30000 }); await page.waitForTimeout(800)
  const link = calls.find(call => call.startsWith('LINK'))
  check(!!link && link.includes('bearer') && link.includes('"code":"fake-code"') && link.includes(`"redirectUri":"${base}/auth/line"`) && link.includes('"nonce"'), `綁定：帶 Bearer 打 /auth/line/link（${link?.slice(0, 60)}…）`)
  check(!calls.includes('LOGIN') && await uidOf(page) === uid, '沒有重新登入（沒打 /auth/line、uid 不變）')
  check(await page.locator('.el-message', { hasText: '已綁定 LINE' }).count() > 0, '回到個人資料，提示「已綁定 LINE」')
  await ctx.close()
}

console.log('已綁定／舊版業務中台')
// 'absent'：回應裡沒有這一欄（傳 undefined 會被參數預設值換成 false）
for (const [lineLinked, expected] of [[true, '已綁定'], ['absent', null]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, { lineLinked })
  const page = await open(ctx, '/profile')
  const text = await section(page).innerText()
  if (expected) check(text.includes('LINE') && text.includes(expected) && await section(page).getByRole('button', { name: '綁定 LINE' }).count() === 0, 'lineLinked true：寫「已綁定」、沒有按鈕')
  else check(!text.includes('LINE'), '舊版 業務中台（沒有 lineLinked）：不顯示 LINE 那一列')
  await ctx.close()
}

console.log('綁定失敗的說明')
const problem = (status, code) => ({ status, json: { type: 'about:blank', title: 'x', status, code } })
for (const [response, expected] of [
  [problem(409, 'line_already_linked'), '已經綁在另一個帳號上'],
  [problem(409, 'account_already_linked'), '已經綁了另一個 LINE'],
  [problem(400, 'line_account_cannot_link'), '請先改用 Google 或電子郵件'],
  [problem(409, 'line_account_has_data'), '沒辦法合併'],
  [problem(401, 'reauth_required'), '先驗證身分']
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, { linkResponse: response })
  const page = await open(ctx, '/calendar')
  await page.evaluate(() => sessionStorage.setItem('line-login', JSON.stringify({ state: 's1', nonce: 'n'.repeat(36), returnTo: '/profile', intent: 'link' })))
  await page.goto(`${base}/auth/line?code=fake&state=s1`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(1500)
  const alert = await page.getByRole('alert').innerText().catch(() => '')
  check((await page.locator('h1').innerText()).includes('沒有綁定 LINE') && alert.includes(expected) && await page.getByRole('button', { name: '回到個人資料' }).isVisible(), `${response.json.code}：「${alert}」，可以回到個人資料`)
  if (dir && response.json.code === 'line_account_has_data') await page.screenshot({ path: `${dir}/link-failure.png` })
  await ctx.close()
}

await browser.close()
console.log(`被擋下的寫入： ${JSON.stringify(blocked)}`)
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
