// 從指標目錄挑欄位（SharedMetricColumnPicker，2026-10-20，使用者：「holdings/columns 我要怎麼任意自行加上我要的指標 比如 ROE…
// 能跟篩選那邊一樣可以自由選擇嗎…抽成一個完整元件 讓 watchlist 也是走同樣邏輯」）：
//   - /holdings/columns「新增指標」：搜「ROE」挑近四季 → 存成 =METRIC("roe.TTM")、百分比、2 位；2330 顯示 15.20%、0056（ETF 沒有）是「－」；
//     焦點在新表頭；再挑一次同一個只提示、不存；對話框 axe 0；手機滿版、沒有橫向捲動、Esc 後焦點回到按鈕
//   - /watchlist 欄位設定「＋ 新增欄位」：同一個挑選器，存進觀察清單欄位；額度已滿時先擋、不開挑選器
// 持股、觀察清單、欄位設定、方案全是攔截的假資料；寫入一律擋下並記錄（PUT 的內容拿來比對）。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-metric-columns.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD；DIR=資料夾 會存截圖）
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const base = 'http://localhost:3000'
const dir = process.env.DIR
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

// 預期的欄名照目錄算（「交易所／即時」前綴＋期別），不寫死
const catalog = await (await fetch(`${base}/api/hub/filter-schema`)).json()
const roe = catalog.categories.flatMap(category => category.metrics).find(metric => metric.key === 'roe')
const ROE_LABEL = `${roe.nameSuffix ? `${roe.nameSuffix} ${roe.name}` : roe.name}（近四季）`

const puts = []
const blocked = []
const mock = async (ctx, { watchlistColumnQuota = 8 } = {}) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (p === '/api/core/billing/entitlement' && m === 'GET') return route.fulfill({ json: { tier: 'FREE', source: 'none', status: null, currentPeriodEnd: null, trialEndsAt: null, renewalMode: null, quotas: { watchlistItems: 10, watchlistColumns: watchlistColumnQuota, customHoldingColumns: 10, screenerPresets: 3, columnPresets: 3 }, usage: {} } })
    if (p === '/api/core/portfolios' && m === 'GET') return route.fulfill({ json: { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] } })
    if (p === '/api/core/holdings' && m === 'GET') return route.fulfill({ json: { holdings: [{ symbol: '2330', quantity: 1000, costUnknownQuantity: 0, averageCost: '580.0000', totalCost: '580000', realizedProfitLoss: '0' }, { symbol: '0056', quantity: 2000, costUnknownQuantity: 0, averageCost: '36.5100', totalCost: '73020', realizedProfitLoss: '0' }] } })
    if (p === '/api/core/shares' && m === 'GET') return route.fulfill({ json: { shares: [] } })
    if (p === '/api/core/users/me/holding-columns' && m === 'GET') return route.fulfill({ json: { holdingColumns: { columns: null } } })
    if (p === '/api/core/users/me/watchlist-columns' && m === 'GET') return route.fulfill({ json: { watchlistColumns: { columns: null } } })
    if (p === '/api/core/watchlists' && m === 'GET') return route.fulfill({ json: { watchlists: [{ id: 'w-1', name: '存股名單', position: 0, sourceShareToken: null, createdAt: '2026-10-01T00:00:00Z' }] } })
    if (p === '/api/core/watchlist' && m === 'GET') return route.fulfill({ json: { items: ['2330', '0056'].map(symbol => ({ id: `i-${symbol}`, watchlistId: 'w-1', symbol, note: null, createdAt: 'x', updatedAt: 'y' })) } })
    if ((p === '/api/core/users/me/holding-columns' || p === '/api/core/users/me/watchlist-columns') && m === 'PUT') {
      const body = JSON.parse(req.postData() ?? '{}')
      puts.push({ path: p, columns: body.columns })
      return route.fulfill({ json: p.endsWith('holding-columns') ? { holdingColumns: { columns: body.columns } } : { watchlistColumns: { columns: body.columns } } })
    }
    // 公開的讀取 POST：ROE 2330 是 15.2（%）、0056（ETF）沒有；報價一律 100
    if (p === '/api/core/screener/values' && m === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      const valueOf = (symbol, field) => (field.startsWith('roe.') ? (symbol === '2330' ? '15.2' : null) : field === 'stock.previousClose' ? '98' : '100')
      return route.fulfill({ json: { results: body.symbols.map(symbol => ({ symbol, values: Object.fromEntries(body.columns.map(({ field }) => [field, { value: valueOf(symbol, field), knowledgeDate: '2026-10-16', nullReason: null }])) })) } })
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    blocked.push(`${m} ${p}`)
    return route.abort()
  })
}
const axe = async page => (await new AxeBuilder({ page }).include('.metric-column-picker').analyze()).violations.map(v => `${v.id}(${v.nodes.length})`).join(',') || '0'

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
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  return page
}
// 搜「ROE」、點近四季那一列（英文縮寫要搜得到，第三欄要有東西可以點）
const pickRoe = async (page, dialog) => {
  await dialog.getByRole('textbox', { name: '搜尋指標名稱' }).fill('ROE'); await page.waitForTimeout(300)
  await dialog.locator('.indicator-dialog__item', { hasText: ROE_LABEL }).first().click(); await page.waitForTimeout(1500)
}

