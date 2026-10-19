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
// 持股特色（業務中台 GET /holdings/traits，分享時同一份）：Beta 0.7（低 Beta），本益比、ROE、九宮格只涵蓋 60%（ETF 沒有財報、
// 不分規模風格），2330 在大型混合；前三大（ETF 除外）只有 2330 的 60%（持股集中）。market 還沒上線時是 null，上線後同形狀，
// 大盤九宮格是 DEV 10/16 的實際數字
const trait = (value, coverage = '1.000000') => ({ value, coverage })
const BOX = ['large', 'mid', 'small'].flatMap(row => ['Value', 'Core', 'Growth'].map(column => `${row}${column}Pct`))
const box = (values, coverage) => Object.fromEntries(BOX.map((key, index) => [key, trait(values[index], coverage)]))
const TRAITS = {
  asOf: '2026-10-16',
  portfolio: { peRatio: trait('14.200000', '0.600000'), pbRatio: trait('1.800000', '0.600000'), dividendYield: trait('5.100000', '0.600000'), roe: trait('12.300000', '0.600000'), revenueGrowth: trait('4.000000', '0.600000'), beta: trait('0.700000'), revenueYoyVolatility: trait(null, '0.000000'), top3HoldingsPct: trait('60.00', '1'), largeCapPct: trait('100.00', '0.6000'), ...box(['0.00', '100.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'], '0.6000') },
  market: null
}
const TRAITS_WITH_MARKET = { ...TRAITS, market: { peRatio: trait('21.500000'), pbRatio: trait('2.600000'), dividendYield: trait('3.000000'), roe: trait('11.800000'), revenueGrowth: trait('9.200000'), beta: trait('1.000000'), revenueYoyVolatility: trait(null, '0.000000'), top3HoldingsPct: trait('44.97'), largeCapPct: trait('70.04'), ...box(['10.96', '50.20', '9.28', '5.91', '7.57', '6.43', '3.30', '3.43', '2.93'], '0.9945') } }
const HOLDINGS_PAYLOAD = {
  ratios: { kind: 'holdings', asOf: '2026-10-16', columns: [{ key: 'traits', label: '持股特色' }, { key: 'weight', label: '占比' }, { key: 'pnlPct', label: '報酬率' }, { key: 'dayChange', label: '今日漲跌' }], holdings: [{ symbol: '0056', weight: '0.400000', pnlPct: '-0.050000' }, { symbol: '2330', weight: '0.600000', pnlPct: '0.250000' }], traits: TRAITS },
  market: { kind: 'holdings', asOf: '2026-10-16', columns: [{ key: 'traits', label: '持股特色' }, { key: 'weight', label: '占比' }], holdings: [{ symbol: '0056', weight: '0.400000' }, { symbol: '2330', weight: '0.600000' }], traits: TRAITS_WITH_MARKET },
  sizes: { kind: 'holdings', asOf: null, columns: [{ key: 'quantity', label: '股數' }, { key: 'marketValue', label: '市值' }, { key: 'unrealizedPnl', label: '未實現損益' }], holdings: holdings.map(({ symbol, quantity, averageCost, costUnknownQuantity }) => ({ symbol, quantity, averageCost, costUnknownQuantity })) }
}
let storedShares = []
const calls = []
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const mock = async (ctx, { withNote = false, holdingsPayload = 'ratios' } = {}) => {
  // 「加到我的觀察清單」建的清單與項目（模擬、只在這個 context 裡）：之後的 GET 也要讀得到，跟真的後端一樣
  const createdLists = []
  const createdItems = []
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (p === '/api/core/watchlists' && m === 'GET') return route.fulfill({ json: { watchlists: [{ id: 'w-1', name: '存股名單', position: 0, createdAt: '2026-10-01T00:00:00Z' }, ...createdLists] } })
    if (p === '/api/core/watchlist' && m === 'GET') return route.fulfill({ json: { items: [...items, ...createdItems] } })
    if (p === '/api/core/watchlists' && m === 'POST') {
      const body = JSON.parse(req.postData()); calls.push(`POST /watchlists ${body.name}`)
      const watchlist = { id: `w-new-${createdLists.length + 1}`, name: body.name, position: createdLists.length + 1, createdAt: '2026-10-20T00:00:00Z' }
      createdLists.push(watchlist)
      return route.fulfill({ json: { watchlist } })
    }
    if (p === '/api/core/watchlist' && m === 'POST') {
      const body = JSON.parse(req.postData()); calls.push(`POST /watchlist ${body.watchlistId} ${body.symbol}`)
      const item = { id: `i-new-${createdItems.length + 1}`, watchlistId: body.watchlistId, symbol: body.symbol, note: null, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' }
      createdItems.push(item)
      return route.fulfill({ json: { item } })
    }
    if (p === '/api/core/users/me/watchlist-columns' && m === 'GET') return route.fulfill({ json: { watchlistColumns: { columns: null } } })
    if (p === '/api/core/portfolios' && m === 'GET') return route.fulfill({ json: { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] } })
    if (p === '/api/core/holdings' && m === 'GET') return route.fulfill({ json: { holdings } })
    if (p === '/api/core/holdings/traits' && m === 'GET') return route.fulfill({ json: TRAITS })
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
  await page.mouse.move(0, 0); await page.waitForTimeout(600)
  const newViolations = await axe(page)
  check(newViolations === '0', `建立前的對話框 axe 0（${newViolations}）`)
  await shot(page, 'share-dialog-new-1440')
  // 連結列固定在最上面：建立前後「要分享哪些內容？」的位置不動（使用者：分享彈跳視窗「請再設計，確保 UIUX」）
  const headBefore = await dialog.locator('.share-dialog__content-head').boundingBox()
  check((await dialog.locator('.share-dialog__footer').getByRole('button').allInnerTexts()).map(text => text.trim()).join() === '取消', '建立前底部只有「取消」，主要按鈕在連結列')
  await dialog.getByRole('button', { name: '建立連結' }).click(); await page.waitForTimeout(600)
  check(calls.at(-1) === `PUT {"kind":"watchlist","watchlistId":"w-1","columns":[{"key":"stock.price","label":"收盤價"},{"key":"watchlist.change","label":"漲跌"},{"key":"exchangePeRatio.EOD","label":"本益比"},{"key":"exchangePbRatio.EOD","label":"股價淨值比"},{"key":"watchlist.exDividend","label":"除息／發放"}]}`, 'PUT 的 body 正確')
  const headAfter = await dialog.locator('.share-dialog__content-head').boundingBox()
  check(Math.abs(headAfter.y - headBefore.y) < 1, `建立後連結列換成網址，下面的內容不跳（y ${headBefore.y} → ${headAfter.y}）`)
  const url = await dialog.getByLabel('分享連結').inputValue()
  check(url === `${base}/share/${TOKEN}`, `網址是 ${url}`)
  check(await page.evaluate(() => document.activeElement?.textContent?.trim()) === '複製連結', '焦點移到「複製連結」')
  check((await dialog.locator('[role=status]').innerText()).includes('已建立連結'), '念出「已建立連結」')
  await dialog.getByRole('button', { name: '複製連結' }).click(); await page.waitForTimeout(300)
  check(await page.evaluate(() => navigator.clipboard.readText()) === url, '剪貼簿裡是網址')
  check(await dialog.getByRole('button', { name: '更新欄位' }).count() === 0, '沒有「更新欄位」：改勾選就直接存')
  const putsBefore = calls.filter(call => call.startsWith('PUT')).length
  await dialog.locator('.el-checkbox', { hasText: '備註' }).click(); await page.waitForTimeout(1200)
  const puts = calls.filter(call => call.startsWith('PUT'))
  check(puts.length === putsBefore + 1 && puts.at(-1).includes('{"key":"note","label":"備註"}') && (await dialog.locator('[role=status]').innerText()).trim() === '已儲存', '勾了備註：自己存一次（PUT 帶 note），寫出「已儲存」')
  await page.mouse.move(0, 0); await page.waitForTimeout(600)
  const sharedViolations = await axe(page)
  check(sharedViolations === '0', `已分享的對話框 axe 0（${sharedViolations}）`)
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
  await page.mouse.move(0, 0); await page.waitForTimeout(600)
  const dialogAxe = await axe(page)
  check(dialogAxe === '0', `對話框 axe 0（${dialogAxe}）`)
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
  check(JSON.stringify(checkedLabels) === '["持股特色","占比","報酬率","今日漲跌"]', `預設勾持股特色、占比、報酬率、今日漲跌（實得 ${checkedLabels.join('、')}）`)
  check((await dialog.locator('.column-checklist__heading').innerText()).includes('部位大小，預設不分享'), '股數、市值、未實現損益、預估年股利在「部位大小，預設不分享」下面、不勾')
  await page.mouse.move(0, 0); await page.waitForTimeout(600)
  const dialogAxe = await axe(page)
  check(dialogAxe === '0', `對話框 axe 0（${dialogAxe}）`)
  await shot(page, 'share-holdings-dialog-1440')
  await dialog.getByRole('button', { name: '建立連結' }).click(); await page.waitForTimeout(600)
  check(calls.at(-1) === 'PUT {"kind":"holdings","portfolioId":null,"columns":[{"key":"traits","label":"持股特色"},{"key":"weight","label":"占比"},{"key":"pnlPct","label":"報酬率"},{"key":"dayChange","label":"今日漲跌"}]}', 'PUT 的 body：kind holdings、全部帳戶（null）、持股特色＋三欄')
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

console.log('持股特色：持股分析頁（1440）')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx)
  const page = await ctx.newPage()
  await page.goto(`${base}/holdings/analysis`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  const headings = (await page.locator('main h2, .holdings-shell h2').allInnerTexts()).map(text => text.trim())
  check(headings.indexOf('資金分布在哪些產業？') >= 0 && headings.indexOf('這組持股有什麼特色？') > headings.indexOf('資金分布在哪些產業？'), `產業之後是「這組持股有什麼特色？」（${headings.join('／')}）`)
  const tags = (await page.locator('.holdings-traits__tag').allInnerTexts()).map(text => text.trim())
  check(JSON.stringify(tags) === '["低 Beta","持股集中"]', `大盤還沒有時只貼不必比大盤的標籤（${tags.join('、')}）`)
  // 每個數字只出現一次（使用者：「資訊還重複了」）：標籤只有名字，涵蓋率只有一行
  const tagText = await page.locator('.holdings-traits__tags').innerText()
  check(!/\d/.test(tagText) && await page.locator('.holdings-traits__note', { hasText: '不計算在九宮格中' }).count() === 1, `標籤一排只有名字、九宮格的排除說明只寫一次（${tagText.replace(/\s+/g, ' ')}）`)
  const figcaption = (await page.locator('.holdings-traits__boxes figcaption').innerText()).trim()
  const captions = (await page.locator('.holdings-traits__box caption').allInnerTexts()).map(text => text.replace(/\s+/g, ''))
  const headers = await page.locator('.holdings-traits__box th').allInnerTexts()
  const coreCell = (await page.locator('.holdings-traits__box tbody tr').first().locator('td').nth(1).innerText()).trim()
  check(figcaption === '規模與風格九宮格（占市值）' && captions.length === 1 && captions[0].startsWith('這組持股') && headers.join() === '價值,混合,成長,大型,中型,小型' && coreCell === '100%', `九宮格：大盤還沒有時只有「這組持股」一張，欄是風格、列是規模，大型混合 100%（${captions.join('、')}；${coreCell}）`)
  check(await page.locator('.holdings-traits tbody tr', { hasText: '大型股占比' }).count() === 0 && await page.locator('.holdings-traits__vs').count() === 0, '沒有大中小型三列（九宮格的列就是規模）；只有一張時沒有 vs')
  const metricHeaders = (await page.locator('.holdings-traits__metrics thead th').allInnerTexts()).map(text => text.trim())
  check(JSON.stringify(metricHeaders) === '["指標","這組持股"]', `指標表：大盤還沒有時只有兩欄、沒有「意思」欄（${metricHeaders.join('、')}）`)
  const top3Row = (await page.locator('.holdings-traits__metrics tbody tr', { hasText: '前三大持股占比（ETF 除外）' }).innerText()).replace(/\s+/g, ' ')
  const roeRow = (await page.locator('.holdings-traits__metrics tbody tr', { hasText: 'ROE' }).innerText()).replace(/\s+/g, ' ')
  check(top3Row.includes('60.0%') && roeRow.includes('12.3%') && !roeRow.includes('涵蓋'), `前三大 60.0%、ROE 12.3%，列裡不再寫涵蓋（${top3Row}｜${roeRow}）`)
  const coverage = (await page.locator('.holdings-traits__coverage').innerText()).trim()
  check(coverage === 'ETF、特別股，或上市不久、股價或財報還不夠長的股票，不計算在九宮格中。', `有持股沒算進九宮格時只寫重點（${coverage}）`)
  check(await page.locator('.holdings-traits tbody tr', { hasText: '營收年增率波動' }).count() === 0, '營收年增率波動沒有資料時不出現')
  const violations = await axe(page)
  check(violations === '0', `axe 0（${violations}）`)
  await shot(page, 'traits-analysis-1440', true)
  // 九宮格最深的底色（light-7，大型混合 100%）對格子文字：7 個主色 × 深淺模式逐一量（axe 只量得到目前這一組）
  const lowest = await page.evaluate(() => {
    const html = document.documentElement
    const luminance = (color) => {
      const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map((value) => { const v = Number(value) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const results = []
    for (const dark of [false, true]) {
      for (const color of ['GOLD', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'RED', 'TEAL']) {
        html.classList.toggle('dark', dark); html.dataset.themeColor = color
        for (const cell of document.querySelectorAll('.holdings-traits__box td[class*="holdings-traits__cell--"]')) {
          const style = getComputedStyle(cell)
          const [high, low] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a)
          results.push({ name: `${color}${dark ? ' 深色' : ' 淺色'}`, ratio: (high + 0.05) / (low + 0.05) })
        }
      }
    }
    return results.length === 126 ? results.reduce((min, item) => (item.ratio < min.ratio ? item : min)) : { name: `量到 ${results.length} 組`, ratio: 0 }
  })
  check(lowest.ratio >= 4.5, `九宮格 9 格（0 的淺灰到最深的 light-7）對格子文字，14 種主色組合都 ≥ 4.5:1（最低 ${lowest.ratio.toFixed(2)}:1，${lowest.name}）`)
  // 深色模式也截一張給人看（金色）
  await page.evaluate(() => { document.documentElement.classList.add('dark'); document.documentElement.dataset.themeColor = 'GOLD' })
  await shot(page, 'traits-analysis-1440-dark', true)
  await ctx.close()
}

console.log('持股：訪客打開分享頁（站內換頁）')
const priceOf = symbol => 100 + (hash(`${symbol}stock.latestClose`) % 7) - 3
for (const [width, payload] of [[1440, 'ratios'], [375, 'ratios'], [1440, 'market'], [375, 'market'], [1440, 'sizes']]) {
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
  const traitsBox = await page.locator('.holdings-traits').count() ? await page.locator('.holdings-traits').boundingBox() : null
  const tableBox = await page.locator(width >= 1280 ? '.view-table' : '.symbol-table__cards').boundingBox()
  if (payload === 'sizes') check(!traitsBox, `${label}：沒勾持股特色就沒有那一段`)
  else check(!!traitsBox && traitsBox.y < tableBox.y, `${label}：持股特色在表格上面`)
  if (payload === 'market') {
    const tags = (await page.locator('.holdings-traits__tag').allInnerTexts()).map(text => text.trim())
    const tagText = await page.locator('.holdings-traits__tags').innerText()
    const metricHeaders = (await page.locator('.holdings-traits__metrics thead th').allInnerTexts()).map(text => text.trim())
    check(JSON.stringify(metricHeaders) === '["指標","這組持股","大盤"]', `${label}：大盤到了，指標表是三欄（${metricHeaders.join('、')}）`)
    check(JSON.stringify(tags) === '["低 Beta","高殖利率","低本益比","低股價淨值比","持股集中"]', `${label}：比大盤的標籤照規則出現（${tags.join('、')}）`)
    check(!/\d/.test(tagText), `${label}：標籤只有名字，數字只在表格與九宮格出現一次`)
    // 上下兩層（使用者在三種排法裡選的）：上層九宮格兩張（寬時並排、各占一半寬、在自己那一半置中；窄時上下疊），下層指標表全寬
    const boxes = page.locator('.holdings-traits__box')
    const cores = await Promise.all([0, 1].map(async index => (await boxes.nth(index).locator('tbody tr').first().locator('td').nth(1).innerText()).trim()))
    check(await boxes.count() === 2 && cores.join() === '100%,50%', `${label}：九宮格兩張，這組持股的大型混合 100%、大盤的 50%（${cores.join('、')}）`)
    const [figureBox, metricsBox, own, market] = await Promise.all([page.locator('.holdings-traits__boxes'), page.locator('.holdings-traits__metrics'), boxes.nth(0), boxes.nth(1)].map(locator => locator.boundingBox()))
    // 兩張中間的 vs（使用者：「中間希望加上 vs」）
    const vs = await page.locator('.holdings-traits__vs').boundingBox()
    if (width >= 1280) {
      const [leftGap, rightGap] = [own.x - figureBox.x, figureBox.x + figureBox.width - (market.x + market.width)]
      check(own.y === market.y && market.x >= own.x + own.width && Math.abs(leftGap - rightGap) < 2, `${label}：兩張並排、左右對稱（左右留白 ${leftGap.toFixed(0)}／${rightGap.toFixed(0)}）`)
      check(!!vs && vs.x >= own.x + own.width && vs.x + vs.width <= market.x && Math.abs(vs.x + vs.width / 2 - (figureBox.x + figureBox.width / 2)) < 2, `${label}：vs 在兩張正中間`)
      // 表格的數字在自己那張九宮格正下方（使用者：「希望底下表格的數字可以對應到上面九宮格的位置」）：文字中心對格子的中心
      const offsets = await page.evaluate(() => {
        const textCenter = (element) => { const range = document.createRange(); range.selectNodeContents(element); const rect = range.getBoundingClientRect(); return rect.left + rect.width / 2 }
        const tilesCenter = (table) => { const cells = table.querySelectorAll('tbody tr:first-child td'); return (cells[0].getBoundingClientRect().left + cells[2].getBoundingClientRect().right) / 2 }
        const [ownTable, marketTable] = document.querySelectorAll('.holdings-traits__box')
        return [...document.querySelectorAll('.holdings-traits__metrics tbody tr')].map(row => [textCenter(row.querySelector('.holdings-traits__own')) - tilesCenter(ownTable), textCenter(row.querySelector('.holdings-traits__market')) - tilesCenter(marketTable)])
      })
      const worst = Math.max(...offsets.flat().map(Math.abs))
      check(offsets.length === 7 && worst < 3, `${label}：表格每一列的數字都在自己那張九宮格正下方（最大偏差 ${worst.toFixed(1)}px）`)
      const nameCenter = await page.locator('.holdings-traits__metrics tbody th').first().evaluate((element) => { const range = document.createRange(); range.selectNodeContents(element); const rect = range.getBoundingClientRect(); return rect.left + rect.width / 2 })
      check(Math.abs(nameCenter - (vs.x + vs.width / 2)) < 3, `${label}：指標名在中間，對著 vs`)
    } else {
      check(market.y >= own.y + own.height, `${label}：兩張上下疊，大盤在下`)
      check(!!vs && vs.y >= own.y + own.height && vs.y + vs.height <= market.y, `${label}：上下疊時 vs 夾在兩張中間`)
    }
    check(metricsBox.y >= figureBox.y + figureBox.height && Math.abs(metricsBox.width - figureBox.width) < 2, `${label}：指標表在九宮格下面、跟九宮格那一層一樣寬（${metricsBox.width.toFixed(0)}／${figureBox.width.toFixed(0)}）`)
  }
  if (width >= 1280) {
    const headers = (await page.locator('.view-table th').allInnerTexts()).map(text => text.trim()).filter(Boolean)
    if (payload === 'market') {
      check(JSON.stringify(headers) === '["名稱","占比"]', `${label}：各檔只有占比（${headers.join('、')}）`)
    } else if (payload === 'ratios') {
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
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}：九宮格與指標表放得下，沒有橫向捲動`)
  }
  const violations = await axe(page)
  check(violations === '0', `${label}：axe 0（${violations}）`)
  await shot(page, `share-holdings-${payload}-${width}`, true)
  await ctx.close()
}

console.log('加到我的觀察清單（分享頁，2026-10-20）')
const openShare = async (ctx, token) => {
  const page = await ctx.newPage()
  await page.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
  await page.evaluate(target => window.useNuxtApp().$router.push(`/share/${target}`), token)
  await page.waitForURL(`**/share/${token}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  return page
}
const posts = () => calls.filter(call => call.startsWith('POST /watchlist'))
// 沒登入：按下去開登入，對話框寫明會存成哪一組；什麼都不寫入，「要存」記下來
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await mock(ctx)
  const page = await openShare(ctx, TOKEN)
  const before = posts().length
  await page.getByRole('button', { name: '加到我的觀察清單' }).click()
  const dialog = page.getByRole('dialog', { name: '登入' })
  await dialog.waitFor({ timeout: 15000 })
  const reason = (await dialog.locator('.login-dialog__reason').innerText()).trim()
  check(reason === '免費註冊或登入後，這份觀察清單會存成你的觀察清單「存股名單」。', `沒登入：開登入，對話框寫明登入或註冊後會存成哪一組（${reason}）`)
  check(posts().length === before && await page.evaluate(() => sessionStorage.getItem('share-import-pending')) === TOKEN, '沒登入：沒有寫入，記下登入後要存')
  // 對話框與 FirebaseUI 的按鈕有淡入：滑鼠移開、等轉場結束再量，不然量到半透明的字
  await page.mouse.move(0, 0); await page.waitForTimeout(1200)
  const dialogViolations = await axe(page)
  check(dialogViolations === '0', `登入對話框 axe 0（${dialogViolations}；FirebaseUI 的字放到 16px、電子郵件那顆底色調深）`)
  // 在同一個對話框裡登入：回來不用再按，自動存好（清單名「存股名單」撞了，加編號）
  await dialog.locator('.firebaseui-idp-password').click({ timeout: 30000 })
  await dialog.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL); await dialog.locator('.firebaseui-id-submit').click()
  await dialog.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD); await dialog.locator('.firebaseui-id-submit').click()
  const saved = page.locator('.share-page__saved')
  await saved.waitFor({ timeout: 60000 })
  const created = posts().slice(before)
  check(created[0] === 'POST /watchlists 存股名單 2' && created.length === 1 + symbols.length && created.slice(1).every((call, index) => call.endsWith(` ${symbols[index]}`)), `登入後自動存：建「存股名單 2」，照分享的順序加 ${symbols.length} 檔（${created.length} 次寫入）`)
  check((await saved.innerText()).includes('已存成觀察清單「存股名單 2」') && (await saved.getAttribute('href')) === '/watchlist?list=w-new-1', '存好之後按鈕換成連到那一組的連結')
  check(await page.evaluate(() => sessionStorage.getItem('share-import-pending')) === null, '「要存」用過就清掉')
  await ctx.close()
}
// 已登入：按一下就存好，不用填任何東西；持股照分享的順序
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, { holdingsPayload: 'market' })
  const page = await openShare(ctx, TOKEN_H)
  const before = posts().length
  await page.getByRole('button', { name: '加到我的觀察清單' }).click()
  await page.locator('.share-page__saved').waitFor({ timeout: 30000 })
  const created = posts().slice(before)
  check(JSON.stringify(created) === '["POST /watchlists 分享的持股","POST /watchlist w-new-1 0056","POST /watchlist w-new-1 2330"]', `已登入：按一下存成「分享的持股」，0056、2330 照分享的順序（${created.join('｜')}）`)
  // 「已存成觀察清單」的提示正在淡入：等轉場結束再量（提示本身的對比照樣量）
  await page.mouse.move(0, 0); await page.waitForTimeout(1200)
  const violations = await axe(page)
  check(violations === '0', `存好之後 axe 0（${violations}）`)
  // 離開再回來（站內換頁；重新整理會在伺服器端讀分享，攔不到）：這台瀏覽器記得存過、清單也還在，直接顯示連結，不會再存一次
  await page.evaluate(() => window.useNuxtApp().$router.push('/calendar')); await page.waitForURL('**/calendar')
  await page.evaluate(target => window.useNuxtApp().$router.push(`/share/${target}`), TOKEN_H)
  await page.waitForURL(`**/share/${TOKEN_H}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500)
  check(await page.locator('.share-page__saved').count() === 1 && await page.getByRole('button', { name: '加到我的觀察清單' }).count() === 0 && posts().length === before + 3, '回到這一頁直接顯示「已存成觀察清單」，不會重複存')
  await ctx.close()
}

console.log('被擋下的寫入：', JSON.stringify(calls.filter(call => call.startsWith('BLOCKED'))))
await browser.close()
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
