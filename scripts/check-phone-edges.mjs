// 手機畫面的四邊與鍵盤（2026-11-07，使用者看過 iOS 文件後：「值得做的先做」）：鍵盤打開時貼底的東西不能被蓋住、雙指放大不能當成鍵盤、
// 橫拿時內容不進瀏海底下、捲到底不帶動後面的頁面、連按不會放大。真的鍵盤與瀏海這裡叫不出來：鍵盤換掉 window.visualViewport 自己送數字，
// 瀏海用 Chromium 的安全區模擬。iOS 上實際的時序要實機看，這支擋的是規則有沒有被改壞。
// Run: 本機 dev（:3000）開著，node scripts/check-phone-edges.mjs（BASE_URL 可換正式版）
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const KEYBOARD = 336
const browser = await chromium.launch()
const portrait = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await portrait.addInitScript(() => {
  const fake = new EventTarget()
  Object.assign(fake, { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 })
  Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true })
  // 鍵盤蓋住 covered px，頁面被推高 offsetTop px；放大時可視區變小
  window.__viewport = (covered, offsetTop = 0, scale = 1) => {
    Object.assign(fake, { height: window.innerHeight - covered, offsetTop, scale })
    fake.dispatchEvent(new Event('resize'))
  }
})
const page = await portrait.newPage()
const ready = () => page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 90000 })
const inset = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--app-keyboard-inset'))
const setViewport = (...args) => page.evaluate(values => window.__viewport(...values), args)

console.log('規則')
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await ready()
await page.waitForTimeout(800)
const meta = await page.getAttribute('meta[name="viewport"]', 'content')
check(meta.includes('viewport-fit=cover'), `viewport-fit=cover（${meta}）`)
check(!/maximum-scale|user-scalable/.test(meta), '沒有鎖住放大（WCAG 1.4.4）')
check(await page.locator('.mobile-header__btn').first().evaluate(el => getComputedStyle(el).touchAction) === 'manipulation', '按鈕連按不會放大，雙指放大照舊')
check(await page.evaluate(() => getComputedStyle(document.documentElement).webkitTextSizeAdjust) === '100%', '橫拿時字不會自己變大')

console.log('鍵盤高度')
await setViewport(KEYBOARD)
check(await inset() === `${KEYBOARD}px`, `鍵盤打開（${await inset()}）`)
await setViewport(KEYBOARD, 120)
check(await inset() === `${KEYBOARD - 120}px`, `頁面被推高時扣掉推高的量（${await inset()}）`)
await setViewport(422, 0, 2)
check(await inset() === '0px', `雙指放大不算鍵盤（${await inset()}）`)
await setViewport(56)
check(await inset() === '0px', `網址列收合不算鍵盤（${await inset()}）`)
await setViewport(0)

console.log('搜尋層')
await page.locator('.mobile-header__btn', { hasText: '搜尋' }).first().click()
await page.waitForTimeout(800)
await page.keyboard.type('2')
await page.waitForTimeout(500)
const layerBody = page.locator('.slide-layer--open .slide-layer__body')
const scrollBefore = await page.evaluate(() => window.scrollY)
await layerBody.hover()
for (let i = 0; i < 12; i += 1) await page.mouse.wheel(0, 1600)
await page.waitForTimeout(600)
check(await page.evaluate(() => window.scrollY) === scrollBefore, '清單捲到底，後面的頁面不動')
await setViewport(KEYBOARD)
await page.waitForTimeout(200)
const lastRow = await layerBody.evaluate((el) => {
  el.scrollTop = el.scrollHeight
  return [...el.querySelectorAll('li')].at(-1).getBoundingClientRect().bottom
})
const visibleBottom = await page.evaluate(covered => window.innerHeight - covered, KEYBOARD)
check(lastRow <= visibleBottom, `鍵盤打開時最後一列捲得出來（${Math.round(lastRow)} ≤ ${visibleBottom}）`)
await setViewport(0)
await portrait.close()