console.log(`自訂欄位「新增指標」（1440；預期欄名「${ROE_LABEL}」）`)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx)
  const page = await open(ctx, '/holdings/columns')
  const button = page.getByRole('button', { name: '新增指標' })
  check(await button.isVisible() && await page.getByRole('button', { name: '新增公式' }).isVisible(), '工具列有「新增指標」與「新增公式」兩顆')
  await button.click(); await page.waitForTimeout(800)
  const dialog = page.getByRole('dialog', { name: '新增指標' })
  check(await dialog.isVisible(), '按「新增指標」開挑選器')
  await page.mouse.move(0, 0); await page.waitForTimeout(400)
  const violations = await axe(page)
  check(violations === '0', `挑選器 axe 0（${violations}）`)
  if (dir) await page.screenshot({ path: `${dir}/metric-picker-1440.png` })
  await pickRoe(page, dialog)
  const saved = puts.at(-1)?.columns.at(-1)
  check(saved?.formula === '=METRIC("roe.TTM")' && saved.format === 'percent' && saved.decimals === 2 && saved.label === ROE_LABEL.slice(0, 20), `存成 =METRIC("roe.TTM")、百分比、2 位（${JSON.stringify(saved)}）`)
  check(!(await dialog.isVisible()), '挑完對話框關掉')
  const letter = String.fromCharCode(65 + puts.at(-1).columns.length - 1)
  const cells = await page.evaluate(label => {
    const headers = [...document.querySelectorAll('thead th')].map(th => th.textContent.trim())
    const index = headers.findIndex(text => text.includes(label))
    return [...document.querySelectorAll('tbody tr')].map(tr => `${tr.querySelector('th, td')?.textContent.trim()}｜${tr.children[index]?.textContent.trim()}`)
  }, ROE_LABEL)
  check(cells.some(text => text.includes('2330') && text.endsWith('15.20%')) && cells.some(text => text.includes('0056') && text.endsWith('－')), `新欄：2330 是 15.20%、0056（ETF 沒有這個指標）是「－」（${cells.join('；')}）`)
  check(await page.evaluate(label => document.activeElement?.closest('th')?.textContent.includes(label) ?? false, ROE_LABEL), `焦點移到新的表頭（${letter} 欄）`)
  if (dir) await page.screenshot({ path: `${dir}/metric-column-1440.png` })
  const putCount = puts.length
  await button.click(); await page.waitForTimeout(800)
  await pickRoe(page, dialog)
  check(puts.length === putCount && await page.locator('.el-message', { hasText: '已經在表格裡' }).count() > 0, '再挑同一個：提示「已經在表格裡」，不存')
  await ctx.close()
}

console.log('自訂欄位「新增指標」（375）')
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true, storageState })
  await mock(ctx)
  const page = await open(ctx, '/holdings/columns')
  const button = page.getByRole('button', { name: '新增指標' })
  await button.click(); await page.waitForTimeout(800)
  const box = await page.locator('.el-dialog.metric-column-picker').boundingBox()
  check(box && Math.round(box.x) === 0 && Math.round(box.width) === 375 && Math.round(box.height) === 800, `手機滿版（${box && [box.x, box.y, box.width, box.height].map(Math.round).join('／')}）`)
  check(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) === 0, '沒有橫向捲動')
  if (dir) await page.screenshot({ path: `${dir}/metric-picker-375.png` })
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  check(await page.evaluate(() => document.activeElement?.textContent?.trim()) === '新增指標', 'Esc 關掉之後焦點回到「新增指標」')
  await ctx.close()
}

console.log('觀察清單「＋ 新增欄位」（1440）')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx)
  const page = await open(ctx, '/watchlist')
  await page.getByRole('button', { name: '欄位設定' }).click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: '＋ 新增欄位' }).click(); await page.waitForTimeout(800)
  const dialog = page.getByRole('dialog', { name: '新增欄位' })
  check(await dialog.isVisible(), '欄位設定的「＋ 新增欄位」開同一個挑選器')
  await pickRoe(page, dialog)
  const saved = puts.filter(put => put.path.endsWith('watchlist-columns')).at(-1)?.columns ?? []
  check(saved.some(column => column.field === 'roe.TTM' && column.label === ROE_LABEL), `存進觀察清單欄位：roe.TTM「${ROE_LABEL}」（${saved.map(column => column.field).join('、')}）`)
  await ctx.close()
}

console.log('觀察清單：額度已滿（5 欄）')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
  await mock(ctx, { watchlistColumnQuota: 5 })
  const page = await open(ctx, '/watchlist')
  await page.getByRole('button', { name: '欄位設定' }).click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: '＋ 新增欄位' }).click(); await page.waitForTimeout(800)
  check(!(await page.getByRole('dialog', { name: '新增欄位' }).isVisible()) && await page.locator('.el-message', { hasText: '觀察清單欄位已達目前方案的上限' }).count() > 0, '先擋：提示已達上限、不開挑選器（不再加上去又被收回）')
  await ctx.close()
}

await browser.close()
console.log(`被擋下的寫入： ${JSON.stringify(blocked)}`)
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
