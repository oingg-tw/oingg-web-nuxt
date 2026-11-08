// 篩選 UI 的間距（2026-11-08，使用者：「篩選 UI 組合的間距跑掉了，請修正並加上測試」）。量的是畫出來的位置，不是 CSS 寫了什麼：
//   - 同一列相鄰的控制項相隔 8px：我的篩選、顯示欄位＋欄位設定、排序＋方向；面板頁尾的按鈕；設定範圍的期別晶片
//     （2026-11-02 排序／大到小、2026-11-08 管理／欄位設定與「取消／儲存」原本都是 12px）
//   - 手機上疊起來的控制項上下也是 8px：我的篩選、存成我的篩選、篩選條件 N 個；顯示欄位、欄位 N 個、排序
//   - 面板（條件清單、選指標、設定範圍、管理、欄位設定）的內容跟標題、頁尾的按鈕對齊，離面板邊 16px（原本內容內縮到 20px）
//   - ETF 手機卡片的欄名不在月份中間折行（原本「近1年報酬率 2026-」換行「09」）
// 訪客、不寫資料（只點開再 Esc）。開發伺服器要開著：`node scripts/check-screener-spacing.mjs`；環境變數 SPACING_URL（預設 http://localhost:3000）
import { chromium } from 'playwright'

const base = process.env.SPACING_URL ?? 'http://localhost:3000'
const GAP = 8
const INSET = 16
// 數字條件三個（網址帶入、未儲存，所以「存成我的篩選」也在）；類別條件（ETF 市場別）；沒有條件
const ROUTES = ['/screener/common?f=roe.TTM:15~&f=debtRatio.Q:~60&f=liveCashDividendYield.EOD:4~', '/screener/etf?f=market:sii', '/screener/preferred']
const DEVICES = [
  { name: '1440', phone: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: '390 觸控', phone: true, options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
]
const CONTROLS = '.screener-preset-select__select, .screener-preset-select__button, .screener-shell__conditions-open, .smt-toolbar__settings, .smt-columns-open, .smt-sort, .smt-direction'

const failures = []
const fail = (key, text) => failures.push(`${key}  ${text}`)
// 量到的是小數（rem 換算、縮放），差半個像素以內算一樣
const near = (value, target) => Math.abs(value - target) < 0.6

// 一群元素排成幾列（上緣差 4px 內算同一列）：列內左右相鄰的距離、列與列上下的距離
function spacingOf(rects) {
  const rows = []
  for (const rect of [...rects].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const row = rows.find(candidate => Math.abs(candidate[0].top - rect.top) < 4)
    if (row) row.push(rect)
    else rows.push([rect])
  }
  const across = rows.flatMap(row => row.sort((a, b) => a.left - b.left).slice(1).map((rect, i) => ({ between: `${row[i].name}→${rect.name}`, gap: rect.left - row[i].right })))
  const down = rows.slice(1).map((row, i) => ({ between: `${rows[i][0].name}↓${row[0].name}`, gap: Math.min(...row.map(r => r.top)) - Math.max(...rows[i].map(r => r.bottom)) }))
  return { across, down }
}

function checkSpacing(key, where, rects, { vertical = true } = {}) {
  const { across, down } = spacingOf(rects)
  for (const { between, gap } of across) if (!near(gap, GAP)) fail(key, `${where}：${between} 相隔 ${gap.toFixed(1)}px，應為 ${GAP}px`)
  if (vertical) for (const { between, gap } of down) if (!near(gap, GAP)) fail(key, `${where}：${between} 上下相隔 ${gap.toFixed(1)}px，應為 ${GAP}px`)
}

const rectsIn = (page, selector, scope) => page.evaluate(({ selector, scope }) => {
  const root = scope ? document.querySelector(scope) : document
  return [...(root?.querySelectorAll(selector) ?? [])].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
    .map((el) => { const r = el.getBoundingClientRect(); return { name: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 10), left: r.left, right: r.right, top: r.top, bottom: r.bottom } })
}, { selector, scope })

