// 每張有時間軸的圖，右上角的近N年 1、2、3、5、8 年都要選得到（2026-11-19，使用者：「要讓每個選項預設都有12358年喔」「底層用季計算也是同樣道理」）：
// 拿資料很長的公司（預設 2330）打開每一個有圖的個股頁，打開每張圖的近N年選單，沒有一個是灰的。起因是杜邦、財報三率、償債能力只抓 20 季、
// 現金流量組成的年度只湊得出 7 年，近8年永遠灰掉。另外歷史表照舊只列 5 年（HISTORY_TABLE_PERIODS 20 列）。
// 持有人結構不在這裡：集保的週資料從 2026-09 才開始收，灰掉是對的。
//
// Run: 本機 dev（:3000）開著，node scripts/check-lookback-years.mjs（BASE= 換伺服器、CODE= 換公司）
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
const code = process.env.CODE ?? '2330'
const YEARS = ['近1年', '近2年', '近3年', '近5年', '近8年']
// 有近N年的頁面；三張歷史表截在 20 列的頁面另外量表格
const PAGES = ['', 'dupont', 'margins', 'solvency', 'dividend', 'monthly-revenue', 'monthly-revenue-growth', 'current-asset-composition', 'non-current-asset-composition', 'debt-composition', 'equity-composition', 'cash-flow-composition', 'operating-expense-composition', 'equity-source', 'roe', 'eps', 'gross-margin']
const TABLE_PAGES = new Set(['dupont', 'margins', 'solvency'])

let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const slug of PAGES) {
  const path = `/stock/${code}${slug ? `/${slug}` : ''}`
  console.log(path)
  const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 180000 })
  check(response?.status() === 200, `打得開（${response?.status()}）`)
  await page.waitForTimeout(1500)
  const selects = page.locator('.shared-chart-card__window')
  const count = await selects.count()
  check(count > 0, `有近N年選單（${count} 張圖）`)
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i)
    await select.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1200)
    await select.click()
    const items = page.locator('.shared-chart-card__window-popper:visible .el-select-dropdown__item')
    await items.first().waitFor({ timeout: 10000 })
    const options = await items.evaluateAll(list => list.map(item => ({ text: item.textContent.trim(), disabled: item.classList.contains('is-disabled') })))
    const grey = YEARS.filter(year => options.find(option => option.text === year)?.disabled !== false)
    check(grey.length === 0, `圖 ${i + 1}：1、2、3、5、8 年都選得到${grey.length ? `（灰的或沒有：${grey.join('、')}）` : ''}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  if (TABLE_PAGES.has(slug)) {
    const rows = await page.locator('table:has(caption:text-matches("逐期數據")) tbody tr').count()
    check(rows > 0 && rows <= 20, `歷史表只列 5 年（${rows} 列）`)
  }
}
await browser.close()
console.log(failures ? `FAIL ${failures}` : '全部通過')
process.exit(failures ? 1 : 0)
