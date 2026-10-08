// 公開頁的無障礙與手機檢查（2026-10-08，認證用）。每個 路由 × 模式 × 寬度 用真瀏覽器載入，驗：<title> 以「｜安盈選股」結尾且恰好
// 一個可見 h1；html.dark 跟 theme-mode cookie 一致；沒有橫向捲動；axe（wcag2a／wcag2aa／wcag21a／wcag21aa／wcag22aa／best-practice，
// 排除 disabled 的控制項——WCAG 1.4.3 豁免）；手機寬度在 (pointer: coarse) 下每個可見互動元素任一邊 <24px 是 FAIL（2.5.8）、<44 是
// WARN；缺名稱的控制項另列；page error 要是 0，hydration 警告列出不算失敗。個股頁／hub 頁／總經頁有各自的腳本，同一組 axe 標籤，
// 這裡不重複。結果寫成 report.json＋summary.md，讓第三方重跑：`node --env-file=.env scripts/check-a11y-pages.mjs`。
//
// 環境變數：A11Y_PAGES_URL；A11Y_PAGES_ROUTES（逗號分隔子集，Git Bash 下寫不帶斜線的 `calendar`，`index` 指首頁）；
// A11Y_PAGES_MODES=light,dark；A11Y_PAGES_WIDTHS=375,1440（驗 1.4.10 另跑 320）；A11Y_PAGES_TEXT_SCALE=100|110|120；
// A11Y_REPORT_DIR（預設 a11y-report/<時間>，已 gitignore）。
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

// 公開路由。/blog/<slug> 與 /preferred-stocks/<code> 從列表頁的 SSR 連結取第一個；/design 只在 dev 有（正式環境 404 是刻意的範圍邊界）。
const STATIC_ROUTES = ['/', '/calendar', '/watchlist', '/holdings', '/appearance', '/sitemap', '/accessibility', '/preferred-stocks', '/etf-zone',
  '/guru-indicators', '/blog', '/industries', '/stock/2330/quick-view', '/screener?template=value']
const OPTIONAL_ROUTES = ['/design']

async function firstLink(listPath, pattern) {
  const html = await (await fetch(`${baseUrl}${listPath}`)).text().catch(() => '')
  return html.match(pattern)?.[1] ?? null
}

const discovered = [
  await firstLink('/blog', /href="(\/blog\/[a-z0-9-]+)"/),
  await firstLink('/preferred-stocks', /href="(\/preferred-stocks\/[0-9A-Z]+)"/)
]
const allRoutes = [...STATIC_ROUTES, ...discovered.filter(Boolean), ...OPTIONAL_ROUTES]
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
    const size = Math.round(Math.min(rect.width, rect.height))
    if (size >= 44) continue
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
    out.push({ level: size < 24 ? 'fail' : 'warn', size, element: `${box.tagName.toLowerCase()}${box.className && typeof box.className === 'string' ? '.' + box.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`, name })
  }
  return { coarse: matchMedia('(pointer: coarse)').matches, targets: out }
}

