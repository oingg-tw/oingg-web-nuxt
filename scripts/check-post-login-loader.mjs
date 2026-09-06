// Sanity check for AppPostLoginLoader.vue / usePostLoginLoader.ts: confirms the app mounts it
// without console errors and that it renders nothing while not armed. Full show→hide behavior
// needs a real Firebase login (this script can't authenticate), so verify that path manually:
// sign in in a browser and watch for the full-screen "資料準備中…" overlay briefly appearing
// on /dashboard, then disappearing once the ranking/watchlist cards finish loading.
import { chromium } from 'playwright'

const baseUrl = process.env.DESIGN_PAGE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const consoleErrors = []
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
page.on('pageerror', err => consoleErrors.push(String(err)))

await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const overlayVisible = await page.evaluate(() => !!document.querySelector('.post-login-loader'))
console.log('overlay present while not armed (should be false):', overlayVisible)
console.log('console errors:', consoleErrors)

const ok = !overlayVisible && consoleErrors.length === 0
console.log(ok ? 'PASS: loader mounts cleanly, hidden by default' : 'FAIL: see above')
await browser.close()
process.exit(ok ? 0 : 1)
