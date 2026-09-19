// Verification for the /stock/:code pages' accessibility + SEO structure (2026-09-19 redesign),
// kept around like check-design-page.mjs — run with `node scripts/check-stock-pages.mjs` against
// a running `pnpm run dev` (defaults to http://localhost:3000 and symbol 2330; override with
// STOCK_PAGES_URL / STOCK_PAGES_SYMBOL). Cookie-less contexts on purpose: that is what every
// crawler and every first-time visitor gets (see StockPageNav.vue's own comment).
//
// Per route it checks the server-rendered HTML (one <h1>, a h1→h2→h3 outline with no skipped
// level, the three labelled <nav>s, BreadcrumbList JSON-LD, a <title>, no `?tab=`) and, after
// hydration, that the「資料摘要與來源」text is identical to the SSR text (a mismatch there is the
// hydration bug useStockPageDigest/stock-digest.ts are built to avoid), that no page error fired,
// and axe (wcag2a/wcag2aa/best-practice) reports nothing beyond the app-shell issues on record.
// 公司健檢 additionally gets its anchor section nav exercised (hash changes, search stays empty,
// focus lands in the section) and its chart figures counted.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.STOCK_PAGES_URL ?? 'http://localhost:3000'
const symbol = process.env.STOCK_PAGES_SYMBOL ?? '2330'
const ROUTES = ['', '/dividend', '/company-health', '/metrics-history', '/financial-statements', '/f-score']
// App-shell rules known to fail on every page (header menubar children, header search
// aria-activedescendant, footer inside main, skip links/logo outside landmarks) — tracked as
// layout-level follow-ups, not stock-page regressions. Anything else is a failure.
const KNOWN_SHELL_RULES = new Set(['aria-required-children', 'aria-valid-attr-value', 'landmark-contentinfo-is-top-level', 'region'])

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

function digestText(html) {
  const section = stripComments(html).match(/<section[^>]*class="stock-digest"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? ''
  return section.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function outlineIsValid(order) {
  let previous = 0
  for (const level of order) {
    if (level > previous + 1) return false
    previous = level
  }
  return true
}

const browser = await chromium.launch()
const failures = []
for (const route of ROUTES) {
  const url = `${baseUrl}/stock/${symbol}${route}`
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))

  const ssrHtml = await (await page.request.get(url)).text()
  const ssr = stripComments(ssrHtml)
  const checks = {
    h1: (ssr.match(/<h1[\s>]/g) ?? []).length === 1,
    outline: outlineIsValid([...ssr.matchAll(/<h([1-3])[\s>]/g)].map(m => Number(m[1]))),
    navs: ['個股頁面', '麵包屑'].every(label => ssr.includes(`aria-label="${label}"`)),
    breadcrumbJsonLd: ssr.includes('"BreadcrumbList"'),
    title: /<title>[^<]+｜安盈選股<\/title>/.test(ssr),
    noTabQuery: !ssr.includes('?tab='),
    description: /<meta name="description" content="[^"]{20,}"/.test(ssr)
  }

  await page.goto(url, { waitUntil: 'load', timeout: 180000 })
  await page.locator('nav[aria-label="個股頁面"]').waitFor({ state: 'visible', timeout: 90000 })
  await page.waitForTimeout(12000)
  const liveDigest = (await page.locator('section.stock-digest').count()) ? (await page.locator('section.stock-digest').innerText()).replace(/\s+/g, ' ').trim() : ''
  checks.digestStable = digestText(ssrHtml) === liveDigest

  if (route === '/company-health') {
    const nav = page.locator('nav[aria-label="公司健檢分類"]')
    checks.sectionNav = (await nav.locator('a').count()) === 8
    await nav.locator('a', { hasText: '財務韌性' }).focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2500)
    checks.anchorJump = (await page.evaluate(() => [decodeURIComponent(location.hash), location.search, document.activeElement?.id])).join('|') === '#stock-section-財務韌性||stock-section-財務韌性'
    checks.figures = (await page.locator('figure.shared-chart-figure [role="img"][aria-label]').count()) >= 3
  }

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'best-practice']).analyze()
  const unexpected = axe.violations.filter(violation => !KNOWN_SHELL_RULES.has(violation.id)).map(violation => `${violation.id}×${violation.nodes.length}`)
  checks.axe = unexpected.length === 0
  checks.noPageErrors = pageErrors.length === 0

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name)
  console.log(`${route || '/'}: ${failed.length ? `FAIL ${failed.join(', ')}` : 'ok'}${unexpected.length ? ` axe=${unexpected.join(' ')}` : ''}${pageErrors.length ? ` errors=${pageErrors[0]}` : ''}`)
  if (failed.length) failures.push(route || '/')
  await context.close()
}
await browser.close()
console.log(failures.length ? `FAIL: ${failures.join(' ')}` : 'PASS: stock pages')
process.exit(failures.length ? 1 : 0)
