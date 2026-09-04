import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } })
await page.goto('http://localhost:3000/stock/2330', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

// Inspect the actual entries count/range via network response
const resp = await page.request.get('http://localhost:4000/stocks/2330/capital-stock-history')
const json = await resp.json()
console.log('entries count:', json.entries.length)
console.log('date range:', json.entries[json.entries.length-1]?.effectiveDate, 'to', json.entries[0]?.effectiveDate)

await page.screenshot({ path: '__tabs-before.png', clip: { x: 0, y: 750, width: 600, height: 320 } })
await page.click('.share-capital-chart__tab:has-text("近10年")')
await page.waitForTimeout(500)
await page.screenshot({ path: '__tabs-after.png', clip: { x: 0, y: 750, width: 600, height: 320 } })

await browser.close()
