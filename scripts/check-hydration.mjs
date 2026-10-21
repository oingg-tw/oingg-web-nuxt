// 全站 hydration 檢查（2026-10-21，使用者：「另外查 hydration 警告 都不可忽視」）：site-routes.mjs 的每一種頁面各開一次（訪客、1440 寬），
// Vue 在主控台說 Hydration … mismatch 就算失敗，列出伺服器畫了哪個節點、瀏覽器以為是什麼。check-stock-pages、check-hub-pages 也會攔，
// 這一支涵蓋其餘的頁面（會員頁的訪客版、行事曆、篩選、ETF、特別股、新手專區…），而且只做這一件事，快。
//
// 寫這一支的那天抓到的：目前值圖表的讀取中佔位前面夾了一段 HTML 註解，開發模式的瀏覽器編譯把它併進 v-else 變成 Fragment、伺服器
// 編譯卻丟掉，每個指標頁第一次載入都對不上（正式建置會拿掉註解，所以只在開發模式看得到，但它會蓋掉真正的問題）。
//
// Run: 本機 dev（:3000）開著，node scripts/check-hydration.mjs（BASE= 換伺服器）
import { chromium } from 'playwright'
import { ALL_ROUTES } from './site-routes.mjs'

const base = process.env.BASE ?? 'http://localhost:3000'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
let failed = 0
for (const route of ALL_ROUTES) {
  const page = await context.newPage()
  const found = []
  page.on('console', async (msg) => {
    if (!/hydrat|mismatch/i.test(msg.text())) return
    const args = await Promise.all(msg.args().map(arg => arg.evaluate(value => value instanceof Node ? `<${value.nodeName}${value.nodeType === 1 ? ` class="${value.getAttribute('class') ?? ''}"` : ` ${value.textContent?.slice(0, 40)}`}>` : String(value).slice(0, 200)).catch(() => '?')))
    found.push(args.join(' ').replace(/\s+/g, ' ').slice(0, 400))
  })
  try {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 180000 })
    await page.waitForTimeout(1200)
  } catch (error) {
    found.push(`LOAD ERROR ${String(error).slice(0, 120)}`)
  }
  if (found.length) failed += 1
  console.log(`${found.length ? 'FAIL' : 'ok  '} ${route}`)
  for (const line of found) console.log(`    ${line}`)
  await page.close()
}
await browser.close()
if (failed) {
  console.log(`\n${failed} / ${ALL_ROUTES.length} 頁有 hydration 訊息`)
  process.exit(1)
}
console.log(`\nPASS: hydration（${ALL_ROUTES.length} 頁）`)
