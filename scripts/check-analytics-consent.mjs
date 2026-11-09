// Google Analytics 的同意與撤回（2026-11-09，業務中台轉來的個資保護文件 §7）：按「接受」才送；按「拒絕」，或在頁尾「Cookie 設定」撤回之後，
// 同一個分頁裡的 GA 要停下來，_ga cookie 也要清掉。DEV 的 workers.dev 是公共後綴，GA 的 cookie 會放在 .oingg-web-nuxt.workers.dev。
// 本機開發不問 Cookie（useAnalyticsConsent），所以預設對 DEV 跑。GA 的 collect 一律在瀏覽器裡擋下，不會算進 DEV 的流量。
// Run: node scripts/check-analytics-consent.mjs（BASE= 換成別的部署建置）
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev'
let failures = 0
const check = (ok, label) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const hits = []
await context.route(url => url.pathname === '/g/collect', (route) => {
  hits.push(new URL(route.request().url()).searchParams.get('en'))
  return route.abort()
})
const gaCookies = async () => (await context.cookies()).filter(cookie => cookie.name === '_ga' || cookie.name.startsWith('_ga_')).map(cookie => `${cookie.name}@${cookie.domain}`)
const page = await context.newPage()

await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 120000 })
await page.locator('.consent-banner button', { hasText: '接受' }).click()
await page.waitForFunction(() => document.cookie.includes('_ga='), null, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(3000)
check(hits.length > 0, `接受之後 GA 有送（${hits.join(',') || '沒有'}）`)
check((await gaCookies()).length > 0, `接受之後有 _ga cookie（${(await gaCookies()).join(', ') || '沒有'}）`)

await page.locator('.shared-footer__nav-button', { hasText: 'Cookie 設定' }).click()
await page.locator('.consent-banner button', { hasText: '拒絕' }).click()
await page.waitForTimeout(1000)
check((await gaCookies()).length === 0, `拒絕之後 _ga cookie 清掉了（剩：${(await gaCookies()).join(', ') || '無'}）`)
check(await page.evaluate(() => Object.keys(window).some(key => key.startsWith('ga-disable-') && window[key] === true)), '拒絕之後 GA 停了（ga-disable-<ID> 是 true）')

const sent = hits.length
for (const path of ['/rank', '/industries', '/calendar/months']) {
  await page.evaluate(to => window.useNuxtApp().$router.push(to), path)
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(2000)
}
check(hits.length === sent, `拒絕之後換頁、捲到底，GA 沒有再送（${hits.slice(sent).join(',') || '沒有'}）`)
check((await gaCookies()).length === 0, `拒絕之後換頁，_ga cookie 沒有回來（${(await gaCookies()).join(', ') || '無'}）`)

await browser.close()
console.log(failures ? `\n${failures} 項沒過` : '\n全部通過')
process.exitCode = failures ? 1 : 0
