// 指標速覽切走再切回來（2026-11-25 使用者回報：「指標速覽 切去 指標總攬 選 PER 再點選 指標速覽 會出錯」）：快取裡已經有資料時，
// StockMetricHistoryChartInteractive 的 immediate watch 在 setup 當下就算圖的資料，用到寫在後面的 const 就丟
// 「Cannot access … before initialization」。只有帶組成的卡片（股東回饋組成）會走到那一段，所以先釘它，再照使用者的路走一次，不能有頁面錯誤。
//
// Run: 本機 dev（:3000）開著，node scripts/check-quick-view-return.mjs（BASE= 換伺服器、CODE= 換公司）
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
const code = process.env.CODE ?? '2330'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
// 正式建置沒有 Vue 的警告，同一個錯誤印在 console（「ReferenceError: Cannot access 'Te' before initialization」，2026-11-25 DEV 量到）
page.on('console', message => { if (/Unhandled error|(Reference|Type|Range)Error/.test(message.text())) errors.push(message.text().slice(0, 200)) })
const go = async (name) => {
  await page.getByRole('link', { name, exact: true }).first().click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)
}

await page.goto(`${base}/stock/${code}/metrics`, { waitUntil: 'networkidle', timeout: 180000 })
await page.getByRole('textbox', { name: '搜尋指標名稱或說明' }).fill('股東回饋組成')
await page.waitForTimeout(800)
const pin = page.locator('button[aria-label="釘選：股東回饋組成"]').first()
if (await pin.count()) { await pin.click(); await page.waitForTimeout(1200) }
await go('指標速覽')
const pinned = (await page.locator('main h3').allInnerTexts()).some(title => title.startsWith('股東回饋組成'))
await go('指標總覽')
await page.getByRole('link', { name: /本益比/ }).first().click()
await page.waitForLoadState('networkidle')
await page.waitForTimeout(3000)
await go('指標速覽')
await browser.close()

console.log(`  ${pinned ? 'PASS' : 'FAIL'}  速覽有股東回饋組成這張卡`)
console.log(`  ${errors.length ? 'FAIL' : 'PASS'}  速覽 → 總覽 → 本益比 → 速覽沒有頁面錯誤${errors.length ? `：${errors.join('；')}` : ''}`)
process.exit(pinned && !errors.length ? 0 : 1)
