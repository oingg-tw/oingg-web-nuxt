// 公開頁的無障礙與手機檢查（2026-10-08，認證用）。每個 路由 × 模式 × 寬度 用真瀏覽器載入，驗：<title> 以「｜安盈選股」結尾且恰好
// 一個可見 h1；html.dark 跟 theme-mode cookie 一致；沒有橫向捲動；axe（wcag2a／wcag2aa／wcag21a／wcag21aa／wcag22aa／best-practice，
// 排除 disabled 的控制項——WCAG 1.4.3 豁免）；手機寬度在 (pointer: coarse) 下每個可見互動元素任一邊 <24px 是 FAIL（2.5.8）、<44 是
// WARN；缺名稱的控制項另列；page error 要是 0，hydration 警告列出不算失敗。個股頁／hub 頁／總經頁有各自的腳本，同一組 axe 標籤，
// 這裡不重複。結果寫成 report.json＋summary.md，讓第三方重跑：`node --env-file=.env scripts/check-a11y-pages.mjs`。
//
// 環境變數：A11Y_PAGES_URL；A11Y_PAGES_ROUTES（逗號分隔子集，Git Bash 下寫不帶斜線的 `calendar`，`index` 指首頁）；
// A11Y_PAGES_MODES=light,dark；A11Y_PAGES_WIDTHS=375,1440（驗 1.4.10 另跑 320）；A11Y_PAGES_TEXT_SCALE=100|110|120；
// A11Y_REPORT_DIR（預設 a11y-report/<時間>，已 gitignore）；A11Y_LOGIN=1 用 .env 的 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD 登入後跑登入頁。
// 上游讀不到（讀取失敗彈窗開著）的頁面記為 skip 不是 fail：那是環境不是頁面，但 summary 會列出來，認證用的那一份不能有 skip。
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.A11Y_PAGES_URL ?? 'http://localhost:3000'
const modes = (process.env.A11Y_PAGES_MODES ?? 'light,dark').split(',').map(entry => entry.trim()).filter(Boolean)
const widths = (process.env.A11Y_PAGES_WIDTHS ?? '375,1440').split(',').map(Number).filter(Boolean)
const textScale = process.env.A11Y_PAGES_TEXT_SCALE ?? '100'
const reportDir = process.env.A11Y_REPORT_DIR ?? `a11y-report/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
const cookieDomain = new URL(baseUrl).hostname
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
const NAME_RULES = new Set(['button-name', 'link-name', 'label', 'role-img-alt', 'select-name', 'input-image-alt', 'aria-command-name', 'aria-input-field-name', 'aria-toggle-field-name', 'svg-img-alt', 'image-alt', 'frame-title'])

// 公開路由。/blog/<slug> 與 /preferred-stocks/<code> 從列表頁的 SSR 連結取第一個。
const STATIC_ROUTES = ['/', '/calendar', '/watchlist', '/holdings', '/appearance', '/sitemap', '/accessibility', '/preferred-stocks', '/etf-zone',
  '/guru-indicators', '/blog', '/industries', '/stock/2330/quick-view', '/screener?template=value']
// 不存在時記為 skip 而不是 fail 的路由（目前沒有）
const OPTIONAL_ROUTES = []

async function firstLink(listPath, pattern) {
  const html = await (await fetch(`${baseUrl}${listPath}`)).text().catch(() => '')
  return html.match(pattern)?.[1] ?? null
}

const discovered = [
  await firstLink('/blog', /href="(\/blog\/[a-z0-9-]+)"/),
  await firstLink('/preferred-stocks', /href="(\/preferred-stocks\/[0-9A-Z]+)"/)
]
// 登入輪（A11Y_LOGIN=1）：持股 7 頁、觀察清單、個人資料、外觀、月曆、篩選器與三個個股頁。帳密只從 .env 讀（node --env-file=.env），永不印出。
const login = process.env.A11Y_LOGIN === '1'
if (login && !(process.env.A11Y_TEST_EMAIL && process.env.A11Y_TEST_PASSWORD)) {
  console.error('A11Y_LOGIN=1 需要 .env 裡的 A11Y_TEST_EMAIL 與 A11Y_TEST_PASSWORD（用 node --env-file=.env 執行）')
  process.exit(2)
}
const LOGIN_ROUTES = ['/holdings', '/holdings/performance', '/holdings/risk', '/holdings/realized', '/holdings/statistics', '/holdings/analysis',
  '/holdings/columns', '/watchlist', '/profile', '/appearance', '/calendar', '/screener', '/stock/2330', '/stock/2330/quick-view', '/stock/2330/metrics']
// 打開 → axe → Esc 的對話框，用看得見的按鈕名稱找；找不到就記 skip（頁面狀態不同時按鈕可能不在）。其餘對話框列在 docs/a11y/README.md 的人工清單。
const DIALOGS = {
  '/screener': [
    { name: '新增條件', open: page => page.getByRole('button', { name: '新增條件' }).first().click() },
    { name: '新增篩選分頁', open: page => page.getByRole('button', { name: '新增篩選分頁' }).first().click() }
  ]
}
const allRoutes = login ? LOGIN_ROUTES : [...STATIC_ROUTES, ...discovered.filter(Boolean), ...OPTIONAL_ROUTES]
const routeFilter = (process.env.A11Y_PAGES_ROUTES ?? '').split(',').map(entry => entry.trim()).filter(Boolean)
  .map(entry => (entry === 'index' ? '/' : entry.startsWith('/') ? entry : `/${entry}`))
const routes = routeFilter.length ? allRoutes.filter(route => routeFilter.includes(route)) : allRoutes
if (routeFilter.length && routes.length !== routeFilter.length) {
  console.error(`A11Y_PAGES_ROUTES 有對不上的路由：${routeFilter.filter(entry => !allRoutes.includes(entry)).join(', ')}`)
  console.error(`可用的有 ${allRoutes.length} 條：${allRoutes.join(' ')}`)
  process.exit(2)
}

const results = []

// 觸控目標尺寸：只看可見、未停用的互動元素；行內文字連結走 2.5.8 的 inline 豁免；Element Plus 的原生 input 量它的 wrapper
//（min-height 44 設在 wrapper 上，點 wrapper 任何地方都會聚焦到 input）。
function measureTargets() {
  const SELECTOR = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"]'
  const seen = new Set()
  const out = []
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.closest('#nuxt-devtools-container')) continue
    if (el.matches('[disabled], .is-disabled, [aria-disabled="true"]') || el.closest('.is-disabled')) continue
    const box = el.classList.contains('el-input__inner') ? (el.closest('.el-input__wrapper') ?? el) : el
    if (seen.has(box)) continue
    const style = getComputedStyle(box)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
    if (style.display === 'inline' && box.tagName === 'A') continue
    const rect = box.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    seen.add(box)
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
    out.push({ rect, size: Math.round(Math.min(rect.width, rect.height)), element: `${box.tagName.toLowerCase()}${box.className && typeof box.className === 'string' ? '.' + box.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`, name })
  }
  // 2.5.8 的 spacing 例外：短邊 <24 的目標，以其外框中心畫直徑 24px 的圓，不碰到別的目標（或別的小目標的圓）就算過。
  // el-table 的排序鈕（.caret-wrapper，14px 高）靠這一條過，axe 的 target-size 也是這樣判的。
  const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  const circleHitsRect = (c, r) => Math.hypot(Math.max(r.left - c.x, 0, c.x - r.right), Math.max(r.top - c.y, 0, c.y - r.bottom)) < 12
  const targets = []
  for (const target of out) {
    if (target.size >= 44) continue
    let level = target.size < 24 ? 'fail' : 'warn'
    if (level === 'fail') {
      const c = center(target.rect)
      const crowded = out.some(other => other !== target && (other.size < 24
        ? Math.hypot(center(other.rect).x - c.x, center(other.rect).y - c.y) < 24
        : circleHitsRect(c, other.rect)))
      if (!crowded) level = 'spacing'
    }
    targets.push({ level, size: target.size, element: target.element, name: target.name })
  }
  return { coarse: matchMedia('(pointer: coarse)').matches, targets }
}

// 登入：桌機點頁首的「登入」，手機先開功能選單再點圖層裡的「登入」；FirebaseUI 的 email 流程兩步（email → 密碼）。Firebase 的登入狀態在
// IndexedDB，storageState 帶不走，所以每個 context 登入一次。
async function signIn(page, width) {
  // 要等 hydration 完：SSR 的「登入」按鈕在那之前點了沒反應（2026-10-08 第一次實跑卡在這裡）
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(500)
  if (width < 768) {
    await page.locator('.mobile-header__btn').first().click()
    await page.locator('.slide-layer--left:visible').waitFor({ timeout: 10000 })
    await page.locator('.slide-layer--left').getByRole('button', { name: /^登入/ }).first().click()
  } else {
    await page.locator('button[title="登入"]').first().click()
  }
  const ui = page.locator('#firebaseui-auth-container')
  await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
  await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL)
  await ui.locator('.firebaseui-id-submit').click()
  await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD)
  await ui.locator('.firebaseui-id-submit').click()
  // attached 不是 visible：手機上頭像連結收在功能選單裡，平常不顯示
  await page.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
  await page.locator('.post-login-loader').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
}

async function runAxe(page) {
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).exclude('.is-disabled').exclude('[disabled]').exclude('#nuxt-devtools-container').analyze()
  return axe.violations
    .map(violation => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.filter(node => !node.target.some(target => String(target).includes('nuxt-devtools'))).map(node => node.target.join(' ')) }))
    .filter(violation => violation.nodes.length)
}

function newRecord(route, mode, width) {
  const record = { route, mode, width, textScale, status: 'pass', checks: {}, axe: [], targets: [], names: [], pageErrors: [], hydration: [] }
  results.push(record)
  return record
}
const failOn = record => (name, ok, detail = '') => { record.checks[name] = ok ? 'pass' : `FAIL${detail ? ` (${detail})` : ''}`; if (!ok) record.status = 'fail' }
const summaryLine = record => `${record.status}${record.status === 'fail' ? ' — ' + Object.entries(record.checks).filter(([, value]) => value.startsWith('FAIL')).map(([name, value]) => `${name} ${value}`).join('; ') : record.skipReason ? ` (${record.skipReason})` : ''}`

const browser = await chromium.launch()
for (const mode of modes) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768, colorScheme: mode === 'dark' ? 'dark' : 'light' })
    await context.addCookies([
      { name: 'theme-mode', value: `%22${mode.toUpperCase()}%22`, domain: cookieDomain, path: '/' },
      { name: 'text-scale', value: `%22${textScale}%22`, domain: cookieDomain, path: '/' }
    ])
    // observe(document) 不是 documentElement：init script 跑的時候 <html> 還不存在。
    await context.addInitScript(() => new MutationObserver(() => document.querySelector('#nuxt-devtools-container')?.remove()).observe(document, { childList: true, subtree: true }))
    if (login) {
      const page = await context.newPage()
      try { await signIn(page, width) } catch (error) {
        console.error(`login ${mode}@${width} failed: ${String(error).slice(0, 200)}`)
        for (const route of routes) Object.assign(newRecord(route, mode, width), { status: 'fail', skipReason: '登入失敗' })
        await context.close()
        continue
      }
      await page.close()
    }

    for (const route of routes) {
      const label = `${route} ${mode}@${width}`
      const record = newRecord(route, mode, width)
      const fail = failOn(record)
      const status = (await fetch(`${baseUrl}${route}`).catch(() => ({ status: 0 }))).status
      if (status !== 200) {
        record.status = OPTIONAL_ROUTES.includes(route) ? 'skip' : 'fail'
        record.skipReason = `HTTP ${status}`
        console.log(`${label}: ${summaryLine(record)}`)
        continue
      }
      const page = await context.newPage()
      page.on('pageerror', error => record.pageErrors.push(String(error).slice(0, 200)))
      page.on('console', message => { if (/hydration/i.test(message.text())) record.hydration.push(message.text().slice(0, 200)) })
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 180000 })
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(1500)
      if (login) await page.locator('.post-login-loader').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})

      if (await page.locator('.load-failure:visible').count()) {
        record.status = 'skip'
        record.skipReason = '上游讀不到（讀取失敗彈窗開著）'
        console.log(`${label}: ${summaryLine(record)}`)
        await page.close()
        continue
      }

      const state = await page.evaluate(() => ({
        title: document.title,
        h1: [...document.querySelectorAll('h1')].filter(el => el.getClientRects().length > 0).length,
        dark: document.documentElement.classList.contains('dark'),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        signedIn: !!document.querySelector('.user-menu-button__trigger')
      }))
      fail('title', state.title.endsWith('｜安盈選股') || route === '/', state.title)
      fail('one h1', state.h1 === 1, `${state.h1}`)
      fail('mode', state.dark === (mode === 'dark'), `html.dark=${state.dark}`)
      fail('no horizontal scroll', state.overflow <= 1, `${state.overflow}px`)
      if (login) fail('signed in', state.signedIn)

      record.axe = await runAxe(page)
      record.names = record.axe.filter(violation => NAME_RULES.has(violation.id)).flatMap(violation => violation.nodes.map(node => `${violation.id}: ${node}`))
      fail('axe', record.axe.length === 0, record.axe.map(violation => `${violation.id}×${violation.nodes.length}`).join(' '))

      // 2.5.8 的 24px 對滑鼠也適用，所以每個寬度都量；44px 的警告只在觸控寬度。
      const measured = await page.evaluate(measureTargets)
      record.targets = measured.coarse ? measured.targets : measured.targets.filter(target => target.level !== 'warn')
      if (width < 768) fail('pointer coarse', measured.coarse)
      fail('targets ≥ 24px', !record.targets.some(target => target.level === 'fail'), record.targets.filter(target => target.level === 'fail').map(target => `${target.element} ${target.size}px`).join(' '))
      fail('no page errors', record.pageErrors.length === 0, record.pageErrors.join(' | '))
      record.checks.hydration = record.hydration.length ? `WARN ${record.hydration.length}` : 'pass'
      console.log(`${label}: ${summaryLine(record)}`)

      // 對話框：打開 → 等 role=dialog → axe → Esc → 等關閉。每個對話框自己一筆紀錄。
      for (const dialog of login ? (DIALOGS[route] ?? []) : []) {
        const dialogRecord = newRecord(`${route} › ${dialog.name}`, mode, width)
        const dialogFail = failOn(dialogRecord)
        const errorsBefore = record.pageErrors.length
        try {
          await dialog.open(page)
          // 認 el-dialog 本身：手機上第一個可見的 [role=dialog] 不一定是它（2026-10-08 誤判 Esc 沒關）
          const box = page.locator('.el-overlay:visible .el-dialog').first()
          await box.waitFor({ timeout: 10000 })
          // 等淡入動畫跑完再掃：半透明的那幾百毫秒 axe 會把標題在內的每段字都算成對比不足（2026-10-08 第一次實跑量到 19 個假陽性）
          await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'), null, { timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(300)
          dialogRecord.axe = await runAxe(page)
          dialogFail('axe', dialogRecord.axe.length === 0, dialogRecord.axe.map(violation => `${violation.id}×${violation.nodes.length}`).join(' '))
          await page.keyboard.press('Escape')
          dialogFail('Esc closes', await box.waitFor({ state: 'hidden', timeout: 5000 }).then(() => true).catch(() => false))
          dialogFail('no page errors', record.pageErrors.length === errorsBefore, record.pageErrors.slice(errorsBefore).join(' | '))
        } catch (error) {
          dialogRecord.status = 'skip'
          dialogRecord.skipReason = `打不開：${String(error).slice(0, 120)}`
        }
        console.log(`${dialogRecord.route} ${mode}@${width}: ${summaryLine(dialogRecord)}`)
      }
      await page.close()
    }
    await context.close()
  }
}
await browser.close()

// 報告：矩陣、違規、目標尺寸、缺名稱、溢出。
const combos = [...new Set(results.map(record => `${record.mode}@${record.width}`))]
const mark = record => record ? (record.status === 'pass' ? '✓' : record.status === 'skip' ? 'skip' : '✗') : '–'
const lines = [`# 無障礙檢查 ${new Date().toISOString().slice(0, 10)}${login ? '（登入）' : '（訪客）'}`, '', `來源 ${baseUrl}，文字 ${textScale}%，axe-core 標籤 ${AXE_TAGS.join('、')}。`, '',
  `| 路由 | ${combos.join(' | ')} |`, `|---|${combos.map(() => '---').join('|')}|`]
