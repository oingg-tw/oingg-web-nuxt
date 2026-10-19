// 分享連結（SharedShareButton、/share/[token]）的行為檢查，2026-10-19。業務中台 的 /shares 與 /public/shares 全部模擬，
// 其他寫入一律擋下（測試帳號不會被寫入）：
//   - 擁有者：預設勾表格上的欄、備註不勾；建立送出的 PUT；網址、焦點、念出狀態、複製；更新欄位；按鈕「分享／已分享」；
//     關閉連結先關對話框、10 秒內不送 DELETE、按復原就不送；讀不到連結狀態時不出現；晚出現時沒有版面位移；axe。
//   - 訪客：分享頁的標題、noindex、檔數、備註只在分享了才出現、沒有操作欄、找不到是 404；axe。
// 分享頁用站內換頁打開（請求從瀏覽器發，才攔得到）；SSR 那一條要等 業務中台 上線後實際打一次。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-share-links.mjs（要 A11Y_TEST_EMAIL／PASSWORD；DIR＝截圖目錄，可省略）
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const base = 'http://localhost:3000'
const dir = process.env.DIR
const shot = async (page, name, fullPage = false) => { if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage }) }
const browser = await chromium.launch()
const TOKEN = 'Zq3x9VbN1mKp7RtY2wLc8A'
const symbols = ['2330', '2317', '0056', '2884', '00878', '2412']
const items = symbols.map((symbol, index) => ({ id: `i-${symbol}`, watchlistId: 'w-1', symbol, note: index === 1 ? '等法說會再看' : null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }))
const hash = text => [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0)
// 持股（第二階段）：一個帳戶、兩檔。公開資料分兩種：只分享比例（占比、報酬率）與連部位大小一起分享
const TOKEN_H = 'Hq7x2VbN1mKp7RtY2wLc8B'
const holdings = [
  { symbol: '2330', quantity: 1000, costUnknownQuantity: 0, averageCost: '80.0000', totalCost: '80000', realizedProfitLoss: '0' },
  { symbol: '0056', quantity: 2000, costUnknownQuantity: 0, averageCost: '120.0000', totalCost: '240000', realizedProfitLoss: '0' }
]
const HOLDINGS_PAYLOAD = {
  ratios: { kind: 'holdings', asOf: '2026-10-16', columns: [{ key: 'weight', label: '占比' }, { key: 'pnlPct', label: '報酬率' }, { key: 'dayChange', label: '今日漲跌' }], holdings: [{ symbol: '0056', weight: '0.400000', pnlPct: '-0.050000' }, { symbol: '2330', weight: '0.600000', pnlPct: '0.250000' }] },
  sizes: { kind: 'holdings', asOf: null, columns: [{ key: 'quantity', label: '股數' }, { key: 'marketValue', label: '市值' }, { key: 'unrealizedPnl', label: '未實現損益' }], holdings: holdings.map(({ symbol, quantity, averageCost, costUnknownQuantity }) => ({ symbol, quantity, averageCost, costUnknownQuantity })) }
}
let storedShares = []
const calls = []
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const mock = async (ctx, { withNote = false, holdingsPayload = 'ratios' } = {}) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (p === '/api/core/watchlists' && m === 'GET') return route.fulfill({ json: { watchlists: [{ id: 'w-1', name: '存股名單', position: 0, createdAt: '2026-10-01T00:00:00Z' }] } })
    if (p === '/api/core/watchlist' && m === 'GET') return route.fulfill({ json: { items } })
    if (p === '/api/core/users/me/watchlist-columns' && m === 'GET') return route.fulfill({ json: { watchlistColumns: { columns: null } } })
    if (p === '/api/core/portfolios' && m === 'GET') return route.fulfill({ json: { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] } })
    if (p === '/api/core/holdings' && m === 'GET') return route.fulfill({ json: { holdings } })
    if (p === '/api/core/shares' && m === 'GET') return route.fulfill({ json: { shares: storedShares } })
    if (p === '/api/core/shares' && m === 'PUT') {
      const body = JSON.parse(req.postData()); calls.push(`PUT ${JSON.stringify(body)}`)
      const share = { token: body.kind === 'holdings' ? TOKEN_H : TOKEN, kind: body.kind, watchlistId: body.watchlistId ?? null, portfolioId: body.portfolioId ?? null, columns: body.columns, createdAt: 'x', updatedAt: 'y' }
      storedShares = [...storedShares.filter(item => item.token !== share.token), share]
      return route.fulfill({ json: { share } })
    }
    if (p === `/api/core/shares/${TOKEN}` && m === 'DELETE') { calls.push('DELETE'); storedShares = storedShares.filter(item => item.token !== TOKEN); return route.fulfill({ status: 204, body: '' }) }
    if (p === `/api/core/public/shares/${TOKEN}`) {
      const columns = [{ key: 'stock.price', label: '收盤價' }, { key: 'watchlist.change', label: '漲跌' }, { key: 'exchangePeRatio.EOD', label: '本益比' }, ...(withNote ? [{ key: 'note', label: '備註' }] : [])]
      return route.fulfill({ json: { kind: 'watchlist', name: '存股名單', columns, items: items.map(({ symbol, note }) => ({ symbol, ...(withNote && note ? { note } : {}) })) } })
    }
    if (p === `/api/core/public/shares/${TOKEN_H}`) return route.fulfill({ json: HOLDINGS_PAYLOAD[holdingsPayload] })
    if (p.startsWith('/api/core/public/shares/')) return route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404 }) })
    if (p === '/api/core/screener/values' && m === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      return route.fulfill({ json: { results: body.symbols.map(symbol => ({ symbol, values: Object.fromEntries(body.columns.map(({ field }) => [field, { value: String(field === 'stock.previousClose' ? 100 : 100 + (hash(symbol + field) % 7) - 3), knowledgeDate: '2026-10-16', nullReason: null }])) })) } })
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    calls.push(`BLOCKED ${m} ${p}`)
    return route.abort()
  })
}
const axe = async page => (await new AxeBuilder({ page }).exclude('#nuxt-devtools-container').analyze()).violations.map(v => `${v.id}(${v.nodes.length})`).join(',') || '0'