console.log('貼底面板與彈窗')
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const sheet = await context.newPage()
  await sheet.goto(`${base}/screener/etf`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await sheet.waitForTimeout(800)
  const rules = await sheet.evaluate(() => {
    document.documentElement.style.setProperty('--app-keyboard-inset', '336px')
    const add = (className, parent = document.body) => {
      const element = document.createElement('div')
      element.className = className
      parent.append(element)
      return element
    }
    const overlay = add('el-overlay-dialog')
    const dialog = add('el-dialog', overlay)
    const body = add('el-dialog__body', dialog)
    const sheetOverlay = add('condition-panel-overlay')
    const sheetInner = add('el-overlay-dialog', sheetOverlay)
    const panel = add('el-dialog condition-panel', sheetInner)
    const read = (element, property) => getComputedStyle(element)[property]
    return {
      overlay: read(overlay, 'paddingBottom'),
      dialogMax: parseFloat(read(dialog, 'maxHeight')),
      chain: read(body, 'overscrollBehaviorY'),
      sheetOverlay: read(sheetInner, 'paddingBottom'),
      panel: parseFloat(read(panel, 'paddingBottom'))
    }
  })
  check(rules.overlay === '336px', `置中的彈窗在鍵盤以上的空間置中（${rules.overlay}）`)
  check(rules.dialogMax <= 844 * 0.85 - 336 + 1, `彈窗高度扣掉鍵盤（${rules.dialogMax}）`)
  check(rules.chain === 'contain', '彈窗捲到底不帶動後面的頁面')
  check(rules.sheetOverlay === '0px' && rules.panel >= 336, `貼底面板的按鈕列在鍵盤上方（${rules.panel}）`)
  await context.close()
}

console.log('橫拿，瀏海在左右')
{
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
  const wide = await context.newPage()
  const cdp = await context.newCDPSession(wide)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } })
  await wide.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await wide.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 90000 })
  await wide.waitForTimeout(1000)
  const edges = await wide.evaluate(() => {
    const leftOf = selector => document.querySelector(selector)?.getBoundingClientRect().left ?? null
    const rightOf = selector => document.querySelector(selector)?.getBoundingClientRect().right ?? null
    return {
      headerLeft: leftOf('.mobile-header__btn'),
      headerRight: [...document.querySelectorAll('.mobile-header__btn')].at(-1)?.getBoundingClientRect().right ?? null,
      content: leftOf('.app-page__title, h1'),
      contentRight: rightOf('.app-page__title, h1'),
      nav: document.querySelector('.app-bottom-nav__bar')?.getBoundingClientRect().left ?? null,
      navPadding: getComputedStyle(document.querySelector('.app-bottom-nav') ?? document.body).paddingBottom,
      viewport: innerWidth
    }
  })
  check(edges.headerLeft >= 47 && edges.headerRight <= edges.viewport - 47, `頁首的鈕避開瀏海（${edges.headerLeft}～${edges.headerRight}）`)
  check(edges.content >= 47 && edges.contentRight <= edges.viewport - 47, `內容避開瀏海（${edges.content}～${edges.contentRight}）`)
  check(edges.nav === null || edges.nav >= 47, `底部導覽避開瀏海（${edges.nav}）`)
  check(edges.navPadding === '21px', `底部導覽避開手勢條（${edges.navPadding}）`)
  await wide.locator('.mobile-header__btn', { hasText: '搜尋' }).first().click()
  await wide.waitForTimeout(800)
  const layerLeft = await wide.locator('.slide-layer--open .slide-layer__body .el-input__wrapper').evaluate(el => el.getBoundingClientRect().left)
  check(layerLeft >= 47, `搜尋層避開瀏海（${Math.round(layerLeft)}）`)
  await context.close()
}

await browser.close()
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\nPASS: phone edges')
