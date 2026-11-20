// 搜尋紀錄的檢查（2026-11-20，使用者：「搜尋能否加上歷史搜尋紀錄？手機版就直接呈現，電腦版則是focus後把搜尋歷史作為預測打開」）。
// 對著跑著的網站，真的瀏覽器：
//   node scripts/check-search-history.mjs            （SEARCH_HISTORY_URL 可覆寫，例如 DEV 的網址）
// 電腦版：沒有紀錄時聚焦不開下拉；搜過之後聚焦打開「最近搜尋」，新的在前，最後一列是「清除搜尋紀錄」，方向鍵＋Enter 選得到；重新整理還在。
// 手機版：搜尋層還沒打字就列出來，「清除」之後焦點回到輸入框。
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')

const base = (process.env.SEARCH_HISTORY_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}
const browser = await chromium.launch()

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await desk.goto(`${base}/stock/2330`, { waitUntil: 'networkidle', timeout: 240000 })
const input = desk.locator('.app-header-menu__input input')
const rows = () => desk.locator('.app-header-menu__popper li:visible')
await input.click()
await desk.waitForTimeout(600)
expect(await rows().count() === 0, '電腦版：沒有紀錄時聚焦就打開了下拉')
for (const code of ['2317', '0050']) {
  await input.fill(code)
  await desk.waitForTimeout(500)
  await input.press('Enter')
  await desk.waitForURL(url => url.pathname.includes(code), { timeout: 60000 })
  await desk.waitForLoadState('networkidle')
}
await desk.reload({ waitUntil: 'networkidle' })
await input.click()
await desk.waitForTimeout(800)
const texts = (await rows().allInnerTexts()).map(text => text.replace(/\s+/g, ' '))
expect(texts.length === 3 && texts[0].includes('0050') && texts[1].includes('2317') && texts[2] === '清除搜尋紀錄', `電腦版：聚焦後的下拉是 ${texts.join('／')}`)
expect(await desk.locator('.app-header-menu__history-head:visible').count() === 1, '電腦版：下拉沒有「最近搜尋」標題')
for (let i = 0; i < 3; i++) await input.press('ArrowDown')
await input.press('Enter')
await desk.waitForTimeout(500)
await input.click()
await desk.waitForTimeout(800)
expect(await rows().count() === 0, '電腦版：選了「清除搜尋紀錄」之後聚焦還有下拉')

const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
await phone.goto(`${base}/stock/2330`, { waitUntil: 'networkidle', timeout: 240000 })
const openLayer = async () => {
  await phone.locator('.mobile-header__btn', { hasText: '搜尋' }).click()
  await phone.waitForTimeout(1200)
}
const results = () => phone.locator('.landing-stock-search--layer .landing-stock-search__result:visible')
await openLayer()
await phone.locator('.landing-stock-search--layer input').fill('2454')
await phone.waitForTimeout(500)
await results().first().click()
await phone.waitForURL(url => url.pathname.includes('2454'), { timeout: 60000 })
await phone.waitForLoadState('networkidle')
await openLayer()
const recent = (await results().allInnerTexts()).map(text => text.replace(/\s+/g, ' '))
expect(recent.length === 1 && recent[0].includes('2454'), `手機版：搜尋層還沒打字時列的是 ${recent.join('／') || '沒有'}`)
await phone.locator('.landing-stock-search__recent-clear').click()
await phone.waitForTimeout(400)
expect(await results().count() === 0, '手機版：清除之後還有紀錄')
expect(await phone.evaluate(() => document.activeElement?.tagName === 'INPUT' && !!document.activeElement.closest('.landing-stock-search--layer')), '手機版：清除之後焦點不在輸入框')

await browser.close()
console.log(failures.length ? failures.map(failure => `FAIL ${failure}`).join('\n') : 'ok   電腦版聚焦打開紀錄、清除列；手機版直接列出、清除')
process.exit(failures.length ? 1 : 0)