// ---- 擁有者 ----
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

console.log('擁有者（1440）')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState, permissions: ['clipboard-read', 'clipboard-write'] })
  await mock(ctx)
  const page = await ctx.newPage()
  await page.goto(`${base}/watchlist`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  const button = page.locator('.shared-share__button')
  check((await button.innerText()).trim() === '分享', '還沒分享：按鈕寫「分享」')
  await button.click(); await page.waitForTimeout(400)
  const dialog = page.getByRole('dialog', { name: '分享「存股名單」' })
  check(await dialog.isVisible(), '對話框標題是 分享「存股名單」')
  const checked = await dialog.locator('.el-checkbox.is-checked').allInnerTexts()
  check(JSON.stringify(checked) === JSON.stringify(['收盤價', '漲跌', '本益比', '股價淨值比', '除息／發放']), `預設勾表格上的 5 欄，備註不勾（實得 ${checked.join('、')}）`)
  console.log('  axe（對話框開著）:', await axe(page))
  await shot(page, 'share-dialog-new-1440')
  await dialog.getByRole('button', { name: '建立連結' }).click(); await page.waitForTimeout(600)
  check(calls.at(-1) === `PUT {"kind":"watchlist","watchlistId":"w-1","columns":[{"key":"stock.price","label":"收盤價"},{"key":"watchlist.change","label":"漲跌"},{"key":"exchangePeRatio.EOD","label":"本益比"},{"key":"exchangePbRatio.EOD","label":"股價淨值比"},{"key":"watchlist.exDividend","label":"除息／發放"}]}`, 'PUT 的 body 正確')
  const url = await dialog.getByLabel('分享連結').inputValue()
  check(url === `${base}/share/${TOKEN}`, `網址是 ${url}`)
  check(await page.evaluate(() => document.activeElement?.textContent?.trim()) === '複製連結', '焦點移到「複製連結」')
  check((await dialog.locator('[role=status]').innerText()).includes('已建立連結'), '念出「已建立連結」')
  await dialog.getByRole('button', { name: '複製連結' }).click(); await page.waitForTimeout(300)
  check(await page.evaluate(() => navigator.clipboard.readText()) === url, '剪貼簿裡是網址')
  check(await dialog.getByRole('button', { name: '更新欄位' }).isDisabled(), '沒改欄位時「更新欄位」停用')
  await dialog.locator('.el-checkbox', { hasText: '備註' }).click(); await page.waitForTimeout(200)
  await dialog.getByRole('button', { name: '更新欄位' }).click(); await page.waitForTimeout(600)
  check(calls.at(-1).includes('{"key":"note","label":"備註"}'), '勾了備註，PUT 帶 note')
  console.log('  axe（已分享的對話框）:', await axe(page))
  await shot(page, 'share-dialog-shared-1440')
  await dialog.getByRole('button', { name: '完成' }).click(); await page.waitForTimeout(500)
  check((await button.innerText()).trim() === '已分享', '按鈕變成「已分享」')
  // 關閉連結：先復原一次，再真的關
  await button.click(); await page.waitForTimeout(400)
  await dialog.getByRole('button', { name: '關閉連結' }).click(); await page.waitForTimeout(500)
  check(!(await dialog.isVisible()), '關閉連結時對話框先關（不疊）')
  check((await page.locator('.el-message').first().innerText()).includes('已關閉「存股名單」的分享連結'), '提示寫已關閉，可以復原')
  check((await button.innerText()).trim() === '分享', '10 秒內畫面上當作已經關了')
  await page.getByRole('button', { name: '復原' }).click(); await page.waitForTimeout(500)
  check((await button.innerText()).trim() === '已分享' && !calls.includes('DELETE'), '按復原：沒送 DELETE，按鈕回到「已分享」')
  await button.click(); await page.waitForTimeout(400)
  await dialog.getByRole('button', { name: '關閉連結' }).click(); await page.waitForTimeout(300)
  await page.evaluate(() => document.activeElement?.blur()); await page.mouse.move(5, 5)
  await page.waitForTimeout(4000)
  check(!calls.includes('DELETE'), '4 秒時還沒送 DELETE')
  await page.waitForTimeout(8000)
  check(calls.includes('DELETE'), '10 秒後送出 DELETE')
  check((await button.innerText()).trim() === '分享', '關掉之後按鈕回到「分享」')
  await ctx.close()
}

