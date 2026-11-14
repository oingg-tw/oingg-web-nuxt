// 持股明細的兩種檢視（2026-11-14，使用者：「持股管理 也要有地方可以切換顯示的欄位，共用欄位設定」，看過設計圖選方案 A：「A很好，請這樣做」）：
//   - 標題列有「損益／指標」切換與分享；選了哪一個記在 cookie，重新整理還是那一個
//   - 損益：一張持股表、全部類別一起；寬螢幕名稱下面一行是代號與類別（00878・ETF），「明細」是無框文字鈕；1280、1440 都放得下、不左右捲；
//     這個檢視不問指標（不呼叫 /etf-screener）
//   - 指標：每一類一段，表格同觀察清單（代號、名稱、那一類的欄位組合）；選單換組合＝那一類的預設；欄位設定有組合就改那一組，基本欄位就新增
//     一組「持股欄位」並設成預設
//   - 手機：損益是持股自己的卡片，指標是篩選的卡片；沒有橫向捲動。2026-11-14 的手機整理：總覽每一列左右（名稱左、金額右）、未計入收成一行、
//     頁首兩顆並排；持股明細的標題列照方案 B（標題、切換、沒有框的分享同一行）；排序照方案 A：損益與指標都是一行字加方向、沒有框，
//     寬螢幕損益的表頭打開指標同一個選單（只有排序）
//   - 重新整理時骨架跟資料一樣高（兩種檢視、寬窄都量；名稱長的 ETF 00878 也在）；登入後沒有 hydration 警告；axe 亮、暗
// 持股、交易紀錄、欄位組合、方案是攔截的假資料（寫入記下來比對，其他寫入一律擋下），指標數字讀真的本機業務中台。
//
// Run: 本機 dev（:3000）與業務中台開著，node --env-file=.env scripts/check-holdings-columns.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD；
// BASE= 換伺服器；DIR=資料夾 存截圖）
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
const dir = process.env.DIR
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const preset = (id, name, isDefault, fields) => ({ id, name, isDefault, columns: fields.map(field => ({ field })), createdAt: 'x', updatedAt: 'y' })
const MIXED = ['2330', '0050', '00878', '2881A']
const newState = symbols => ({
  symbols,
  presets: {
    common: [preset('c1', '估值兩欄', true, ['peRatio.TTM', 'grossMargin.Q']), preset('c2', '反過來', false, ['grossMargin.Q', 'peRatio.TTM'])],
    etf: [preset('e1', '看配息與成本', true, ['trailing12MonthDistributionYieldPct.snapshot', 'premiumDiscountPct.snapshot'])],
    preferred: []
  },
  writes: [],
  blocked: [],
  etfReads: 0,
  delayMs: 0
})
const holding = symbol => ({ symbol, quantity: 1000, costUnknownQuantity: 0, averageCost: '50.0000', totalCost: '50000', realizedProfitLoss: '0', close: '100', tradeDate: '2026-11-13', dayClose: '100', dayCloseTradeDate: '2026-11-13', previousClose: '98' })
const tx = symbol => ({ id: `t-${symbol}`, portfolioId: 'p-a', symbol, action: 'BUY', quantity: 1000, price: '50', fee: '20', tax: '0', tradeDate: '2024-01-12', note: null, source: null, externalRef: null, importId: null, costUnknown: false })

