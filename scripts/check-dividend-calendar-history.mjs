// One runnable check for the 配息月曆 history navigation (2026-09-22).
//
// Asserts the four things that break if the wiring is wrong, against the live dev server:
//   1. 上個月 actually loads a past month's events (the endpoint used to return 0 rows for those)
//   2. a realised day's dialog has 發放日 dates, an announced one says 公司預告
//   3. the coverage note appears only for months before 2026-03
//   4. both statuses render in the same month (2026-09 is genuinely mixed: 97 + 10)
// 2026-11-08 起也驗今天與手機的一週：標頭寫今天、桌機沒有一週、手機預設一週五天、「顯示其餘」展開、切到月格
// 2026-11-24 起彈窗是方案 B 的分組表格：標題「11/10（二）」、組的那一列、超過 20 筆有搜尋框且照代號篩、手機是貼底的面板
//
// Run: node scripts/check-dividend-calendar-history.mjs   (dev server must be up)
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? "http://localhost:3000/calendar"
const failures = []
const ok = (label) => console.log(`  PASS  ${label}`)
const check = (cond, label, detail = '') => {
  if (cond) ok(label)
  else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures.push(label)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: 'networkidle' })
const card = page.locator('.dividend-calendar-card')
await card.waitFor()

const prev = card.locator('.el-calendar__button-group button').first()
const note = card.locator('.dividend-calendar-card__note')
const chipDays = card.locator('.dividend-calendar-card__cell-chips')

// 彈窗的資料列（不含組的那一列）；除權息那一張的最後一格是發放日
const dataRows = dialog => dialog.locator('.dividend-calendar-day__table tbody tr:not(.dividend-calendar-day__group)')
const payCells = dialog => dialog.locator('#dividend-day-ex').locator('xpath=ancestor::section[1]').locator('tbody tr:not(.dividend-calendar-day__group) td:last-child')
const DATE = /\d+\/\d+/
// 格子的 aria-label「11/17 有 53 筆除權息、2 筆董事會決議」加起來最多的那一天
async function busiestCell() {
  const cells = card.locator('.dividend-calendar-card__cell--events')
  const labels = await cells.evaluateAll(list => list.map(cell => cell.getAttribute('aria-label') ?? ''))
  const totals = labels.map(label => [...label.matchAll(/(\d+) 筆/g)].reduce((sum, match) => sum + Number(match[1]), 0))
  return { cell: cells.nth(totals.indexOf(Math.max(...totals))), total: Math.max(...totals) }
}

// Open the busiest day in view and read its dialog rows back.
async function readBusiestDay() {
  if (!(await chipDays.count())) return { rows: [], pays: [] }
  await (await busiestCell()).cell.click()
  const dialog = page.locator('.el-dialog:visible')
  await dialog.waitFor()
  const rows = await dataRows(dialog).allInnerTexts()
  const pays = await payCells(dialog).allInnerTexts()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  return { rows, pays }
}

// --- current month (2026-09): mixed announced + realized ---
console.log('\n本月（混合 announced/realized）')
const dayCells = await chipDays.count()
check(dayCells > 0, '本月有事件', `有事件的日子 ${dayCells} 天`)
check(await note.count() === 0, '本月不顯示涵蓋警語')

// Scan every day this month for both status wordings.
let sawPaid = false
let sawAnnounced = false
let sawTitle = ''
for (let i = 0; i < dayCells; i++) {
  await chipDays.nth(i).click()
  const dialog = page.locator('.el-dialog:visible')
  await dialog.waitFor()
  sawTitle ||= await dialog.locator('.dividend-calendar-day__title').innerText()
  if ((await payCells(dialog).allInnerTexts()).some(text => DATE.test(text))) sawPaid = true
  if ((await dialog.innerText()).includes('公司預告')) sawAnnounced = true
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  if (sawPaid && sawAnnounced) break
}
check(/^\d+\/\d+（[日一二三四五六]）/.test(sawTitle), '彈窗標題寫「11/10（二）」', sawTitle)
check(sawPaid, '已實現的列發放日有日期')
check(sawAnnounced, '預告的列寫「公司預告」')

// 這個月最多筆的那一天：組的那一列、超過 20 筆有搜尋框，搜第一列的代號只剩有那個代號的列
{
  const { cell, total } = await busiestCell()
  await cell.click()
  const dialog = page.locator('.el-dialog:visible')
  await dialog.waitFor()
  check(await dialog.locator('.dividend-calendar-day__group').count() > 0, '彈窗照類型或股利期間分組')
  const search = dialog.getByRole('textbox', { name: /找代號或名稱/ })
  check((await search.count() > 0) === (total > 20), `超過 20 筆才有搜尋框（${total} 筆）`)
  if (await search.count()) {
    const code = (await dialog.locator('.dividend-calendar-day__code').first().innerText()).split('・')[0]
    await search.fill(code)
    await page.waitForTimeout(300)
    const rows = await dataRows(dialog).allInnerTexts()
    check(rows.length > 0 && rows.every(row => row.includes(code)), `搜「${code}」只剩那一檔`, `${rows.length} 列`)
    check((await dialog.getByRole('status').innerText()).startsWith('找到'), '搜尋結果寫「找到 N 筆」')
  }
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
}