// 畫面上那個面板：標題、內容（扣掉內距）、頁尾最右邊的按鈕各離面板邊多遠，頁尾按鈕與期別晶片的位置
const openPanel = page => page.evaluate(() => {
  const dialog = [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length && !el.closest('[aria-hidden="true"]')).at(-1)
  if (!dialog) return null
  const d = dialog.getBoundingClientRect()
  const body = dialog.querySelector('.el-dialog__body')
  const b = body.getBoundingClientRect()
  const style = getComputedStyle(body)
  const rect = (el) => { const r = el.getBoundingClientRect(); return { name: el.textContent.trim().slice(0, 10), left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
  const buttons = [...dialog.querySelectorAll('.el-dialog__footer .el-button')].filter(el => el.getClientRects().length).map(rect)
  return {
    title: dialog.querySelector('.el-dialog__title')?.textContent.trim() ?? '',
    titleLeft: dialog.querySelector('.el-dialog__title').getBoundingClientRect().left - d.left,
    contentLeft: b.left + parseFloat(style.paddingLeft) - d.left,
    contentRight: d.right - (b.right - parseFloat(style.paddingRight)),
    footerRight: buttons.length ? d.right - Math.max(...buttons.map(button => button.right)) : null,
    buttons,
    chips: [...dialog.querySelectorAll('.range-editor__periods > button')].map(rect)
  }
})

async function checkPanel(page, key, label, open) {
  try {
    await open()
  } catch (error) {
    fail(key, `${label}：打不開（${error.message.split('\n')[0]}）`)
    return
  }
  await page.waitForTimeout(700)
  const panel = await openPanel(page)
  if (!panel) {
    fail(key, `${label}：按了沒有面板`)
    return
  }
  const where = `${label}「${panel.title}」`
  if (!near(panel.titleLeft, INSET)) fail(key, `${where}：標題離左邊 ${panel.titleLeft.toFixed(1)}px，應為 ${INSET}px`)
  if (!near(panel.contentLeft, panel.titleLeft)) fail(key, `${where}：內容離左邊 ${panel.contentLeft.toFixed(1)}px，標題是 ${panel.titleLeft.toFixed(1)}px`)
  if (!near(panel.contentRight, INSET)) fail(key, `${where}：內容離右邊 ${panel.contentRight.toFixed(1)}px，應為 ${INSET}px`)
  if (panel.footerRight !== null && !near(panel.footerRight, panel.contentRight)) fail(key, `${where}：頁尾按鈕離右邊 ${panel.footerRight.toFixed(1)}px，內容是 ${panel.contentRight.toFixed(1)}px`)
  checkSpacing(key, `${where}的頁尾`, panel.buttons)
  checkSpacing(key, `${where}的期別`, panel.chips, { vertical: false })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

const browser = await chromium.launch()
for (const device of DEVICES) {
  for (const route of ROUTES) {
    const key = `${route} @${device.name}`
    const context = await browser.newContext(device.options)
    // 只讀：查詢是 POST，其他寫入一律擋掉
    await context.route('**/*', request => (request.request().method() === 'GET' || /\/screener$|\/screener\/values|\/etf-screener$/.test(request.request().url().replace(/\?.*/, ''))) ? request.continue() : request.abort())
    // ETF 的月份欄名要等查詢帶回 yearMonth（同 check-etf-report-month.mjs）；本機上游還沒有這個欄位時補上
    await context.route('**/api/core/etf-screener', async (request) => {
      const response = await request.fetch()
      const json = await response.json()
      json.results = (json.results ?? []).map(row => ({ yearMonth: '2026-09', ...row }))
      await request.fulfill({ response, json })
    })
    const page = await context.newPage()
    page.on('pageerror', error => fail(key, `page error ${error.message.slice(0, 120)}`))
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 180000 })
    // 開發模式的 Nuxt DevTools 浮動鈕蓋在手機面板底部的「新增條件」上
    await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
    await page.locator('.screener-shell__setup').waitFor({ timeout: 60000 })
    await page.waitForTimeout(1500)

    checkSpacing(key, '設定區', await rectsIn(page, CONTROLS, '.screener-shell__setup'))
    checkSpacing(key, '結果區工具列', await rectsIn(page, CONTROLS, '.smt-toolbar'))

    if (device.phone && route.startsWith('/screener/etf')) {
      const split = await page.evaluate(() => [...document.querySelectorAll('.smt-card__value dt')].flatMap((dt) => {
        const match = /\d{4}-\d{2}/.exec(dt.textContent)
        if (!match || !dt.firstChild) return []
        const range = document.createRange()
        range.setStart(dt.firstChild, match.index)
        range.setEnd(dt.firstChild, match.index + match[0].length)
        return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size > 1 ? [dt.textContent] : []
      }))
      const labels = await page.locator('.smt-card__value dt').filter({ hasText: /\d{4}-\d{2}/ }).count()
      if (!labels) fail(key, 'ETF 卡片沒有帶月份的欄名，量不到')
      for (const label of new Set(split)) fail(key, `ETF 卡片欄名「${label}」在月份中間折行`)
    }

    if (device.phone) {
      const list = () => page.locator('.screener-shell__conditions-open').click()
      await checkPanel(page, key, '篩選條件 N 個', list)
      if (await page.locator('.screener-shell__conditions-inline .condition-pill').count()) {
        await checkPanel(page, key, '設定範圍', async () => { await list(); await page.waitForTimeout(600); await page.locator('.condition-panel .condition-pill__value').first().click() })
      }
      await checkPanel(page, key, '選指標', async () => { await list(); await page.waitForTimeout(600); await page.locator('.condition-panel .screener-filters__add-slot').first().click() })
      await checkPanel(page, key, '欄位 N 個', () => page.locator('.smt-columns-open').click())
    } else {
      if (await page.locator('.screener-shell__conditions-inline .condition-pill').count()) {
        await checkPanel(page, key, '設定範圍', () => page.locator('.screener-shell__conditions-inline .condition-pill__value').first().click())
      }
      await checkPanel(page, key, '選指標', () => page.locator('.screener-shell__conditions-inline .screener-filters__add-slot').first().click())
      await checkPanel(page, key, '欄位設定', () => page.locator('.smt-toolbar__settings').click())
    }
    await checkPanel(page, key, '管理我的篩選', () => page.locator('.screener-shell__setup button[aria-label="管理我的篩選"]').click())
    await checkPanel(page, key, '管理顯示欄位', () => page.locator('.smt-toolbar button[aria-label="管理顯示欄位"]').click())
    await context.close()
  }
}
await browser.close()

console.log(`篩選 UI 間距：${ROUTES.length} 頁 × ${DEVICES.length} 種寬度`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length ? `\nFAIL: screener spacing（${failures.length}）` : '\nPASS: screener spacing')
if (failures.length) process.exitCode = 1