const mock = (ctx, state) => ctx.route('**/*', async (route) => {
  const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
  const body = () => JSON.parse(req.postData() ?? '{}')
  if (p === '/api/core/billing/entitlement' && m === 'GET') return route.fulfill({ json: { tier: 'FREE', source: 'none', status: null, currentPeriodEnd: null, trialEndsAt: null, renewalMode: null, quotas: { watchlistItems: 10, customHoldingColumns: 10, screenerPresets: 3, columnPresets: 5 }, usage: {} } })
  if (p === '/api/core/billing/plans' && m === 'GET') return route.fulfill({ json: { plans: [] } })
  if (p === '/api/core/portfolios' && m === 'GET') return route.fulfill({ json: { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] } })
  if (p === '/api/core/holdings' && m === 'GET') {
    if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs))
    return route.fulfill({ json: { holdings: state.symbols.map(holding) } })
  }
  if (p === '/api/core/transactions' && m === 'GET') return route.fulfill({ json: { transactions: [tx(url.searchParams.get('symbol'))] } })
  if (p === '/api/core/shares' && m === 'GET') return route.fulfill({ json: { shares: [] } })
  if (p === '/api/core/screener/column-presets' && m === 'GET') return route.fulfill({ json: { columnPresets: state.presets[url.searchParams.get('universe')] } })
  if (p === '/api/core/screener/column-presets' && m === 'POST') {
    const { universe, name, columns } = body()
    state.writes.push(`POST ${universe} ${name} ${columns.map(column => column.field).join(',')}`)
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
    Object.assign(list.find(item => item.id === id), patch)
    return route.fulfill({ json: { columnPreset: list.find(item => item.id === id) } })
  }
  if (p === '/api/core/etf-screener') state.etfReads++
  if (m === 'GET' || p === '/api/core/screener/values' || p === '/api/core/etf-screener' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
  state.blocked.push(`${m} ${p}`)
  return route.abort()
})

const browser = await chromium.launch()
const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await mock(loginContext, newState(['2330']))
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

const newContext = async (width, state, { view, dark } = {}) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, storageState, isMobile: width < 768, hasTouch: width < 768 })
  if (view) await ctx.addCookies([{ name: 'holdings-view', value: view, url: base }])
  if (dark) await ctx.addCookies([{ name: 'theme-mode', value: '%22DARK%22', url: base }])
  await mock(ctx, state)
  return ctx
}
const settled = async (page) => {
  await page.waitForFunction(() => !document.querySelector('.holdings-page__list-head .app-skeleton, .view-table .app-skeleton, .holdings-kind .app-skeleton'), null, { timeout: 60000 })
  await page.waitForTimeout(2500)
}
// 登入後的 hydration（check-hydration.mjs 只開訪客版）：每一頁、每次重新整理都聽主控台
const hydration = []
const open = async (ctx) => {
  const page = await ctx.newPage()
  page.on('console', (message) => { if (/hydrat|mismatch/i.test(message.text())) hydration.push(message.text().slice(0, 200)) })
  await page.goto(`${base}/holdings`, { waitUntil: 'networkidle', timeout: 180000 })
  await settled(page)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  return page
}
const shot = (page, name) => (dir ? page.screenshot({ path: `${dir}/holdings-columns-${name}.png`, fullPage: true }) : null)
const axe = async (page, include) => (await new AxeBuilder({ page }).include(include).analyze()).violations.map(v => `${v.id}(${v.nodes.length})`).join(',') || '0'
const sectionOf = (page, label) => page.locator(`.holdings-kind[aria-label="${label}"]`)
// 表頭按鈕後面藏著給讀屏的排序狀態（「，由大到小排序中」），只比欄名
const pnlHeaders = page => page.locator('.view-table .el-table__header-wrapper thead th:not(.symbol-table__expand-col)').allInnerTexts().then(list => list.map(text => text.split('，')[0].trim()))
const metricHeaders = section => section.locator('.smt-table-view .el-table__header-wrapper thead th').allInnerTexts().then(list => list.map(text => text.trim()))
const metricCell = async (section, symbol, header) => {
  const headers = await metricHeaders(section)
  return (await section.locator('.smt-table-view .el-table__body tr.el-table__row', { hasText: symbol }).locator('td').nth(headers.findIndex(text => text.startsWith(header))).innerText()).trim()
}
const pick = async (page, section, name) => {
  await section.locator('.column-set-menu__button').click()
  await section.locator('.column-set-menu__panel').getByRole('button', { name, exact: true }).click()
  await page.waitForTimeout(2000)
}
const saveWithout = async (page, section, column) => {
  await section.locator('.smt-toolbar__settings').click()
  const dialog = page.getByRole('dialog', { name: '欄位設定' })
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: new RegExp(`移除「${column}」`) }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.waitForTimeout(2000)
}
const HOLDING_HEADERS = ['名稱', '股數', '市值', '今日漲跌', '未實現損益', '報酬率', '預估年股利']
// 表頭黏在頁首下面，同篩選（2026-11-14「為什麼股票篩選表格可以貼頂表頭 但是 持股明細表格沒有貼頂」）：捲到表格裡 40px，量表頭離頁首下緣多遠。
// 量的時候視窗矮一點：四檔的頁面在 900 高時捲不到那麼深
const stuckGap = async (page, selector) => {
  const size = page.viewportSize()
  await page.setViewportSize({ width: size.width, height: 420 })
  const gap = await page.evaluate(async (sel) => {
    const table = document.querySelector(sel)
    const root = getComputedStyle(document.documentElement)
    const top = (parseFloat(root.getPropertyValue('--app-header-height')) || 0) + (parseFloat(root.getPropertyValue('--app-banner-height')) || 0)
    window.scrollTo(0, table.getBoundingClientRect().top + window.scrollY - top + 40)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return Math.round(table.querySelector('.el-table__header-wrapper').getBoundingClientRect().top - top)
  }, selector)
  await page.setViewportSize(size)
  return gap
}

