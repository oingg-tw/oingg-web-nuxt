// 觀察清單依類別分段，欄位組合跟篩選共用（2026-11-06，使用者選方案 B：「這樣就可以跟篩選那邊的欄位設定共用一套，簡化管理」）：
//   - 混合清單分成普通股、ETF、特別股三段，每一段先是固定欄（收盤價、漲跌、除息／發放），各段讀得到自己的數字
//   - 只有一種類別時沒有分段標題；ETF 只問清單上的 ETF，一次 200 檔；不再碰 /users/me/watchlist-columns
//   - 顯示欄位：選一組＝那一類的 isDefault，選基本欄位＝清掉；欄位設定：有組合就改那一組，基本欄位就新增一組並設成預設，額度滿了開額度彈窗
//   - ETF 讀不到時只有 ETF 那一段空著，普通股照常顯示
//   - 訪客沒有選單，欄位設定是登入；手機是對齊的四欄表、沒有橫向捲動；分享頁同樣分段、不送已經持有
// 2026-11-07 改版（使用者看過方案頁選 A，再加 B 的「今天」）：每一類的工具收成一顆「欄位」選單（顯示欄位、到篩選管理），
// 備註與移除收進「編輯」（「今天」那一塊 2026-11-08 拿掉：使用者「觀察清單移除summary」）。
// 2026-11-11 表格換成篩選的結果表（SharedMetricTable，使用者：「以篩選那邊的表格為主」，電腦版「拿掉，跟篩選一樣」、手機「改成篩選的
// 卡片」）：欄位設定是表格自己的按鈕，窄的時候是卡片與排序列；河道位置有七格軌道（使用者的例子：淨值比河流圖原本是原始文字），格子連到指標頁
// 清單、欄位組合、方案、分享是攔截的假資料（寫入記下來比對），報價、ETF、特別股讀真的本機業務中台。
//
// Run: 本機 dev（:3000）與業務中台開著，node --env-file=.env scripts/check-watchlist-sections.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD；
// BASE= 換伺服器；DIR=資料夾 存截圖）
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
const dir = process.env.DIR
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const MIXED = ['2330', '0050', '2881A']
const TOKEN = 'Zq3x9VbN1mKp7RtY2wLc8A'
const FIXED_HEADERS = ['代號', '名稱', '收盤價', '漲跌', '除息／發放']
const SHARE = {
  kind: 'watchlist',
  name: '朋友的清單',
  columns: [
    { key: 'stock.price', label: '收盤價' },
    { key: 'watchlist.change', label: '漲跌' },
    { key: 'exchangePeRatio.EOD', label: '普通股・本益比' },
    { key: 'aum.snapshot', label: 'ETF・規模' },
    { key: 'holding.portfolioNames.snapshot', label: 'ETF・持有帳戶' },
    { key: 'nominalDividendRatePct.snapshot', label: '特別股・票面利率' }
  ],
  items: MIXED.map(symbol => ({ symbol, note: null }))
}

const preset = (id, name, isDefault, fields) => ({ id, name, isDefault, columns: fields.map(field => ({ field })), createdAt: 'x', updatedAt: 'y' })
const newState = (items = MIXED) => ({
  items,
  presets: { common: [], etf: [preset('e1', '看配息與成本', false, ['trailing12MonthDistributionYieldPct.snapshot', 'premiumDiscountPct.snapshot'])], preferred: [] },
  writes: [],
  etfBodies: [],
  oldApi: 0,
  quotaFull: false,
  blocked: []
})

