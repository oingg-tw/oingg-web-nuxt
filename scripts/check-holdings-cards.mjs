// 持股的手機卡片（HoldingsSymbolTable 的 view-card，2026-10-20 改版，使用者：「不展開還好，一展開看起來有夠髒」「明細按鈕放在右上角
// 不太順，放在下面反而比較合理」）：
//   - 開關是卡片的頁尾：最後一個元素、整張卡片寬；展開的內容長在它上面
//   - 數字一種排法：卡片的列、明細面板（HoldingsDetailPanel card）、交易紀錄（HoldingsLedger 清單）的數字右緣切齊
//   - 看完長明細才按收合，卡片要捲回看得到的地方（不躲在頁首底下）
//   - 已實現損益頁：「賣出（期間內）」不會被切成兩半；最後一筆不跟頁尾疊兩條線；報酬率（已實現損益 ÷ costBasis）在卡片與答句上
//   - 沒有橫向捲動、axe 0
// 持股與交易紀錄全是攔截的假資料，寫入一律擋下。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-holdings-cards.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD；DIR=資料夾 會存截圖）
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const base = 'http://localhost:3000'
const dir = process.env.DIR
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const tx = (id, symbol, action, quantity, price, tradeDate, note = null) => ({ id, portfolioId: 'p-a', symbol, action, quantity, price, fee: '20', tax: action === 'SELL' ? '150' : '0', tradeDate, note, source: null, externalRef: null, importId: null, costUnknown: false })
// 2330 的紀錄夠多，展開後比 700px 的畫面高——收合時卡片頂已經捲出畫面
const transactions = {
  2330: [tx('t1', '2330', 'SELL', 500, '1050', '2026-06-20'), ...Array.from({ length: 8 }, (_, i) => tx(`b${i}`, '2330', 'BUY', 100, String(500 + i * 10), `2024-0${i + 1}-12`, i === 0 ? '第一次買' : null))],
  '0056': [tx('t4', '0056', 'BUY', 2000, '36.5', '2023-11-02')]
}
const blocked = []
const mock = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (p === '/api/core/portfolios' && m === 'GET') return route.fulfill({ json: { portfolios: [{ id: 'p-a', name: '元大', brokerCode: null, position: 0, createdAt: '2026-10-01T00:00:00Z' }] } })
    if (p === '/api/core/holdings' && m === 'GET') return route.fulfill({ json: { holdings: [{ symbol: '2330', quantity: 300, costUnknownQuantity: 0, averageCost: '660.0000', totalCost: '198000', realizedProfitLoss: '230000' }, { symbol: '0056', quantity: 2000, costUnknownQuantity: 0, averageCost: '36.5100', totalCost: '73020', realizedProfitLoss: '0' }] } })
    if (p === '/api/core/transactions' && m === 'GET') return route.fulfill({ json: { transactions: transactions[url.searchParams.get('symbol')] ?? [] } })
    if (p === '/api/core/shares' && m === 'GET') return route.fulfill({ json: { shares: [] } })
    if (p === '/api/core/holdings/realized' && m === 'GET') return route.fulfill({ json: { from: null, to: null, symbols: [{ symbol: '2330', realizedProfitLoss: '230000', costBasis: '294830', excludedSellCount: 0, excludedShares: 0 }], tradeStats: { sellCount: 1, winCount: 1, lossCount: 0, winRate: '1', averageWin: '230000', averageLoss: null, profitFactor: null, averageHoldingDays: '700' }, totalRealizedProfitLoss: '230000', totalCostBasis: '294830', excludedSellCount: 0, excludedShares: 0 } })
    // 報價（公開的讀取 POST）：收盤 100、前一天 98——卡片上有市值和漲跌色，數字寬度與對比也一起量到
    if (p === '/api/core/screener/values' && m === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      return route.fulfill({ json: { results: body.symbols.map(symbol => ({ symbol, values: Object.fromEntries(body.columns.map(({ field }) => [field, { value: field === 'stock.previousClose' ? '98' : '100', knowledgeDate: '2026-10-16', nullReason: null }])) })) } })
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    blocked.push(`${m} ${p}`)
    return route.abort()
  })
}
const axe = async page => (await new AxeBuilder({ page }).include('.symbol-table__cards').analyze()).violations.map(v => `${v.id}(${v.nodes.length})`).join(',') || '0'

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