console.log('損益（1440，預設）')
{
  const state = newState(MIXED)
  const ctx = await newContext(1440, state)
  const page = await open(ctx)
  check(await page.getByRole('radio', { name: '損益' }).isChecked(), '標題列的切換在「損益」')
  check(await page.locator('.holdings-page__list-head .shared-share__button').count() === 1, '分享在標題列')
  check(await page.locator('.holdings-kind').count() === 0 && await page.locator('.view-table').count() === 1, '一張表，不分段')
  const headers = await pnlHeaders(page)
  check(HOLDING_HEADERS.every((header, i) => headers[i] === header), `持股的欄：${headers.join(',')}`)
  const subs = await page.locator('.view-table .el-table__body .symbol-table__sub').allInnerTexts()
  check(['2330', '0050・ETF', '00878・ETF', '2881A・特別股'].every(text => subs.includes(text)), `名稱下面是代號與類別：${subs.join('、')}`)
  check(await page.locator('.view-table .el-tag').count() === 0, '表格裡不再有類別標籤')
  check(await page.locator('.view-table .el-table__body td .el-button.is-text[aria-expanded]').count() === 4, '「明細」是無框文字鈕')
  // 最後一列沒有底線（全站表格），少 1px，不算
  const heights = await page.locator('.view-table .el-table__body tr.el-table__row').evaluateAll(rows => rows.slice(0, -1).map(row => Math.round(row.getBoundingClientRect().height)))
  check(new Set(heights).size === 1, `每列一樣高，名稱長的 00878 也是（${heights.join('、')}）`)
  const overflow = await page.evaluate(() => { const wrap = document.querySelector('.view-table .el-scrollbar__wrap'); return wrap.scrollWidth - wrap.clientWidth })
  check(overflow <= 0, `放得下、不左右捲（${overflow}）`)
  check(state.etfReads === 0, `損益檢視不問指標（/etf-screener ${state.etfReads} 次）`)
  await shot(page, 'pnl-1440')
  check(await axe(page, '.holdings-page__list-head, .view-table') === '0', 'axe（損益）')
  // 方案 A（2026-11-14）：點表頭打開指標檢視同一個選單，只有排序；選了表格照著排（代號由大到小：2881A 在最前面）
  const nameHead = page.locator('.view-table .symbol-table__head', { hasText: '名稱' })
  await nameHead.click()
  const menuItems = (await page.locator('[role="menu"] [role="menuitem"]:visible').allInnerTexts()).map(text => text.replace(/\s+/g, ''))
  await page.locator('[role="menu"] [role="menuitem"]:visible', { hasText: '由大到小' }).click()
  await page.waitForTimeout(300)
  const firstRow = (await page.locator('.view-table .el-table__body tr.el-table__row').first().innerText()).replace(/\s+/g, ' ')
  check(menuItems.join('、') === '↑由小到大、↓由大到小' && firstRow.includes('2881A') && (await nameHead.innerText()).includes('由大到小排序中'), `表頭選單只有排序，選了照著排（${menuItems.join('、')}；第一列 ${firstRow.slice(0, 20)}）`)
  const pnlGap = await stuckGap(page, '.view-table')
  check(pnlGap === 0, `損益：捲到表格中段，表頭黏在頁首下面（差 ${pnlGap}px）`)
  await page.evaluate(() => window.scrollTo(0, 0))

  console.log('切到指標')
  await page.locator('.el-radio-button', { hasText: '指標' }).click()
  await settled(page)
  check((await ctx.cookies()).find(cookie => cookie.name === 'holdings-view')?.value === 'metrics', '記在 cookie')
  const labels = await page.locator('.holdings-kind').evaluateAll(list => list.map(el => el.getAttribute('aria-label')))
  check(JSON.stringify(labels) === '["普通股","ETF","特別股"]', `三段依序：${labels}`)
  check(JSON.stringify(await page.locator('.holdings-kind__title').allInnerTexts()) === '["普通股1 檔","ETF2 檔","特別股1 檔"]', '每段的標題寫檔數')
  const common = sectionOf(page, '普通股')
  const commonHeaders = await metricHeaders(common)
  check(commonHeaders[0] === '代號' && commonHeaders[1] === '名稱' && commonHeaders[2].startsWith('本益比') && commonHeaders[3].startsWith('毛利率') && commonHeaders.length === 4, `代號、名稱接那一類的欄位組合，沒有持股的欄：${commonHeaders.join(',')}`)
  const pe = await metricCell(common, '2330', '本益比')
  const gm = await metricCell(common, '2330', '毛利率')
  check(/\d/.test(pe) && gm.endsWith('%'), `指標有值：本益比 ${pe}、毛利率 ${gm}`)
  check(state.etfReads > 0, '切到指標才問 ETF 的數字')
  check(await common.locator('.column-set-menu__button').getAttribute('aria-label') === '普通股的欄位：估值兩欄', '分段時念出是哪一類的欄位')
  await shot(page, 'metrics-1440')
  check(await axe(page, '.holdings-page__metrics') === '0', 'axe（指標）')

  await pick(page, common, '反過來')
  check(state.writes.at(-1) === 'PATCH c2 {"isDefault":true}', `選一組＝那一類的預設（${state.writes.at(-1)}）`)
  const swapped = await metricHeaders(common)
  check(swapped[2].startsWith('毛利率') && swapped[3].startsWith('本益比'), `換順序：${swapped.join(',')}`)
  await saveWithout(page, sectionOf(page, 'ETF'), '折溢價率')
  check(state.writes.at(-1) === 'PATCH e1 {"columns":[{"field":"trailing12MonthDistributionYieldPct.snapshot"}]}', `有組合：改那一組（${state.writes.at(-1)}）`)
  await saveWithout(page, sectionOf(page, '特別股'), '最差殖利率 YTW')
  check(state.writes.some(write => write.startsWith('POST preferred 持股欄位 ') && !write.includes('ytwPct')), `基本欄位：新增一組「持股欄位」（${state.writes.filter(write => write.startsWith('POST')).join('｜')}）`)
  check(state.writes.at(-1) === 'PATCH new-preferred {"isDefault":true}', '新增的那組設成預設')
  check(state.blocked.length === 0, `沒有其他寫入（${state.blocked.join(',') || '無'}）`)
  await ctx.close()

  const darkContext = await newContext(1440, newState(MIXED), { dark: true, view: 'metrics' })
  const dark = await open(darkContext)
  check(await axe(dark, '.holdings-page__metrics') === '0', 'axe（指標、暗）')
  await dark.locator('.el-radio-button', { hasText: '損益' }).click()
  await settled(dark)
  check(await axe(dark, '.holdings-page__list-head, .view-table') === '0', 'axe（損益、暗）')
  await darkContext.close()
}