const mock = (ctx, state) => ctx.route('**/*', async (route) => {
  const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
  const body = () => JSON.parse(req.postData() ?? '{}')
  if (p === '/api/core/billing/entitlement' && m === 'GET') return route.fulfill({ json: { tier: 'FREE', source: 'none', status: null, currentPeriodEnd: null, trialEndsAt: null, renewalMode: null, quotas: { watchlistItems: 10, customHoldingColumns: 10, screenerPresets: 3, columnPresets: 3 }, usage: {} } })
  if (p === '/api/core/billing/plans' && m === 'GET') return route.fulfill({ json: { plans: [] } })
  if (p === '/api/core/shares' && m === 'GET') return route.fulfill({ json: { shares: [] } })
  if (p === '/api/core/watchlists' && m === 'GET') return route.fulfill({ json: { watchlists: [{ id: 'w-1', name: '存股名單', position: 0, sourceShareToken: null, createdAt: '2026-10-01T00:00:00Z' }] } })
  if (p === '/api/core/watchlist' && m === 'GET') return route.fulfill({ json: { items: state.items.map(symbol => ({ id: `i-${symbol}`, watchlistId: 'w-1', symbol, note: null, createdAt: 'x', updatedAt: 'y' })) } })
  if (p === '/api/core/users/me/watchlist-columns') {
    state.oldApi++
    return route.abort()
  }
  if (p === '/api/core/screener/column-presets' && m === 'GET') return route.fulfill({ json: { columnPresets: state.presets[url.searchParams.get('universe')] } })
  if (p === '/api/core/screener/column-presets' && m === 'POST') {
    const { universe, name, columns } = body()
    state.writes.push(`POST ${universe} ${name} ${columns.map(column => column.field).join(',')}`)
    if (state.quotaFull) return route.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Forbidden', status: 403, code: 'quota_exceeded' }) })
    const created = preset(`new-${universe}`, name, false, columns.map(column => column.field))
    state.presets[universe].push(created)
    return route.fulfill({ json: { columnPreset: created } })
  }
  if (p.startsWith('/api/core/screener/column-presets/') && m === 'PATCH') {
    const id = p.split('/').at(-1)
    const patch = body()
    state.writes.push(`PATCH ${id} ${JSON.stringify(patch)}`)
    const list = Object.values(state.presets).find(sets => sets.some(set => set.id === id))
    if (patch.isDefault === true) for (const set of list) set.isDefault = false
    const set = list.find(item => item.id === id)
    Object.assign(set, patch)
    return route.fulfill({ json: { columnPreset: set } })
  }
  if (p === '/api/core/etf-screener' && m === 'POST') {
    state.etfBodies.push(body())
    return route.continue()
  }
  if (p === `/api/core/public/shares/${TOKEN}`) return route.fulfill({ json: SHARE })
  if (m === 'GET' || p === '/api/core/screener/values' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
  state.blocked.push(`${m} ${p}`)
  return route.abort()
})

const browser = await chromium.launch()
const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await mock(loginContext, newState())
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

const open = async (ctx, path, ready = '.watchlist-page__count') => {
  const page = await ctx.newPage()
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator(ready).first().waitFor({ state: 'visible', timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.app-skeleton'), null, { timeout: 60000 })
  await page.waitForTimeout(800)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  return page
}
const shot = (page, name) => (dir ? page.screenshot({ path: `${dir}/watchlist-${name}.png`, fullPage: true }) : null)
const headersOf = section => section.locator('.smt-table-view .el-table__header-wrapper thead th').allInnerTexts().then(list => list.map(text => text.trim()))
// 基金月報的欄名帶月份（規模 2026-09）
const sameHeader = (text, header) => text === header || text.startsWith(`${header} `)
const sectionOf = (page, label) => page.locator(`.watchlist-section[aria-label="${label}"]`)
const cellOf = async (section, rowName, header) => {
  const headers = await headersOf(section)
  const row = section.locator('.smt-table-view .el-table__body tr.el-table__row', { hasText: rowName })
  return (await row.locator('td').nth(headers.findIndex(text => sameHeader(text, header))).innerText()).trim()
}
const openMenu = async (section) => {
  await section.locator('.watchlist-columns__button').click()
  return section.locator('.watchlist-columns__panel')
}
const pick = async (page, section, name) => {
  await (await openMenu(section)).getByRole('button', { name, exact: true }).click()
  await page.waitForTimeout(1500)
}
const openSettings = section => section.locator('.smt-toolbar__settings').click()

console.log('混合清單（1440）')
{
  const state = newState()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, state)
  const page = await open(ctx, '/watchlist')
  const titles = await page.locator('.watchlist-section__title').allInnerTexts()
  check(titles.join('|').replace(/\s/g, '') === '普通股1檔|ETF1檔|特別股1檔', `三段依序（${titles.join('、')}）`)
  const common = sectionOf(page, '普通股')
  const etf = sectionOf(page, 'ETF')
  const preferred = sectionOf(page, '特別股')
  for (const [name, section] of [['普通股', common], ['ETF', etf], ['特別股', preferred]]) {
    const headers = await headersOf(section)
    check(FIXED_HEADERS.every((header, index) => headers[index] === header), `${name}：固定欄在最前面（${headers.join('、')}）`)
  }
  check(/^\d/.test(await cellOf(common, '台積電', '本益比')), '普通股讀得到本益比')
  check(/^\d/.test(await cellOf(etf, '0050', '規模')), 'ETF 讀得到規模')
  check(/^\d/.test(await cellOf(preferred, '2881A', '票面利率')), '特別股讀得到票面利率')
  check(/^\d/.test(await cellOf(etf, '0050', '收盤價')) && !(await headersOf(etf)).slice(5).includes('收盤價'), '收盤價不重複畫')
  const asked = state.etfBodies.at(-1)
  check(asked?.symbols?.join() === '0050' && asked?.pageSize === 200, `ETF 只問清單上的 ETF、一次 200 檔（${JSON.stringify(asked?.symbols)}、${asked?.pageSize}）`)
  check(state.oldApi === 0, '不再碰 /users/me/watchlist-columns')
  await shot(page, 'mixed-1440')

  // 備註與移除收進編輯
  check(await page.locator('.smt-table-view .smt-actions').count() === 0, '平常沒有備註、移除')
  await page.getByRole('button', { name: '編輯', exact: true }).click()
  check(await page.locator('.smt-table-view .smt-actions').count() === 3 && (await headersOf(common)).at(-1) === '操作', '按編輯才有操作欄（備註、移除）')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  check(await page.locator('.smt-table-view .smt-actions').count() === 0, '按完成收起來')
  // 欄位選單：寫著現在用哪一組；Esc 關掉、焦點回到按鈕
  const menuButton = common.locator('.watchlist-columns__button')
  check((await menuButton.innerText()).includes('欄位：基本欄位'), `按鈕寫著現在用哪一組（${(await menuButton.innerText()).trim()}）`)
  await menuButton.click()
  check(await menuButton.getAttribute('aria-expanded') === 'true' && await common.locator('.watchlist-columns__panel').isVisible(), '欄位選單打開')
  await page.keyboard.press('Escape')
  check(await menuButton.getAttribute('aria-expanded') === 'false' && await menuButton.evaluate(el => el === document.activeElement), 'Esc 關掉、焦點回到按鈕')

  await pick(page, etf, '看配息與成本')
  check(state.writes.at(-1) === 'PATCH e1 {"isDefault":true}', `選組合＝設成預設（${state.writes.at(-1)}）`)
  check((await headersOf(etf)).includes('折溢價率') && !(await headersOf(etf)).some(text => sameHeader(text, '規模')), '選了組合，欄位跟著換')
  check((await headersOf(common)).includes('本益比'), '別的段不受影響')
  await pick(page, etf, '基本欄位')
  check(state.writes.at(-1) === 'PATCH e1 {"isDefault":false}', `選基本欄位＝清掉預設（${state.writes.at(-1)}）`)

  // 基本欄位沒有組合：欄位設定新增一組並設成預設
  await openSettings(preferred)
  const dialog = page.getByRole('dialog', { name: '欄位設定' })
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: /移除「最差殖利率 YTW」/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.waitForTimeout(1500)
  check(state.writes.some(write => write.startsWith('POST preferred 觀察清單欄位 ') && !write.includes('ytwPct')), '基本欄位改欄位：新增一組')
  check(state.writes.at(-1) === 'PATCH new-preferred {"isDefault":true}', `並設成預設（${state.writes.at(-1)}）`)
  check(!(await headersOf(preferred)).includes('最差殖利率 YTW'), '表格跟著少一欄')

  // 已經有組合：改那一組，不新增
  await pick(page, etf, '看配息與成本')
  await openSettings(etf)
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: /移除「折溢價率」/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.waitForTimeout(1500)
  check(state.writes.at(-1) === 'PATCH e1 {"columns":[{"field":"trailing12MonthDistributionYieldPct.snapshot"}]}', `有組合就改那一組（${state.writes.at(-1)}）`)

  // 額度滿了：開額度彈窗，表格不變
  state.quotaFull = true
  await openSettings(common)
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: /移除「本益比」/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.waitForTimeout(1200)
  check(await page.locator('.quota-dialog').isVisible(), '額度滿了開額度彈窗')
  check((await headersOf(common)).includes('本益比'), '沒存到，表格不變')
  check(state.blocked.length === 0, `沒有意料外的寫入（${state.blocked.join('、')}）`)
  await ctx.close()
}

console.log('ETF 讀不到')
{
  const state = newState()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, state)
  await ctx.route('**/api/core/etf-screener', route => route.fulfill({ status: 502, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Bad Gateway', status: 502 }) }))
  const page = await open(ctx, '/watchlist')
  check(/^\d/.test(await cellOf(sectionOf(page, '普通股'), '台積電', '收盤價')), '普通股照常顯示')
  check(/^\d/.test(await cellOf(sectionOf(page, '特別股'), '2881A', '票面利率')), '特別股照常顯示')
  check(await cellOf(sectionOf(page, 'ETF'), '0050', '收盤價') === '－', 'ETF 空著等重試，不寫成假的數字')
  await ctx.close()
}

console.log('只有一種類別')
{
  const state = newState(['2330', '2317'])
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, state)
  const page = await open(ctx, '/watchlist')
  check(await page.locator('.watchlist-section').count() === 1 && await page.locator('.watchlist-section__title').count() === 0, '一段、沒有標題')
  check(await page.locator('.watchlist-columns__button').count() === 1, '一顆欄位選單')
  check(state.etfBodies.length === 0, `清單沒有 ETF 就不問（${state.etfBodies.length} 次）`)
  await ctx.close()
}

console.log('手機（375）')
{
  const state = newState()
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState })
  await mock(ctx, state)
  const page = await open(ctx, '/watchlist')
  check(await page.locator('.watchlist-section').count() === 3, '三段')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(overflow <= 0, `沒有橫向捲動（多 ${overflow}px）`)
  const etf = sectionOf(page, 'ETF')
  // 同篩選結果的手機：一檔一張卡片，固定欄在前面，排序是卡片上面的排序列
  check(await etf.locator('.smt-card:visible').count() === 1 && await etf.locator('.smt-table-view').isHidden(), '卡片，不是表格')
  const labels = (await etf.locator('.smt-card:visible dt').allInnerTexts()).map(text => text.trim())
  check(labels.slice(0, 3).join('、') === '收盤價、漲跌、除息／發放' && labels.some(text => sameHeader(text, '規模')), `卡片：固定欄在前、ETF 的欄位在後（${labels.join('、')}）`)
  const sortOptions = await etf.locator('.smt-sort__select option').allInnerTexts()
  check(['收盤價', '漲跌', '除息／發放'].every(label => sortOptions.includes(label)) && await etf.locator('.smt-columns-open').isVisible(), `排序列與「欄位 N 個」（${sortOptions.join('、')}）`)
  await page.getByRole('button', { name: '編輯', exact: true }).click()
  check(await etf.locator('.smt-card__actions:visible').count() === 1, '編輯：卡片底下有備註、移除')
  await shot(page, 'mixed-375-edit')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  const violations = (await new AxeBuilder({ page }).include('.watchlist-page').analyze()).violations
  check(violations.length === 0, `axe ${violations.map(item => `${item.id}(${item.nodes.length})`).join('、') || '0'}`)
  await shot(page, 'mixed-375')
  await ctx.close()
}

console.log('跟篩選一樣的格子（1440）')
{
  // 使用者的例子：淨值比河流圖在觀察清單原本是原始文字。普通股用一組「淨值比河流圖、ROE」，報價與數值讀本機業務中台
  const state = newState(['2330'])
  state.presets.common = [preset('c1', '河流圖', true, ['pbRatioRiverBand.5Y_1D', 'roe.TTM'])]
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, state)
  const page = await open(ctx, '/watchlist')
  const common = page.locator('.watchlist-section')
  const headers = await headersOf(common)
  const river = common.locator('.smt-table-view .el-table__body tr.el-table__row').locator('td').nth(headers.findIndex(text => text.startsWith('股價淨值比河流圖') || text.includes('河')))
  check(await river.locator('.screener-result-table__zone-track').count() === 1, `河道位置有七格軌道（${(await river.innerText()).trim()}）`)
  const roe = common.locator('.smt-table-view .el-table__body tr.el-table__row').locator('td').nth(headers.findIndex(text => text.startsWith('ROE')))
  check(await roe.locator('a').getAttribute('href') === '/stock/2330/roe', `格子連到那家公司那支指標的頁（${await roe.locator('a').getAttribute('href')}）`)
  await shot(page, 'river-1440')
  await ctx.close()
}

