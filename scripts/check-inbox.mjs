// 站內信（2026-11-16）：GET /users/me 的未讀數掛在頁首「帳號」（電腦版，點了到站內信）與手機「選單」上，選單裡多一列；
// /account/notices 只列 channel 是 inbox 的、最新的那幾則標「未讀」、打開就 POST /users/me/inbox/seen 一次，之後數字消失。
// 全站橫幅的挑法在 scripts/check-release-notes.mjs（橫幅是伺服器畫的，瀏覽器攔不到）。業務中台全部模擬，其他寫入一律擋下。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-inbox.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD）
import { chromium } from 'playwright'
const base = 'http://localhost:3000'
let failures = 0
const check = (ok, label) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++ }
const recent = days => new Date(Date.now() - days * 86_400_000).toISOString()
const NOTES = [
  { id: 'inbox-new', kind: 'site', publishedAt: recent(1), title: '分享連結現在會到期', changes: [{ category: 'improved', text: '分享連結可以選 7、30、90 天', path: '/watchlist' }], channel: 'inbox', bannerEndsAt: null },
  { id: 'plain', kind: 'site', publishedAt: recent(2), title: '一般更新', changes: [], channel: null, bannerEndsAt: null },
  { id: 'inbox-old', kind: 'data', publishedAt: recent(5), title: '全市場指標重算', changes: [], channel: 'inbox', bannerEndsAt: null },
  { id: 'inbox-older', kind: 'site', publishedAt: recent(20), title: '用分數篩選的四個範本拿掉了', changes: [], channel: 'inbox', bannerEndsAt: null }
]
const routeWith = (ctx, handlers) => ctx.route('**/*', (route) => {
  const req = route.request(); const url = new URL(req.url()); const key = `${req.method()} ${url.pathname}`
  if (handlers[key]) return handlers[key](route)
  if (req.method() === 'GET' || /identitytoolkit|securetoken/.test(url.host + url.pathname)) return route.continue()
  return route.abort()
})
const ready = async (page, path) => {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
}
const browser = await chromium.launch()
const login = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await routeWith(login, {})
const lp = await login.newPage()
await ready(lp, '/calendar')
await lp.waitForTimeout(500)
await lp.locator('button[title="登入"]:visible').first().click()
const ui = lp.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL); await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD); await ui.locator('.firebaseui-id-submit').click()
await lp.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
await login.addCookies([{ name: 'analytics-consent', value: 'denied', url: base }])
const storageState = await login.storageState({ indexedDB: true }); await login.close()

const withUnseen = (count, seenCalls) => ({
  'GET /api/core/users/me': route => route.fulfill({ json: { user: { id: 'row-1', email: 'a@example.com', lineLinked: false, unseenInboxCount: count } } }),
  'GET /api/cached/release-notes': route => route.fulfill({ json: { items: NOTES } }),
  'POST /api/core/users/me/inbox/seen': (route) => { seenCalls.push(1); count = 0; return route.fulfill({ json: { inboxSeenAt: new Date().toISOString(), unseenInboxCount: 0 } }) }
})

console.log('電腦版：帳號上的數字、站內信頁')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  const seenCalls = []
  await routeWith(ctx, withUnseen(2, seenCalls))
  const page = await ctx.newPage()
  await ready(page, '/calendar')
  const account = page.locator('.app-shell__header-desktop .user-menu-button__trigger')
  await page.locator('.user-menu-button__badge').first().waitFor({ timeout: 30000 })
  check((await page.locator('.user-menu-button__badge').first().innerText()).trim() === '2', '帳號旁掛未讀數 2')
  check(await account.getAttribute('href') === '/account/notices' && (await account.innerText()).includes('2 則未讀站內信'), '有未讀時點帳號到站內信，讀屏唸出幾則')
  const widthBefore = await account.evaluate(el => el.getBoundingClientRect().width)
  await account.click()
  await page.waitForURL('**/account/notices', { timeout: 30000 })
  await page.locator('.inbox-page__list .inbox-page__title').first().waitFor({ timeout: 30000 })
  const titles = (await page.locator('.inbox-page__title').allTextContents()).map(text => text.trim())
  check(JSON.stringify(titles) === JSON.stringify(['分享連結現在會到期', '全市場指標重算', '用分數篩選的四個範本拿掉了']), '只列站內信、新的在上，一般更新不列')
  await page.waitForTimeout(800)
  const tags = await page.locator('.inbox-page__item').evaluateAll(items => items.map(item => !!item.querySelector('.inbox-page__tag')))
  check(JSON.stringify(tags) === JSON.stringify([true, true, false]), '最新的 2 則標「未讀」，第 3 則不標')
  check(seenCalls.length === 1, '打開就記看過一次')
  check(await page.locator('.user-menu-button__badge').count() === 0, '看過之後帳號旁的數字消失')
  check((await page.locator('[aria-current="page"]', { hasText: '站內信' }).first().innerText()).trim() === '站內信', '側欄的「站內信」不再寫幾則未讀')
  check(Math.abs((await account.evaluate(el => el.getBoundingClientRect().width)) - widthBefore) < 1, '數字疊在頭像上，帳號這顆不變寬')
  await ctx.close()
}

console.log('手機：選單上的數字、選單裡的站內信')
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState })
  await routeWith(ctx, withUnseen(3, []))
  const page = await ctx.newPage()
  await ready(page, '/calendar')
  const menu = page.locator('.mobile-header__btn').first()
  await page.locator('.mobile-header__badge').waitFor({ timeout: 30000 })
  check((await page.locator('.mobile-header__badge').innerText()).trim() === '3' && (await menu.innerText()).includes('3 則未讀站內信'), '選單上掛 3，讀屏唸出幾則')
  await menu.click()
  const row = page.locator('.feature-menu__notice')
  await row.waitFor({ timeout: 10000 })
  check((await row.innerText()).includes('3 則未讀') && await row.getAttribute('href') === '/account/notices', '選單裡多一列「站內信 3 則未讀」')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '沒有左右捲動')
  await ctx.close()
}

console.log('沒有未讀：不掛數字、選單沒有那一列')
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState })
  await routeWith(ctx, withUnseen(0, []))
  const page = await ctx.newPage()
  await ready(page, '/calendar')
  await page.waitForTimeout(1500)
  check(await page.locator('.mobile-header__badge').count() === 0, '選單上沒有數字')
  await page.locator('.mobile-header__btn').first().click()
  await page.locator('.feature-menu__user').waitFor({ timeout: 10000 })
  check(await page.locator('.feature-menu__notice').count() === 0, '選單裡沒有站內信那一列')
  await ctx.close()
}

await browser.close()
console.log(failures ? `FAIL: ${failures}` : 'PASS: inbox')
process.exit(failures ? 1 : 0)