console.log('損益（1280）')
{
  const ctx = await newContext(1280, newState(MIXED))
  const page = await open(ctx)
  const overflow = await page.evaluate(() => { const wrap = document.querySelector('.view-table .el-scrollbar__wrap'); return wrap.scrollWidth - wrap.clientWidth })
  check(overflow <= 0, `表格最窄的寬度也放得下（${overflow}）`)
  await ctx.close()
}

console.log('只有普通股（指標）')
{
  const ctx = await newContext(1440, newState(['2330', '2317']), { view: 'metrics' })
  const page = await open(ctx)
  check(await page.locator('.holdings-kind').count() === 1 && await page.locator('.holdings-kind__title').count() === 0, '一段、沒有標題')
  check(await page.locator('.column-set-menu__button').getAttribute('aria-label') === null, '只有一段時念按鈕上的字')
  await ctx.close()
}

console.log('手機（375）')
{
  const ctx = await newContext(375, newState(MIXED))
  const page = await open(ctx)
  check(await page.locator('.symbol-table__card:visible').count() === 4, '損益：持股卡片')
  check(await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth) <= 0, '損益：沒有橫向捲動')
  // 手機整理（2026-11-14）：總覽每一列左右（使用者：「可以跟電腦版一樣左右印刷嗎?」選了「每一列左右」）——名稱同一條左線、金額同一條右線、
  // 名稱跟它的金額同一行；未計入收成一行、頁首兩顆並排；持股明細的標題列照方案 B：375 寬不到 10 檔時標題、切換、分享同一行，
  // 分享是沒有框的一行字、靠右；排序照方案 A 是一行字加方向
  const phone = await page.evaluate(() => {
    const box = el => el.getBoundingClientRect()
    const label = text => [...document.querySelectorAll('.holdings-overview__row dt, .holdings-overview__yield-label')].find(el => el.textContent.trim() === text)
    const amounts = [...document.querySelectorAll('.holdings-overview__row dd:first-of-type')]
    const midOf = el => box(el).top + box(el).height / 2
    const buttons = [...document.querySelectorAll('.holdings-page__actions .el-button')].map(box)
    const excluded = [...document.querySelectorAll('.holdings-page__excluded')].find(el => el.offsetParent !== null)
    const head = document.querySelector('.holdings-page__list-head')
    const share = head.querySelector('.shared-share__button')
    const mid = el => Math.round(box(el).top + box(el).height / 2)
    const sort = document.querySelector('.symbol-table__sort')
    return {
      lefts: ['未實現損益', '今日漲跌', '預估年度股利', '殖利率'].map(text => Math.round(box(label(text)).left)),
      rights: amounts.map(el => Math.round(box(el).right)),
      sameLine: Math.round(Math.abs(midOf(label('未實現損益')) - midOf(amounts[0]))),
      buttons: buttons.map(rect => `${Math.round(rect.top)}+${Math.round(rect.width)}`),
      excluded: excluded && `${excluded.tagName} ${excluded.querySelector('summary')?.textContent.trim()} ${excluded.open}`,
      oneRow: [head.querySelector('.holdings-page__section-title'), head.querySelector('.holdings-page__view'), share].map(mid).every((value, _, all) => Math.abs(value - all[0]) <= 2),
      shareRight: Math.round(box(head).right - box(share).right),
      shareFrame: getComputedStyle(share).borderTopColor,
      sortText: sort.querySelector('span').textContent.trim(),
      direction: document.querySelector('.symbol-table__direction').textContent.replace('排序方向：', '').trim(),
      sortGap: Math.round(box(sort).top - box(head).bottom)
    }
  })
  check(new Set(phone.lefts).size === 1 && new Set(phone.rights).size === 1 && phone.sameLine <= 4, `總覽每一列左右：名稱同一條左線、金額同一條右線、同一行（${phone.lefts.join('／')}；${phone.rights.join('／')}；差 ${phone.sameLine}px）`)
  check(phone.buttons.length === 2 && phone.buttons[0] === phone.buttons[1], `頁首兩顆同一行、一樣寬（${phone.buttons.join('／')}）`)
  check(phone.excluded === 'DETAILS 未計入：4 檔無股利資料 false', `未計入收成一行（${phone.excluded}）`)
  await page.locator('.holdings-page__excluded summary:visible').click()
  check(/2330/.test(await page.locator('.holdings-page__excluded:visible p').innerText()), '打開未計入：列出是哪幾檔')
  check(phone.oneRow && phone.shareRight === 0 && phone.shareFrame === 'rgba(0, 0, 0, 0)', `標題、切換、分享同一行，分享靠右、沒有框（${phone.oneRow}／${phone.shareRight}px／${phone.shareFrame}）`)
  check(phone.sortText === '排序：市值' && phone.direction === '大到小' && phone.sortGap === 4, `排序是一行字加方向、貼著標題列（${phone.sortText}・${phone.direction}，${phone.sortGap}px）`)
  // 字是畫的、select 透明疊在上面：換排序照樣是原生選單；換欄時方向回到那一欄的預設（代號小到大），方向鍵再反過來
  await page.getByLabel('排序', { exact: true }).selectOption({ label: '代號' })
  const firstCard = () => page.locator('.symbol-table__card:visible').first().innerText()
  const directionText = () => page.locator('.symbol-table__direction').innerText().then(text => text.replace('排序方向：', '').trim())
  check(await page.locator('.symbol-table__sort span').first().innerText() === '排序：代號' && await directionText() === '小到大' && (await firstCard()).includes('0050'), '換排序：字跟著換、代號小到大')
  await page.locator('.symbol-table__direction').click()
  check(await directionText() === '大到小' && (await firstCard()).includes('2881A'), '方向鍵：代號大到小，2881A 在最前面')
  await page.locator('.el-radio-button', { hasText: '指標' }).click()
  await settled(page)
  check(await page.locator('.holdings-kind .smt-card:visible').count() === 4 && await page.locator('.holdings-kind .smt-table-view:visible').count() === 0, '指標：篩選的卡片')
  check(await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth) <= 0, '指標：沒有橫向捲動')
  await shot(page, 'metrics-375')
  check(await axe(page, '.holdings-page__metrics') === '0', 'axe（指標卡片）')
  await ctx.close()
}