console.log('訪客')
{
  const state = newState()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await mock(ctx, state)
  const page = await open(ctx, '/watchlist')
  check(await page.locator('.watchlist-section').count() === 1, '市值前 10 大是一段')
  check(await page.locator('.watchlist-columns').count() === 0 && await page.getByRole('button', { name: '編輯', exact: true }).count() === 0, '沒有欄位選單、沒有編輯')
  await page.getByRole('button', { name: '欄位設定' }).click()
  await page.locator('#firebaseui-auth-container').waitFor({ state: 'attached', timeout: 10000 })
  check(await page.getByRole('dialog', { name: '欄位設定' }).count() === 0, '欄位設定是登入')
  await ctx.close()
}

console.log('分享頁')
{
  const state = newState()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await mock(ctx, state)
  // 站內換頁：假資料只攔得到瀏覽器的請求，直接打開是伺服器去問（同 check-share-links）
  const page = await ctx.newPage()
  await page.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.evaluate(token => window.useNuxtApp().$router.push(`/share/${token}`), TOKEN)
  await page.waitForURL(`**/share/${TOKEN}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  const sections = page.locator('.share-page__sections section')
  check(await sections.count() === 3, `三段（${await sections.count()}）`)
  const etf = sections.filter({ hasText: '元大台灣50' })
  const headers = await headersOf(etf)
  check(headers.some(text => sameHeader(text, '規模')) && !headers.includes('本益比') && !headers.includes('票面利率'), `ETF 段只有 ETF 的欄（${headers.join('、')}）`)
  check(!headers.some(header => header.includes('・')), '表頭沒有分享對話框用的類別前綴')
  const sent = (state.etfBodies.at(-1)?.columns ?? []).map(column => column.field)
  check(!sent.some(field => field.startsWith('holding.')), `已經持有不送（訪客會 401）（${sent.join('、')}）`)
  await ctx.close()
}

await browser.close()
if (failures) {
  console.log(`\n${failures} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
