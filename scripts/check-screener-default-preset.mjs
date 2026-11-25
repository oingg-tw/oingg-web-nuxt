// 篩選的預設值（2026-11-25，使用者要三種選法：預設範圍、預設值、自定義）：數據中台的 rangePresets 有 isDefault 時，新增條件一打開設定範圍
// 就先按下它；分數型指標帶了範圍選項就回到挑選器（ScreenerIndicatorPickerBody 的 hiddenInPicker）。型錄還沒帶 isDefault 也測得了：
// 先開別的頁面再用 router 切到篩選頁，讓目錄在瀏覽器讀（伺服器先讀好的目錄攔不到），攔下來替 Altman Z 塞兩個選項。
//
// Run: 本機 dev（:3000）開著，node scripts/check-screener-default-preset.mjs（BASE= 換伺服器）
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:3000'
let failures = 0
const check = (cond, label, detail = '') => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `（${detail}）` : ''}`); if (!cond) failures++ }

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.route('**/api/hub/filter-schema*', async (route) => {
  const response = await route.fetch()
  const json = await response.json()
  for (const category of json.categories) for (const metric of category.metrics) {
    if (metric.key !== 'altmanZScore') continue
    const timeframes = metric.fields.map(field => field.key)
    metric.rangePresets = [
      { label: '2.99 以上', min: 2.99, max: null, timeframes, source: 'Altman (1968)', note: null, isDefault: true },
      { label: '1.81 以下', min: null, max: 1.81, timeframes, source: 'Altman (1968)', note: null, isDefault: false }
    ]
  }
  await route.fulfill({ response, json })
})

await page.goto(`${base}/sitemap`, { waitUntil: 'networkidle', timeout: 180000 })
await page.evaluate(() => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/screener/common?template=low-pb-financial-strength'))
await page.waitForLoadState('networkidle')
await page.waitForTimeout(3000)

// 範本帶的條件有值：打開它不套預設
const firstPill = page.locator('.screener-shell__setup .condition-pill__value:visible').first()
const pillBefore = await firstPill.innerText()

await page.locator('.screener-shell__setup .screener-filters__add-slot:visible').first().click()
await page.getByRole('textbox', { name: '搜尋指標名稱' }).fill('Altman Z-Score')
await page.waitForTimeout(500)
const hit = page.getByRole('button', { name: /Altman Z-Score 危機預警分數/ }).first()
check(await hit.count() > 0, '分數型帶了範圍選項就回到挑選器')
await hit.click()
await page.waitForTimeout(800)
const field = page.locator('.indicator-dialog__field:visible').first()
if (await field.count()) { await field.click(); await page.waitForTimeout(800) }
const inputs = await page.locator('.range-editor__input input').evaluateAll(list => list.map(input => input.value))
const pressed = await page.locator('.range-editor .hub-chip[aria-pressed="true"]').allInnerTexts()
check(pressed.length === 1 && pressed[0] === '2.99 以上', '新增條件先按下預設', pressed.join('、'))
check(inputs.length === 1 && inputs[0] === '2.99', '下限填好預設的數字', inputs.join('、'))
// 自己點另一個就換，預設不會再蓋回來
await page.locator('.range-editor .hub-chip', { hasText: '1.81 以下' }).click()
await page.waitForTimeout(300)
check((await page.locator('.range-editor .hub-chip[aria-pressed="true"]').allInnerTexts()).join() === '1.81 以下', '點另一個選項就換成它')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
check(await firstPill.innerText() === pillBefore, '範本原本的條件沒被動到', pillBefore)

await browser.close()
console.log(failures ? `\nFAIL ${failures}` : '\nALL PASS')
process.exit(failures ? 1 : 0)