for (const route of new Set(results.map(record => record.route))) lines.push(`| ${route} | ${combos.map(combo => mark(results.find(record => record.route === route && `${record.mode}@${record.width}` === combo))).join(' | ')} |`)
const skips = results.filter(record => record.status === 'skip')
if (skips.length) lines.push('', '## 略過（環境，不是頁面）', '', ...skips.map(record => `- ${record.route} ${record.mode}@${record.width}：${record.skipReason}`))
const violations = results.flatMap(record => record.axe.map(violation => ({ ...violation, page: `${record.route} ${record.mode}@${record.width}` })))
lines.push('', '## axe 違規', '', violations.length ? '| 頁面 | 規則 | 嚴重度 | 元素 |' : '無。')
if (violations.length) lines.push('|---|---|---|---|', ...violations.map(violation => `| ${violation.page} | ${violation.id} | ${violation.impact} | ${violation.nodes.slice(0, 3).join('；')} |`))
// 24–43px 的只彙總（AA 的 2.5.8 是 24px；44px 是 AAA 的 2.5.5，月曆一頁就有二十幾個日期格），<24px 的逐項列。
const targetRows = results.filter(record => record.targets.length).map(record => {
  const fails = record.targets.filter(target => target.level === 'fail')
  const warns = record.targets.filter(target => target.level === 'warn')
  const byElement = [...warns.reduce((map, target) => map.set(target.element, (map.get(target.element) ?? 0) + 1), new Map())].map(([element, count]) => `${element}×${count}`).join('、')
  return `| ${record.route} ${record.mode}@${record.width} | ${fails.map(target => `${target.element}「${target.name}」${target.size}px`).join('；') || '—'} | ${warns.length ? `${warns.length} 個（最小 ${Math.min(...warns.map(target => target.size))}px）：${byElement}` : '—'} |`
})
lines.push('', '## 目標尺寸（<24px 在任何寬度都失敗，除非符合 2.5.8 的 spacing 例外；24–43px 只在觸控寬度警告）', '', targetRows.length ? '| 頁面 | <24px | 24–43px |' : '全部 ≥ 24px（觸控寬度 ≥ 44px）。')
if (targetRows.length) lines.push('|---|---|---|', ...targetRows)
const spacing = results.flatMap(record => record.targets.filter(target => target.level === 'spacing').map(target => `- ${record.route} ${record.mode}@${record.width}：${target.element} ${target.size}px`))
lines.push('', '## 靠 spacing 例外通過的小目標（列出備查）', '', ...(spacing.length ? [...new Set(spacing)] : ['無。']))
const names = results.flatMap(record => record.names.map(name => `- ${record.route} ${record.mode}@${record.width}：${name}`))
lines.push('', '## 缺名稱的控制項', '', ...(names.length ? names : ['無。']))
const overflow = results.filter(record => record.checks['no horizontal scroll']?.startsWith('FAIL')).map(record => `- ${record.route} ${record.mode}@${record.width}：${record.checks['no horizontal scroll']}`)
lines.push('', `## 橫向溢出（${widths.join('／')}px）`, '', ...(overflow.length ? overflow : ['無。']))
const hydration = results.filter(record => record.hydration.length).map(record => `- ${record.route} ${record.mode}@${record.width}：${record.hydration.length} 則`)
lines.push('', '## hydration 警告（列出，不算失敗）', '', ...(hydration.length ? hydration : ['無。']))

mkdirSync(reportDir, { recursive: true })
writeFileSync(`${reportDir}/report.json`, JSON.stringify({ baseUrl, textScale, modes, widths, axeTags: AXE_TAGS, generatedAt: new Date().toISOString(), results }, null, 2))
writeFileSync(`${reportDir}/summary.md`, lines.join('\n') + '\n')
const failed = results.filter(record => record.status === 'fail')
console.log(`\n${results.length} 組，${failed.length} 失敗，${skips.length} 略過。報告：${reportDir}/summary.md`)
if (failed.length) {
  console.log('FAILURES:')
  for (const record of failed) console.log(`  ${record.route} ${record.mode}@${record.width}: ${record.skipReason ?? Object.entries(record.checks).filter(([, value]) => value.startsWith('FAIL')).map(([name, value]) => `${name} ${value}`).join('; ')}`)
  process.exit(1)
}
console.log('PASS: a11y pages')
