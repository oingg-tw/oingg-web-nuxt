// 三組篩選的設定區（.screener-shell__setup）無障礙檢查（2026-10-23，使用者：「screener-shell__setup 確保這個區塊有符合A11y」）。
// check-a11y-pages 只掃頁面載入後的樣子；這支補上從設定區打開的東西與鍵盤操作：
//   - axe（同 check-a11y-pages 的標籤）：設定區本身，以及我的篩選選單、條件的值、新增條件、新增篩選、管理各自打開的面板
//   - 觸控尺寸：任一邊 < 24px 失敗（2.5.8）；手機寬度（pointer: coarse）< 44px 列警告
//   - 鍵盤：從設定區第一個元素一路 Tab，每一站都要有看得見的焦點框
//   - 面板：打開時焦點在面板裡，Esc 關掉，焦點回到打開它的那個按鈕
//   - 320px 寬沒有橫向捲動（1.4.10）
// 訪客模式、不寫任何資料（只點開再 Esc）。開發伺服器要開著：`node scripts/check-screener-setup-a11y.mjs`
// 環境變數：SETUP_A11Y_URL（預設 http://localhost:3000）、ROUTES（用 | 分隔，類別條件的值本身有逗號）、WIDTHS、MODES
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const base = process.env.SETUP_A11Y_URL ?? 'http://localhost:3000'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
// 數字條件（普通股範本）、類別條件（ETF 市場別）、沒有條件（特別股「全部」）
const routes = (process.env.ROUTES ?? '/screener/common?template=value|/screener/etf?f=market:sii|/screener/preferred').split('|')
const widths = (process.env.WIDTHS ?? '1440,375,320').split(',').map(Number)
const modes = (process.env.MODES ?? 'light,dark').split(',')

const failures = []
const warnings = []
const fail = (key, text) => failures.push(`${key}  ${text}`)

async function axe(page, selector, key) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(TAGS).analyze()
  for (const violation of result.violations) {
    // disabled 的控制項不算（WCAG 1.4.3 豁免，同 check-a11y-pages）
    const nodes = violation.nodes.filter(node => !/\bdisabled\b/.test(node.html))
    if (nodes.length) fail(key, `axe ${violation.id}（${violation.impact}）×${nodes.length}：${nodes.slice(0, 3).map(node => node.target.join(' ')).join(' ； ')}`)
  }
}

// 打開後新出現、在畫面裡的面板（對話框、下拉選單）。站內搜尋的滑出層一直在 DOM 裡但在畫面外，靠「在視窗內、沒有 inert」排除。
// 「管理」的對話框沒有搬到 body，就畫在設定區裡面，所以不能排除設定區裡的元素
async function waitForOpenPanel(page) {
  for (let i = 0; i < 15; i++) {
    const found = await page.evaluate(() => {
      document.querySelectorAll('[data-a11y-open]').forEach(el => el.removeAttribute('data-a11y-open'))
      const panel = [...document.querySelectorAll('.el-dialog, .el-popper, .el-drawer')].filter((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight
          && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[inert], [aria-hidden="true"]')
      }).at(-1)
      panel?.setAttribute('data-a11y-open', '')
      return !!panel
    })
    // 等開啟的轉場跑完再量（對話框淡入時文字是半透明的，axe 會把它量成對比不足）
    if (found) {
      await page.waitForTimeout(450)
      return true
    }
    await page.waitForTimeout(200)
  }
  return false
}