console.log('重新整理不推動版面（第二次來）')
const measure = page => page.evaluate(() => {
  const top = el => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null)
  const visible = list => [...list].find(el => el.offsetParent !== null)
  const boxes = [...document.querySelectorAll('.holdings-kind')].map(section => `${section.getAttribute('aria-label')}@${top(section)}+${Math.round(section.getBoundingClientRect().height)}`)
  const table = visible(document.querySelectorAll('.view-table, .symbol-table__cards'))
  return { blocks: boxes.length ? boxes.join(' ') : `表@${top(table)}+${Math.round(table?.getBoundingClientRect().height ?? 0)}`, below: top(document.querySelector('.holdings-page__method')) }
})
for (const [width, view] of [[1440, 'pnl'], [1280, 'pnl'], [1440, 'metrics'], [375, 'pnl'], [375, 'metrics']]) {
  const state = newState(MIXED)
  const ctx = await newContext(width, state, { view })
  const page = await open(ctx)
  state.delayMs = 4000
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
  await page.waitForTimeout(1200)
  const skeleton = await measure(page)
  const wasSkeleton = await page.evaluate(() => !!document.querySelector('.view-table .app-skeleton, .symbol-table__cards .app-skeleton, .holdings-kind .app-skeleton'))
  await settled(page)
  const real = await measure(page)
  check(wasSkeleton && skeleton.blocks === real.blocks && skeleton.below === real.below, `${width} ${view}：${skeleton.blocks} → ${real.blocks}；計算方式 ${skeleton.below} → ${real.below}`)
  await ctx.close()
}

check(hydration.length === 0, `登入後沒有 hydration 警告（${hydration.join('｜') || '無'}）`)
await browser.close()
console.log(failures ? `\n${failures} 項沒過` : '\n全部通過')
process.exit(failures ? 1 : 0)
