// ETF 篩選的基金月報欄位，欄名寫月份（2026-11-07）：規模、報酬率是月底的數字，跟逐日的收盤價、淨值放在一起要看得出不是同一天。
// 月份要等查詢回來，欄位物件早就建好了，這裡驗表頭真的跟著變。訪客，查詢是真的，只在回應補上 yearMonth（本機上游還沒有這個欄位時也驗得到）。
// Run: 本機 dev（:3000）開著，node scripts/check-etf-report-month.mjs（BASE_URL 可換 DEV）
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.route('**/api/core/etf-screener', async (route) => {
  const response = await route.fetch()
  const json = await response.json()
  json.results = json.results.map(row => ({ ...row, yearMonth: '2026-09' }))
  await route.fulfill({ response, json })
})

await page.goto(`${base}/screener/etf`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.locator('.el-table__body tbody tr').first().waitFor({ timeout: 60000 })
const heads = (await page.locator('.screener-result-table__column-label').allInnerTexts()).map(text => text.trim())
await browser.close()

const failures = [
  ...['規模 2026-09', '近1年報酬率 2026-09'].filter(label => !heads.includes(label)).map(label => `表頭沒有「${label}」`),
  ...['收盤價', '淨值'].filter(label => !heads.includes(label)).map(label => `逐日的欄位「${label}」不該帶月份`)
]
console.log(`表頭：${heads.join('、')}`)
if (failures.length) {
  for (const failure of failures) console.log(`FAIL: ${failure}`)
  process.exit(1)
}
console.log('PASS: ETF report month')