const browser = await chromium.launch()
for (const mode of modes) {
  for (const width of widths) {
    for (const route of routes) {
      const key = `${route} ${mode} ${width}`
      const mobile = width < 600
      const context = await browser.newContext({ viewport: { width, height: 900 }, ...(mobile ? { hasTouch: true, isMobile: true } : {}) })
      await context.addCookies([{ name: 'theme-mode', value: mode, domain: new URL(base).hostname, path: '/' }])
      const page = await context.newPage()
      page.on('pageerror', error => fail(key, `page error ${error.message.slice(0, 120)}`))
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 180000 })
      await page.locator('.screener-shell__setup').waitFor({ timeout: 60000 })
      await page.waitForTimeout(800)

      await axe(page, '.screener-shell__setup', key)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      if (overflow > 0) fail(key, `橫向捲動 ${overflow}px`)

      const small = await page.evaluate(limit => [...document.querySelectorAll('.screener-shell__setup :is(button, a[href], input, select, [role="button"], [role="combobox"], [tabindex]:not([tabindex="-1"]))')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled })
        .map((el) => { const r = el.getBoundingClientRect(); return { name: (el.getAttribute('aria-label') || el.innerText || el.className).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) } })
        .filter(size => Math.min(size.w, size.h) < limit), mobile ? 44 : 24)
      for (const size of small) {
        if (Math.min(size.w, size.h) < 24) fail(key, `觸控 ${size.w}×${size.h}「${size.name}」< 24px`)
        else warnings.push(`${key}  觸控 ${size.w}×${size.h}「${size.name}」< 44px`)
      }

      // 鍵盤順序與焦點框（深淺色的焦點樣式一樣，淺色量一次）
      if (mode === modes[0]) {
        await page.locator('.screener-shell__setup :is(button, input, [tabindex="0"])').first().focus()
        for (let i = 0; i < 20; i++) {
          const stop = await page.evaluate(() => {
            const el = document.activeElement
            if (!el?.closest('.screener-shell__setup')) return null
            const style = getComputedStyle(el)
            const ring = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
            const wrapper = el.closest('.el-select__wrapper, .el-input__wrapper')
            return { name: (el.getAttribute('aria-label') || el.innerText?.trim() || el.tagName).slice(0, 20), ring: ring || (!!wrapper && getComputedStyle(wrapper).boxShadow !== 'none') }
          })
          if (!stop) break
          if (!stop.ring) fail(key, `「${stop.name}」聚焦時看不到焦點框`)
          await page.keyboard.press('Tab')
        }
      }

      // :visible：手機上條件收進「篩選條件 N 個」（方案 B，2026-10-31），攤開的那份藏起來；電腦版反過來
      const triggers = [
        ['我的篩選選單', '.screener-shell__setup .el-select__wrapper'],
        ['篩選條件', '.screener-shell__setup .screener-shell__conditions-open:visible'],
        ['條件的值', '.screener-shell__setup .condition-pill__value:visible'],
        ['新增條件', '.screener-shell__setup .screener-filters__add-slot:visible'],
        ['新增篩選', '.screener-shell__setup button[aria-label="新增篩選"]'],
        ['管理我的篩選', '.screener-shell__setup button[aria-label="管理我的篩選"]']
      ]
      for (const [label, selector] of triggers) {
        const trigger = page.locator(selector).first()
        if (!(await trigger.count())) continue
        await trigger.click()
        if (!(await waitForOpenPanel(page))) {
          fail(key, `${label}：按了沒有打開任何面板`)
          continue
        }
        await axe(page, '[data-a11y-open]', `${key} ${label}`)
        if (!(await page.evaluate(() => !!document.activeElement?.closest('[data-a11y-open], .el-select')))) fail(key, `${label}：打開後焦點不在面板裡`)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
        if (await page.locator('[data-a11y-open]').isVisible().catch(() => false)) fail(key, `${label}：Esc 沒有關掉`)
        if (!(await trigger.evaluate(el => el === document.activeElement || el.contains(document.activeElement) || !!el.closest('.el-select')?.contains(document.activeElement)))) {
          fail(key, `${label}：關掉後焦點沒有回到「${label}」`)
        }
      }
      await context.close()
    }
  }
}
await browser.close()

console.log(`設定區無障礙：${routes.length} 頁 × ${modes.length} 種配色 × ${widths.length} 種寬度`)
for (const line of warnings) console.log(`  warn ${line}`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length ? `\nFAIL: screener setup a11y（${failures.length}）` : '\nPASS: screener setup a11y')
if (failures.length) process.exitCode = 1