const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true, storageState })
await mock(ctx)
const page = await ctx.newPage()
const open = async (path) => {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
}

console.log('持股總覽 375')
await open('/holdings')
const card = page.locator('.symbol-table__card', { hasText: '2330' })
const toggle = card.locator('.symbol-table__toggle')
const foot = () => card.evaluate((el) => {
  const last = el.lastElementChild
  return { last: last.classList.contains('symbol-table__toggle'), widths: [el.clientWidth, last.getBoundingClientRect().width], expanded: last.getAttribute('aria-expanded') }
})
let state = await foot()
check(state.last && state.widths[0] === state.widths[1], `收著：明細是卡片最後一個、整張卡片寬（${state.widths.join('／')}）`)
if (dir) await page.locator('.symbol-table__cards').screenshot({ path: `${dir}/cards-collapsed.png` })

await toggle.click(); await page.waitForTimeout(1500)
state = await foot()
check(state.last && state.expanded === 'true', '展開：明細還在最底下（內容長在它上面），aria-expanded=true')
const rights = await card.evaluate(el => [...el.querySelectorAll('.symbol-table__row dd, .detail__facts dd, .ledger__end')].map(node => Math.round(node.getBoundingClientRect().right)))
check(rights.length >= 10 && new Set(rights).size === 1, `卡片的列、明細、交易紀錄的數字右緣切齊（${[...new Set(rights)].join('／')}，${rights.length} 個）`)
check(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) === 0, '沒有橫向捲動')
await page.mouse.move(0, 0); await page.waitForTimeout(800)
const violations = await axe(page)
check(violations === '0', `axe 0（${violations}）`)
if (dir) await page.locator('.symbol-table__cards').screenshot({ path: `${dir}/cards-expanded.png` })

await toggle.evaluate(el => el.scrollIntoView({ block: 'end' })); await page.waitForTimeout(300)
const before = await card.evaluate(el => Math.round(el.getBoundingClientRect().top))
await toggle.click(); await page.waitForTimeout(600)
const after = await card.evaluate(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, header: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-height')) }))
check(before < 0 && after.top >= after.header && after.bottom <= 700, `捲到底才收合（卡片頂在 ${before}）：卡片捲回頁首下面（${Math.round(after.top)}～${Math.round(after.bottom)}）`)

console.log('已實現損益 375')
await open('/holdings/realized')
const rcard = page.locator('.symbol-table__card', { hasText: '2330' })
// 報酬率 ＝ 230,000 ÷ 294,830
check((await rcard.innerText()).includes('▲ +230,000 元 +78.01%'), '卡片：已實現損益後面寫報酬率 +78.01%')
check((await page.locator('.realized-page__answer').innerText()).includes('報酬率 +78.01%'), '答句寫出合計報酬率')
await rcard.locator('.symbol-table__toggle').click(); await page.waitForTimeout(1500)
const word = await rcard.locator('.ledger__action', { hasText: '期間內' }).evaluate(el => el.getClientRects().length)
check(word === 1, '「賣出（期間內）」整段在同一行')
check(await rcard.locator('.ledger__item').last().evaluate(el => getComputedStyle(el).borderBottomWidth) === '0px', '最後一筆不畫底線（不跟頁尾的線疊在一起）')
const realizedViolations = await axe(page)
check(realizedViolations === '0', `axe 0（${realizedViolations}）`)

await browser.close()
console.log(`被擋下的寫入： ${JSON.stringify(blocked)}`)
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