// --- one month back: all realized ---
console.log('\n上個月（全部 realized）')
await prev.click()
await page.waitForTimeout(1500)
const augDays = await chipDays.count()
check(augDays > 0, '往回翻一個月仍載入到事件', `有事件的日子 ${augDays} 天`)
const aug = await readBusiestDay()
check(aug.rows.length > 0, '歷史月份的日期明細打得開', `${aug.rows.length} 列`)
check(aug.pays.some(text => DATE.test(text)), '歷史月份的發放日有日期', aug.pays[0])
check(!aug.rows.some((r) => r.includes('公司預告')), '歷史月份不應出現「公司預告」')
// 月份從今天算（2026-11-04 起；原本寫死「上個月是 2026-08、再退 6 個月到 2026-02」，到了 11 月就停在 2026-04）
const now = new Date()
const monthsFromFeb = (now.getFullYear() * 12 + now.getMonth()) - (2026 * 12 + 1)
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
check(await note.count() === 0, `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')} 不顯示涵蓋警語`)

// --- back past the coverage cliff (2026-02) ---
console.log('\n涵蓋範圍之前（2026-02）')
for (let i = 1; i < monthsFromFeb; i++) { await prev.click(); await page.waitForTimeout(400) }
await page.waitForTimeout(1500)
const noteCount = await note.count()
check(noteCount === 1, '2026-02 顯示涵蓋警語')
if (noteCount) {
  const text = await note.innerText()
  check(text.includes('2026-03'), '警語點名涵蓋起點', text.slice(0, 40))
  check(text.includes('2026-02'), '警語點名當前月份')
}

// --- 今天與手機的一週（2026-11-08，使用者選的方案 B）---
console.log('\n今天與手機的一週')
const todayText = await card.locator('.app-calendar-today').innerText()
check(/^今天 \d+\/\d+（[日一二三四五六]）$/.test(todayText), '標頭寫今天', todayText)
check(await page.locator('.dividend-calendar-agenda').isHidden(), '桌機沒有一週')

const phone = await browser.newPage({ viewport: { width: 375, height: 812 } })
phone.on('pageerror', (e) => failures.push(`pageerror (375): ${e.message}`))
await phone.goto(BASE, { waitUntil: 'networkidle' })
const agenda = phone.locator('.dividend-calendar-agenda')
await agenda.waitFor()
check(await phone.locator('.dividend-calendar-card__month').isHidden(), '手機一開始不畫月格')
check(await phone.locator('.dividend-calendar-agenda__day').count() === 5, '一週五天（一～五）')
// 往回找一週有一天超過 3 筆的（2026-03 起每週都有資料；往後的月份可能還沒公告）
const more = phone.locator('.dividend-calendar-agenda__more').first()
for (let i = 0; i < 8 && !(await more.count()); i++) {
  await phone.getByRole('button', { name: '上一週', exact: true }).click()
  await phone.waitForTimeout(800)
}
if (await more.count()) {
  const rows = await phone.locator('.dividend-calendar-agenda__row').count()
  await more.click()
  check(await more.getAttribute('aria-expanded') === 'true', '「顯示其餘」標成展開')
  check(await phone.locator('.dividend-calendar-agenda__row').count() > rows, '「顯示其餘」多出列', `${rows} 列`)
} else check(false, '往回八週內有一天超過 3 筆')
await phone.getByRole('radio', { name: '月' }).check({ force: true })
check(await phone.locator('.dividend-calendar-card__month').isVisible(), '切到月格')
check(await agenda.isHidden(), '月格時不畫一週')
// 手機點一天：從下面升上來的面板，全寬貼底。用手機的 context：桌機的 Chromium 捲軸佔 15px，鎖捲動時面板會窄 15px，手機的捲軸不佔寬
{
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const mobile = await context.newPage()
  await mobile.goto(BASE, { waitUntil: 'networkidle' })
  await mobile.getByRole('radio', { name: '月' }).check({ force: true })
  const cell = mobile.locator('.dividend-calendar-card__cell--events').first()
  if (await cell.count()) {
    await cell.click()
    const sheet = mobile.locator('.el-dialog:visible')
    await sheet.waitFor()
    await mobile.waitForTimeout(400)
    const box = await sheet.boundingBox()
    check(box && Math.round(box.width) === 375 && Math.abs(box.y + box.height - 812) <= 1, '手機的彈窗全寬貼底', box && `${Math.round(box.width)}×${Math.round(box.height)} @${Math.round(box.y)}`)
  } else check(false, '手機月格有可以點的一天')
  await context.close()
}

await browser.close()
console.log(failures.length ? `\nFAILED (${failures.length}): ${failures.join('; ')}` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