console.log('分享鈕出現的時機')
{
  // 業務中台 還沒有 /shares（404）：不出現
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx)
  // 後註冊的先比對：蓋過 mock 裡的 /shares
  await ctx.route('**/api/core/shares', route => route.fulfill({ status: 404, contentType: 'application/problem+json', body: '{"status":404}' }))
  const page = await ctx.newPage()
  await page.goto(`${base}/watchlist`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  check(await page.locator('.shared-share__button').count() === 0, '讀不到連結狀態（404）時不出現分享鈕')
  await ctx.close()
}
{
  // /shares 晚 2 秒才回：分享鈕出現時，欄位設定不動、沒有版面位移
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await ctx.addInitScript(() => {
    // dev 才有的 Nuxt devtools 浮動鈕會自己挪幾 px，先藏起來，免得算進去
    document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = '#nuxt-devtools-container{display:none!important}'; document.head.append(style) })
    window.__cls = 0
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value }).observe({ type: 'layout-shift', buffered: true })
  })
  await mock(ctx)
  await ctx.route('**/api/core/shares', async (route) => { await new Promise(resolve => setTimeout(resolve, 6000)); await route.fulfill({ json: { shares: [] } }) })
  const page = await ctx.newPage()
  await page.goto(`${base}/watchlist`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  const settings = page.locator('.watchlist-toolbar__settings')
  await settings.waitFor({ state: 'visible', timeout: 60000 })
  // 報價等其他東西先穩定下來，只量分享鈕出現的那一刻
  await page.waitForTimeout(3000)
  check(await page.locator('.shared-share__button').count() === 0, '（前提）/shares 還沒回來時分享鈕還沒出現')
  const before = await settings.boundingBox()
  const clsBefore = await page.evaluate(() => window.__cls)
  await page.locator('.shared-share__button').waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(500)
  const after = await settings.boundingBox()
  const clsAfter = await page.evaluate(() => window.__cls)
  check(before.x === after.x && before.y === after.y, `分享鈕出現時欄位設定不動（${before.x},${before.y} → ${after.x},${after.y}）`)
  check(clsAfter - clsBefore === 0, `分享鈕出現沒有版面位移（CLS 增加 ${(clsAfter - clsBefore).toFixed(4)}）`)
  await ctx.close()
}