const browser = await chromium.launch()
for (const route of routes) {
  for (const mode of modes) {
    for (const width of widths) {
      const label = `${route} ${mode}@${width}`
      const record = { route, mode, width, textScale, status: 'pass', checks: {}, axe: [], targets: [], names: [], pageErrors: [], hydration: [] }
      results.push(record)
      const fail = (name, ok, detail = '') => { record.checks[name] = ok ? 'pass' : `FAIL${detail ? ` (${detail})` : ''}`; if (!ok) record.status = 'fail' }

      const status = (await fetch(`${baseUrl}${route}`).catch(() => ({ status: 0 }))).status
      if (status !== 200) {
        record.status = OPTIONAL_ROUTES.includes(route) ? 'skip' : 'fail'
        record.skipReason = `HTTP ${status}`
        console.log(`${label}: ${record.status} (HTTP ${status})`)
        continue
      }

      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
      await context.addCookies([
        { name: 'theme-mode', value: `%22${mode.toUpperCase()}%22`, domain: cookieDomain, path: '/' },
        { name: 'text-scale', value: `%22${textScale}%22`, domain: cookieDomain, path: '/' }
      ])
      const page = await context.newPage()
      // observe(document) 不是 documentElement：init script 跑的時候 <html> 還不存在。
      await page.addInitScript(() => new MutationObserver(() => document.querySelector('#nuxt-devtools-container')?.remove()).observe(document, { childList: true, subtree: true }))
      page.on('pageerror', error => record.pageErrors.push(String(error).slice(0, 200)))
      page.on('console', message => { if (/hydration/i.test(message.text())) record.hydration.push(message.text().slice(0, 200)) })
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 180000 })
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(1500)

      if (await page.locator('.load-failure:visible').count()) {
        record.status = 'skip'
        record.skipReason = '上游讀不到（讀取失敗彈窗開著）'
        console.log(`${label}: skip (${record.skipReason})`)
        await context.close()
        continue
      }

      const state = await page.evaluate(() => ({
        title: document.title,
        h1: [...document.querySelectorAll('h1')].filter(el => el.getClientRects().length > 0).length,
        dark: document.documentElement.classList.contains('dark'),
        overflow: document.documentElement.scrollWidth - window.innerWidth
      }))
      fail('title', state.title.endsWith('｜安盈選股') || route === '/', state.title)
      fail('one h1', state.h1 === 1, `${state.h1}`)
      fail('mode', state.dark === (mode === 'dark'), `html.dark=${state.dark}`)
      fail('no horizontal scroll', state.overflow <= 1, `${state.overflow}px`)

      const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).exclude('.is-disabled').exclude('[disabled]').exclude('#nuxt-devtools-container').analyze()
      record.axe = axe.violations
        .map(violation => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.filter(node => !node.target.some(target => String(target).includes('nuxt-devtools'))).map(node => node.target.join(' ')) }))
        .filter(violation => violation.nodes.length)
      record.names = record.axe.filter(violation => NAME_RULES.has(violation.id)).flatMap(violation => violation.nodes.map(node => `${violation.id}: ${node}`))
      fail('axe', record.axe.length === 0, record.axe.map(violation => `${violation.id}×${violation.nodes.length}`).join(' '))

      // 2.5.8 的 24px 對滑鼠也適用，所以每個寬度都量；44px 的警告只在觸控寬度（手機第一輪就量到 16px 的圖示連結與 14px 的 el-tag 關閉鈕）。
      const measured = await page.evaluate(measureTargets)
      record.targets = measured.coarse ? measured.targets : measured.targets.filter(target => target.level === 'fail')
      if (width < 768) fail('pointer coarse', measured.coarse)
      fail('targets ≥ 24px', !record.targets.some(target => target.level === 'fail'), record.targets.filter(target => target.level === 'fail').map(target => `${target.element} ${target.size}px`).join(' '))
      fail('no page errors', record.pageErrors.length === 0, record.pageErrors.join(' | '))
      record.checks.hydration = record.hydration.length ? `WARN ${record.hydration.length}` : 'pass'
      console.log(`${label}: ${record.status}${record.status === 'fail' ? ' — ' + Object.entries(record.checks).filter(([, value]) => value.startsWith('FAIL')).map(([name, value]) => `${name} ${value}`).join('; ') : ''}`)
      await context.close()
    }
  }
}
await browser.close()

// 報告：矩陣、違規、目標尺寸、缺名稱、溢出。
const combos = [...new Set(results.map(record => `${record.mode}@${record.width}`))]
const mark = record => record ? (record.status === 'pass' ? '✓' : record.status === 'skip' ? 'skip' : '✗') : '–'
const lines = [`# 無障礙檢查 ${new Date().toISOString().slice(0, 10)}`, '', `來源 ${baseUrl}，文字 ${textScale}%，axe-core 標籤 ${AXE_TAGS.join('、')}。`, '',
  `| 路由 | ${combos.join(' | ')} |`, `|---|${combos.map(() => '---').join('|')}|`]
for (const route of routes) lines.push(`| ${route} | ${combos.map(combo => mark(results.find(record => record.route === route && `${record.mode}@${record.width}` === combo))).join(' | ')} |`)
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
lines.push('', '## 目標尺寸（<24px 在任何寬度都失敗；24–43px 只在觸控寬度警告）', '', targetRows.length ? '| 頁面 | <24px | 24–43px |' : '全部 ≥ 24px（觸控寬度 ≥ 44px）。')
if (targetRows.length) lines.push('|---|---|---|', ...targetRows)
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
