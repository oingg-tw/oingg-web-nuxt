// 業務中台 48a1c34 的帳號合約（2026-11-09，資安盤點 M1、H2），網頁這一端：
//   - 個人資料「登入方式」的解除綁定 LINE：先確認、寫出解除後的後果；DELETE /auth/line/link 成功那一列換回「綁定 LINE」；
//     401 reauth_required 寫出要先驗證身分、出現密碼欄（標籤寫「解除綁定」）
//   - LINE 登入回呼頁的 401 line_link_revoked：說明改用原本的方式登入、再重新綁定，不給「重新用 LINE 登入」
//   - 記一筆交易被 409 transaction_limit_reached 擋下：寫出上限與目前筆數（延伸欄位 limit／used）
// 業務中台全部模擬，其他寫入一律擋下（測試帳號不會被寫入）。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-account-contract.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD）
import { chromium } from 'playwright'
const base = 'http://localhost:3000'
let failures = 0
const check = (ok, label) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++ }
const problem = (status, code, extra = {}) => ({ status, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'x', status, detail: 'english detail', code, ...extra }) })
const routeWith = (ctx, handlers) => ctx.route('**/*', (route) => {
  const req = route.request(); const url = new URL(req.url()); const key = `${req.method()} ${url.pathname}`
  if (handlers[key]) return handlers[key](route)
  if (req.method() === 'GET' || /identitytoolkit|securetoken/.test(url.host + url.pathname) || url.pathname === '/api/core/screener/values') return route.continue()
  return route.abort()
})
const browser = await chromium.launch()
// 登入一次
const login = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await routeWith(login, {})
const lp = await login.newPage()
await lp.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await lp.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }); await lp.waitForTimeout(500)
await lp.locator('button[title="登入"]:visible').first().click()
const ui = lp.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL); await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD); await ui.locator('.firebaseui-id-submit').click()
await lp.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
await login.addCookies([{ name: 'analytics-consent', value: 'denied', url: base }])
const storageState = await login.storageState({ indexedDB: true }); await login.close()

console.log('個人資料：解除綁定 LINE')
for (const scenario of ['ok', 'reauth']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  const calls = []
  await routeWith(ctx, {
    'GET /api/core/users/me': route => route.fulfill({ json: { user: { lineLinked: true } } }),
    'DELETE /api/core/auth/line/link': (route) => { calls.push('DELETE'); return scenario === 'ok' ? route.fulfill({ json: { lineLinked: false } }) : route.fulfill(problem(401, 'reauth_required')) }
  })
  const page = await ctx.newPage()
  await page.goto(`${base}/profile`, { waitUntil: 'networkidle', timeout: 180000 })
  const unlink = page.getByRole('button', { name: '解除綁定' })
  await unlink.waitFor({ timeout: 30000 })
  await unlink.click()
  const box = page.locator('.el-message-box')
  await box.waitFor({ timeout: 5000 })
  check((await box.innerText()).includes('用 LINE 登入會變成另一個新帳號'), `${scenario}：先確認，寫出解除後的後果`)
  await box.getByRole('button', { name: '解除綁定' }).click()
  await page.waitForTimeout(1500)
  if (scenario === 'ok') {
    check(calls.length === 1 && await page.getByRole('button', { name: '綁定 LINE' }).count() === 1, 'ok：送一次 DELETE，那一列換回「綁定 LINE」')
    check((await page.locator('.el-message').first().innerText()).includes('已解除綁定 LINE'), 'ok：提示已解除綁定')
  } else {
    check((await page.locator('.profile-page__delete-message').innerText()).includes('請先驗證身分，再按一次「解除綁定」'), 'reauth：寫出要先驗證身分')
    check((await page.locator('label[for="link-line-password"]').innerText()).includes('再按一次「解除綁定」'), 'reauth：出現密碼欄，標籤寫「解除綁定」')
  }
  await ctx.close()
}

console.log('LINE 登入：綁定後撤銷過登入')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => sessionStorage.setItem('line-login', JSON.stringify({ state: 's-1', nonce: 'n-1', returnTo: '/', intent: 'login' })))
  await routeWith(ctx, { 'POST /api/core/auth/line': route => route.fulfill(problem(401, 'line_link_revoked')) })
  const page = await ctx.newPage()
  await page.goto(`${base}/auth/line?code=c-1&state=s-1`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.line-login-page__title').waitFor({ timeout: 20000 })
  check((await page.locator('.line-login-page__title').innerText()).trim() === '這次沒辦法用 LINE 登入', '標題寫沒辦法用 LINE 登入')
  check((await page.locator('.line-login-page__detail').innerText()).includes('到「個人資料」重新綁定 LINE'), '說明寫改用原本的方式登入、再重新綁定')
  check(await page.getByRole('button', { name: '重新用 LINE 登入' }).count() === 0 && await page.getByRole('button', { name: '改用其他方式登入' }).count() === 1, '不給「重新用 LINE 登入」，只給「改用其他方式登入」')
  await ctx.close()
}

console.log('交易筆數上限')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await routeWith(ctx, {
    'GET /api/core/portfolios': route => route.fulfill({ json: { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] } }),
    'GET /api/core/holdings': route => route.fulfill({ json: { holdings: [] } }),
    'POST /api/core/transactions': route => route.fulfill(problem(409, 'transaction_limit_reached', { limit: 50000, used: 50000 }))
  })
  const page = await ctx.newPage()
  await page.goto(`${base}/holdings`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: '記一筆交易' }).first().click()
  const dialog = page.getByRole('dialog', { name: '記一筆交易' })
  await dialog.getByPlaceholder('輸入代號或名稱，例如 2330 或 台積電').fill('2330')
  await page.locator('.el-autocomplete-suggestion li:visible').first().click()
  await dialog.getByLabel('股數（股）').fill('1000')
  await dialog.getByLabel('成交價（元／股）').fill('100')
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.waitForTimeout(1500)
  const toast = (await page.locator('.el-message').allInnerTexts()).join(' ')
  check(toast.includes('交易紀錄最多 50,000 筆，現在已經有 50,000 筆。請先刪掉不需要的紀錄，再新增。'), `新增被 409 擋下：寫出上限與目前筆數（${toast.trim().slice(0, 60)}）`)
  await ctx.close()
}
await browser.close()
console.log(failures ? `\n${failures} 項沒過` : '\n全部通過')
process.exitCode = failures ? 1 : 0