console.log('擁有者（375）')
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true, storageState })
  await mock(ctx)
  const page = await ctx.newPage()
  await page.goto(`${base}/watchlist`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  await shot(page, 'share-watchlist-375')
  await page.locator('.shared-share__button').click(); await page.waitForTimeout(400)
  console.log('  axe（對話框開著）:', await axe(page))
  await shot(page, 'share-dialog-375')
  await ctx.close()
}

console.log('訪客打開分享頁（站內換頁，請求從瀏覽器發）')
for (const [width, withNote] of [[1440, false], [375, true]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
  await mock(ctx, { withNote })
  const page = await ctx.newPage()
  await page.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
  await page.evaluate(token => window.useNuxtApp().$router.push(`/share/${token}`), TOKEN)
  await page.waitForURL(`**/share/${TOKEN}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2500)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  check((await page.locator('h1').innerText()).startsWith('存股名單'), `${width}：h1 是清單名`)
  check(await page.title() === '存股名單・分享的觀察清單｜安盈選股', `${width}：分頁標題`)
  check(await page.locator('meta[name="robots"]').getAttribute('content') === 'noindex, nofollow', `${width}：noindex`)
  const visibleRows = await page.locator(width >= 1280 ? '.view-table tbody tr' : '.watchlist-cards li').count()
  check(visibleRows === 6, `${width}：6 檔（實得 ${visibleRows}）`)
  check(await page.getByText('等法說會再看').count() === (withNote ? (width >= 1280 ? 1 : 2) : 0), `${width}：${withNote ? '分享了備註才顯示' : '沒分享備註就沒有'}`)
  check(await page.locator('.watchlist-row-actions').count() === 0, `${width}：沒有操作欄`)
  console.log(`  axe ${width}:`, await axe(page))
  await shot(page, `share-page-${width}`, true)
  await page.evaluate(() => window.useNuxtApp().$router.push('/share/NoSuchTokenNoSuchToken1'))
  await page.waitForTimeout(2500)
  check((await page.locator('body').innerText()).includes('這個分享連結已經關閉，或網址不完整'), `${width}：不存在的 token 是 404 頁、寫出原因`)
  await ctx.close()
}

console.log('持股：擁有者（1440）')
{
  storedShares = []
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx)
  const page = await ctx.newPage()
  await page.goto(`${base}/holdings`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  const button = page.locator('.symbol-table__toolbar .shared-share__button')
  check(await button.count() === 1 && (await button.innerText()).trim() === '分享', '持股明細表的工具列有「分享」')
  await button.click(); await page.waitForTimeout(400)
  const dialog = page.getByRole('dialog', { name: '分享「我的持股」' })
  check(await dialog.isVisible(), '一個帳戶時標題寫 分享「我的持股」')
  const checkedLabels = (await dialog.locator('.el-checkbox.is-checked').allInnerTexts()).map(text => text.trim())
  check(JSON.stringify(checkedLabels) === '["占比","報酬率","今日漲跌"]', `預設勾占比、報酬率、今日漲跌（實得 ${checkedLabels.join('、')}）`)
  check((await dialog.locator('.column-checklist__heading').innerText()).includes('部位大小（預設不分享）'), '股數、市值、未實現損益、預估年股利在「部位大小（預設不分享）」下面、不勾')
  console.log('  axe（對話框開著）:', await axe(page))
  await shot(page, 'share-holdings-dialog-1440')
  await dialog.getByRole('button', { name: '建立連結' }).click(); await page.waitForTimeout(600)
  check(calls.at(-1) === 'PUT {"kind":"holdings","portfolioId":null,"columns":[{"key":"weight","label":"占比"},{"key":"pnlPct","label":"報酬率"},{"key":"dayChange","label":"今日漲跌"}]}', 'PUT 的 body：kind holdings、全部帳戶（null）、三欄')
  check((await dialog.getByLabel('分享連結').inputValue()) === `${base}/share/${TOKEN_H}`, '網址就是這條連結')
  await dialog.getByRole('button', { name: '完成' }).click(); await page.waitForTimeout(400)
  check((await button.innerText()).trim() === '已分享', '按鈕變成「已分享」')
  await ctx.close()
}
{
  // /shares 晚 6 秒才回：分享鈕出現時表格不動（工具列先保留了一個按鈕高）
  storedShares = []
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = '#nuxt-devtools-container{display:none!important}'; document.head.append(style) })
    window.__cls = 0
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value }).observe({ type: 'layout-shift', buffered: true })
  })
  await mock(ctx)
  await ctx.route('**/api/core/shares', async (route) => { await new Promise(resolve => setTimeout(resolve, 6000)); await route.fulfill({ json: { shares: [] } }) })
  const page = await ctx.newPage()
  await page.goto(`${base}/holdings`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  const table = page.locator('.view-table')
  await table.waitFor({ state: 'visible', timeout: 60000 })
  await page.waitForTimeout(3000)
  check(await page.locator('.shared-share__button').count() === 0, '（前提）/shares 還沒回來時分享鈕還沒出現')
  const before = await table.boundingBox()
  const clsBefore = await page.evaluate(() => window.__cls)
  await page.locator('.shared-share__button').waitFor({ state: 'visible', timeout: 10000 }); await page.waitForTimeout(500)
  const after = await table.boundingBox()
  const clsAfter = await page.evaluate(() => window.__cls)
  check(before.y === after.y, `分享鈕出現時表格不動（y ${before.y} → ${after.y}）`)
  check(clsAfter - clsBefore === 0, `分享鈕出現沒有版面位移（CLS 增加 ${(clsAfter - clsBefore).toFixed(4)}）`)
  await ctx.close()
}

console.log('持股：訪客打開分享頁（站內換頁）')
const priceOf = symbol => 100 + (hash(`${symbol}stock.latestClose`) % 7) - 3
for (const [width, payload] of [[1440, 'ratios'], [375, 'ratios'], [1440, 'sizes']]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
  await mock(ctx, { holdingsPayload: payload })
  const page = await ctx.newPage()
  await page.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
  await page.evaluate(token => window.useNuxtApp().$router.push(`/share/${token}`), TOKEN_H)
  await page.waitForURL(`**/share/${TOKEN_H}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2500)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  const label = `${width}／${payload}`
  check((await page.locator('h1').innerText()).startsWith('分享的持股'), `${label}：h1 是「分享的持股」`)
  check(await page.title() === '分享的持股｜安盈選股', `${label}：分頁標題`)
  check(await page.getByRole('button', { name: /明細/ }).count() === 0, `${label}：沒有「明細」展開`)
  if (width >= 1280) {
    const headers = (await page.locator('.view-table th').allInnerTexts()).map(text => text.trim()).filter(Boolean)
    if (payload === 'ratios') {
      check(JSON.stringify(headers) === '["名稱","占比","報酬率","今日漲跌"]', `${label}：欄位只有勾的那三欄（${headers.join('、')}）`)
      const first = (await page.locator('.view-table tbody tr').first().innerText()).replace(/\s+/g, ' ')
      check(first.includes('2330') && first.includes('60.0%') && first.includes('+25.00%'), `${label}：依占比排、2330 在第一列，占比 60.0%、報酬率 +25.00%（${first}）`)
    } else {
      check(JSON.stringify(headers) === '["名稱","股數","市值","未實現損益"]', `${label}：欄位只有勾的那三欄（${headers.join('、')}）`)
      const row = (await page.locator('.view-table tbody tr', { hasText: '2330' }).innerText()).replace(/\s+/g, ' ')
      const value = (1000 * priceOf('2330')).toLocaleString('en-US')
      const pnl = (1000 * (priceOf('2330') - 80)).toLocaleString('en-US')
      check(row.includes(value) && row.includes(`▲ +${pnl} 元`), `${label}：市值與未實現損益用公開報價算，跟持股總覽同一套（市值 ${value}、損益 +${pnl}；${row}）`)
    }
  } else {
    check(await page.locator('.symbol-table__cards li').count() === 2, `${label}：兩張卡片`)
  }
  console.log(`  axe ${label}:`, await axe(page))
  await shot(page, `share-holdings-${payload}-${width}`, true)
  await ctx.close()
}

console.log('被擋下的寫入：', JSON.stringify(calls.filter(call => call.startsWith('BLOCKED'))))
await browser.close()
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
