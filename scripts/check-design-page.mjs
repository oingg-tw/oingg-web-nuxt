// Ad-hoc verification for app/pages/design.vue, kept around (per direct request) instead of
// being written-then-deleted every time — run with `node scripts/check-design-page.mjs` against
// a running `pnpm run dev` (defaults to http://localhost:3000, override with DESIGN_PAGE_URL).
// Checks that switching theme mode/color on /design actually re-measures the contrast table,
// not just that the underlying CSS variables changed — this caught a real bug once (useHead's
// htmlAttrs binding patches <html> through unhead's own scheduler, not Vue's nextTick(), so a
// naive watch(...) + nextTick() read stale computed styles).
import { chromium } from 'playwright'

const baseUrl = process.env.DESIGN_PAGE_URL ?? 'http://localhost:3000'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const consoleErrors = []
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

await page.goto(`${baseUrl}/design`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)

async function firstRowText() {
  return (await page.evaluate(() => document.querySelector('.design-page__table tbody tr')?.innerText ?? '')).trim()
}

async function solidPrimaryRowText() {
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.design-page__table tbody tr')).map(tr => tr.innerText.trim()))
  return rows.find(row => row.startsWith('實心主色按鈕')) ?? ''
}

const beforeMode = await firstRowText()
await page.click('button.design-page__swatch:has-text("深色")')
await page.waitForTimeout(500)
const afterMode = await firstRowText()

const beforeColor = await solidPrimaryRowText()
await page.click('button.design-page__swatch:has-text("BLUE")')
await page.waitForTimeout(500)
const afterColor = await solidPrimaryRowText()

console.log('mode switch — page-text row before:', beforeMode)
console.log('mode switch — page-text row after: ', afterMode)
console.log('color switch — solid-primary row before:', beforeColor)
console.log('color switch — solid-primary row after: ', afterColor)
console.log('console errors:', consoleErrors)

const ok = beforeMode !== afterMode && beforeColor !== afterColor && consoleErrors.length === 0
console.log(ok ? 'PASS: design page re-measures on mode/color change' : 'FAIL: see rows above')

await browser.close()
process.exit(ok ? 0 : 1)
