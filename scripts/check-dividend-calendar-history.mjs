// One runnable check for the 配息月曆 history navigation (2026-09-22).
//
// Asserts the four things that break if the wiring is wrong, against the live dev server:
//   1. 上個月 actually loads a past month's events (the endpoint used to return 0 rows for those)
//   2. a realised day's dialog names its 發放日 / 年度, an announced one says 尚未除息
//   3. the coverage note appears only for months before 2026-03
//   4. both statuses render in the same month (2026-09 is genuinely mixed: 97 + 10)
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

// Open the busiest day in view and read its dialog rows back.
async function readBusiestDay() {
  const count = await chipDays.count()
  if (!count) return []
  let best = 0
  let bestLen = 0
  for (let i = 0; i < count; i++) {
    const len = await chipDays.nth(i).locator('.dividend-calendar-card__chip').count()
    if (len > bestLen) { bestLen = len; best = i }
  }
  await chipDays.nth(best).click()
  const dialog = page.locator('.el-dialog:visible')
  await dialog.waitFor()
  const rows = await dialog.locator('.dividend-calendar-card__detail-row').allInnerTexts()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  return rows
}

// --- current month (2026-09): mixed announced + realized ---
console.log('\n本月（混合 announced/realized）')
const dayCells = await chipDays.count()
check(dayCells > 0, '本月有事件', `有事件的日子 ${dayCells} 天`)
check(await note.count() === 0, '本月不顯示涵蓋警語')

// Scan every day this month for both status wordings.
let sawPaid = false
let sawAnnounced = false
for (let i = 0; i < dayCells; i++) {
  await chipDays.nth(i).click()
  const dialog = page.locator('.el-dialog:visible')
  await dialog.waitFor()
  const text = await dialog.innerText()
  if (text.includes('發放日')) sawPaid = true
  if (text.includes('尚未除息')) sawAnnounced = true
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  if (sawPaid && sawAnnounced) break
}
check(sawPaid, '已實現的列顯示發放日')
check(sawAnnounced, '預告的列顯示「尚未除息」')

// --- one month back (2026-08): all realized, and the month with the most rows ---
console.log('\n上個月（全部 realized）')
await prev.click()
await page.waitForTimeout(1500)
const augDays = await chipDays.count()
check(augDays > 0, '往回翻一個月仍載入到事件', `有事件的日子 ${augDays} 天`)
const augRows = await readBusiestDay()
check(augRows.length > 0, '歷史月份的日期明細打得開', `${augRows.length} 列`)
check(augRows.some((r) => r.includes('發放日')), '歷史月份顯示發放日', augRows[0])
check(!augRows.some((r) => r.includes('尚未除息')), '歷史月份不應出現「尚未除息」')
check(await note.count() === 0, '2026-08 不顯示涵蓋警語')

// --- back past the coverage cliff (2026-02) ---
console.log('\n涵蓋範圍之前（2026-02）')
for (let i = 0; i < 6; i++) { await prev.click(); await page.waitForTimeout(400) }
await page.waitForTimeout(1500)
const noteCount = await note.count()
check(noteCount === 1, '2026-02 顯示涵蓋警語')
if (noteCount) {
  const text = await note.innerText()
  check(text.includes('2026-03'), '警語點名涵蓋起點', text.slice(0, 40))
  check(text.includes('2026-02'), '警語點名當前月份')
}

await browser.close()
console.log(failures.length ? `\nFAILED (${failures.length}): ${failures.join('; ')}` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
