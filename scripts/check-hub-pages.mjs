// Verification for the hub pages of the 2026-09-19 SEO build（/stock 個股總表, /industry/…, and
// later /rank/…, /screener/{slug}, /metrics/…）plus the landing page's new link sections — the
// sibling of check-stock-pages.mjs. Run with `node scripts/check-hub-pages.mjs` against a running
// `pnpm run dev`（HUB_PAGES_URL / HUB_PAGES_WIDTH to override）. Cookie-less contexts on purpose:
// that is what every crawler and first-time visitor gets.
//
// Per route, the server-rendered HTML must have: exactly one <h1>; an h1→h2→h3 outline with no
// skipped level; a <title> ending with the brand and ≤ 32 CJK-equivalent characters; a meta
// description of 60–90 CJK-equivalent characters; a self canonical without a query; BreadcrumbList
// JSON-LD; no internal href carrying a `?`（view state never becomes a URL variant — the
// screener deep links are the one deliberate exception and are allow-listed）; none of the
// compliance register's banned words outside <script>（backend-owned phrases are reported, not
// failed）; and the per-route link/table expectations below. After hydration: no page error, no
// console message mentioning Hydration, the SSR text of every [data-ssr-table] identical to the
// live text, and axe（wcag2a/wcag2aa/best-practice）clean. Status expectations（404 for unknown
// codes/slugs, 301 for a stale sector slug）are checked without a browser.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.HUB_PAGES_URL ?? 'http://localhost:3000'
const width = Number(process.env.HUB_PAGES_WIDTH ?? 1440)

const BANNED = /便宜|合理|昂貴|偏低|偏高|穩健|優於|勝過|領先|贏過|排名前段|表現突出|資料不足|推薦買進|目標價/g
// Emptied 2026-09-20: all three entries (股利穩健, 股價偏低, 不代表便宜或該買) were allowances for
// analysis-ts's own copy, and analysis-ts has since rewritten every one of them — they built the
// same banned-word regex into a pre-push scan on their side (20d5ba4b), so backend copy is now
// linted at its source rather than excused at ours. Verified here first, not taken on report: all
// three are gone from GET /metrics and GET /stocks/:symbol/badges, and both check scripts run
// clean with this list empty. Kept as an empty hook rather than deleted, since the next piece of
// compliance-reviewed backend phrasing that trips the regex will need it again.
const BACKEND_OWNED = []
const QUERY_LINK_ALLOW = [/^\/screener\?(sector|template)=/]

// Routes: expectations on the SSR HTML beyond the shared checks.
const ROUTES = [
  { path: '/', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0 },
  // Rebuilt 2026-09-19 (interface-complexity review) into a 35-row sector table — no more
  // per-company links on this page (they moved entirely to /industry/…), hence stockLinksMin: 0.
  { path: '/stock', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 1 },
  { path: '/industry/24-semiconductor', stockLinksMin: 100, industryLinksMin: 30, tablesMin: 1 },
  { path: '/industry/13-electronics-legacy', stockLinksMin: 5, industryLinksMin: 30, tablesMin: 0, noindex: true },
  { path: '/rank', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, rankLinksMin: 8 },
  { path: '/rank/dividend-yield', stockLinksMin: 50, industryLinksMin: 0, tablesMin: 1, disclaimer: true },
  // The two app pages: no visible breadcrumb（所以沒有 BreadcrumbList — the JSON-LD must match what
  // is on the page). /screener's own axeIgnore for the guest onboarding el-dialog's landmark nit
  // was removed 2026-09-19 — that dialog is gone (see useGuestScreener.ts's own comment), so
  // there's no longer anything on load that trips those rules.
  { path: '/screener', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0, templateLinksMin: 7, noDescriptionWindow: true, noBreadcrumb: true },
  { path: '/screener/value', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1, disclaimer: true, noStockLinks: true },
  { path: '/industries', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0, noDescriptionWindow: true, noBreadcrumb: true },
  // /macro/policy-rate（2026-09-21, moved 09-22）— the first market-wide page that links to no
  // company and no sector,
  // so both link floors are 0 on purpose rather than by oversight. Its one table is the 56-row
  // rate-decision history, which is also the page's indexable content.
  { path: '/macro/policy-rate', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  // 總經特區's other six, all on the one /macro/[slug] template. Sampled rather than exhaustive
  // would have been tempting, but each carries a different upstream contract（two of them take
  // category, one follows the daily tradeDate shape instead of period）and the exchange-rate page
  // shipped broken for exactly that reason before this list caught it by hand.
  { path: '/macro/business-cycle', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/money-supply', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/bond-yield', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/exchange-rate', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/inflation', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/gdp-growth', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/metrics', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 7, metricLinksMin: 1 },
  { path: '/metrics/piotroski-f-score', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true },
  // roe/gross-margin joined METRIC_PAGE_SLUGS 2026-09-20 (the badge-page family) — no longer
  // noindex, so the shared description-length window (60–90 CJK) now applies for real.
  { path: '/metrics/roe', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true },
  { path: '/metrics/gross-margin', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true },
  // liveGrahamNumber deliberately NOT in METRIC_PAGE_SLUGS yet — see that array's own comment
  // (hub-slugs.ts): its meta description truncates under the 60-CJK floor once
  // clampDescription(text, 90) runs on its ASCII-heavy raw text. `noindex: true` here both
  // documents that as a known, accepted gap and skips the description-length assertion (same as
  // every other noindex route in this list), rather than silently exempting just this one check.
  { path: '/metrics/live-graham-number', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true, noindex: true }
]

const STATUS_CASES = [
  { path: '/industry/24-wrong', status: 301, location: '/industry/24-semiconductor' },
  { path: '/industry/99-x', status: 404 },
  { path: '/industry/19-conglomerate', status: 404 },
  { path: '/industry/abc', status: 404 },
  { path: '/rank/nope', status: 404 },
  { path: '/screener/nope', status: 404 },
  { path: '/metrics/nope', status: 404 },
  // camelCase input must not become a second URL for the same page.
  { path: '/metrics/piotroskiFScore', status: 404 },
  // The badge-page catch-all (app/pages/stock/[code]/[slug].vue, 2026-09-20) must throw a real
  // 404 on an unrecognized slug, not render an empty page — this is what stops it from silently
  // swallowing a typo'd URL the same way the named sub-routes' own 404s work.
  { path: '/stock/2330/nope', status: 404 }
]

const DISCLAIMER = '本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。'

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

function cjkLength(text) {
  let length = 0
  for (const char of text) length += /[　-鿿＀-￯]/.test(char) ? 1 : 0.5
  return length
}

function outlineIsValid(order) {
  let previous = 0
  for (const level of order) {
    if (level > previous + 1) return false
    previous = level
  }
  return true
}

// The site footer's legal disclaimer says「不構成…目標價」— a negation of a banned word, on every
// page; the scan covers the page's own content, so the <footer> is dropped first.
function visibleText(html) {
  return stripComments(html)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
}

// innerText (the live side of the 'tables stable' comparison) gives DECODED text, so the SSR side
// has to decode too or any table holding a character Vue's SSR escapes fails the comparison for a
// reason that has nothing to do with hydration. Found 2026-09-20: analysis-ts merged its O'Neil
// badges into one `oneilCanslimScore`, whose 顯示名稱 carries an apostrophe — SSR renders it
// `O&#39;Neil`, innerText reads `O'Neil`, and /metrics went red with a 7/7 count match. &amp; is
// decoded last so an escaped entity (`&amp;#39;`) doesn't get double-decoded into a real one.
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function tableTexts(html) {
  return [...stripComments(html).matchAll(/<table[^>]*data-ssr-table[^>]*>([\s\S]*?)<\/table>/g)].map(match => decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
}

const failures = []
function expect(route, name, ok, detail = '') {
  if (!ok) failures.push(`${route} ${name}${detail ? ` (${detail})` : ''}`)
}

for (const { path, status, location } of STATUS_CASES) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
  expect(path, `status ${status}`, response.status === status, `got ${response.status}`)
  if (location) expect(path, 'redirect target', (response.headers.get('location') ?? '').endsWith(location), response.headers.get('location') ?? '')
}

const browser = await chromium.launch()
for (const route of ROUTES) {
  const url = `${baseUrl}${route.path}`
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  const hydrationMessages = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  page.on('console', message => {
    if (/hydration/i.test(message.text())) hydrationMessages.push(message.text().slice(0, 160))
  })

  const ssrHtml = await (await page.request.get(url)).text()
  const ssr = stripComments(ssrHtml)
  const title = ssr.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
  const description = ssr.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
  const canonical = ssr.match(/rel="canonical" href="([^"]*)"/)?.[1] ?? ''
  const robots = ssr.match(/name="robots" content="([^"]*)"/)?.[1] ?? ''
  const internalHrefs = [...ssr.matchAll(/href="(\/[^"]*)"/g)].map(match => match[1]).filter(href => !href.startsWith('/_nuxt') && !href.startsWith('/api/'))
  const text = visibleText(ssrHtml)
  const banned = [...new Set([...text.matchAll(BANNED)].map(match => match[0]))]
  const backendOwned = BACKEND_OWNED.filter(phrase => text.includes(phrase))

  expect(route.path, 'one h1', (ssr.match(/<h1[\s>]/g) ?? []).length === 1)
  expect(route.path, 'outline', outlineIsValid([...ssr.matchAll(/<h([1-3])[\s>]/g)].map(match => Number(match[1]))))
  expect(route.path, 'title brand', /｜安盈選股$/.test(title) || route.path === '/', title)
  expect(route.path, 'title length ≤ 32', route.path === '/' || cjkLength(title) <= 32, `${cjkLength(title)}`)
  // Length window only for indexable pages（a noindex page still gets a description, just not a
  // search-snippet-tuned one）; the landing page keeps its own hand-written copy.
  expect(route.path, 'description 60–90', route.path === '/' || route.noindex || route.noDescriptionWindow || (cjkLength(description) >= 60 && cjkLength(description) <= 90), `${cjkLength(description)}`)
  expect(route.path, 'self canonical', canonical === `${baseUrl}${route.path}` && !canonical.includes('?'), canonical)
  expect(route.path, 'BreadcrumbList', route.path === '/' || route.noBreadcrumb || ssr.includes('"BreadcrumbList"'))
  if (route.metricLinksMin) expect(route.path, `metric links ≥ ${route.metricLinksMin}`, new Set(internalHrefs.filter(href => /^\/metrics\/[a-z0-9-]+$/.test(href))).size >= route.metricLinksMin)
  expect(route.path, 'no query links', internalHrefs.every(href => !href.includes('?') || QUERY_LINK_ALLOW.some(pattern => pattern.test(href))), internalHrefs.filter(href => href.includes('?')).slice(0, 3).join(' '))
  expect(route.path, 'no banned words', banned.every(word => backendOwned.some(phrase => phrase.includes(word))), banned.join(','))
  if (backendOwned.length) console.log(`${route.path}: backend-owned phrases present (warning): ${backendOwned.join(', ')}`)
  expect(route.path, `stock links ≥ ${route.stockLinksMin}`, new Set(internalHrefs.filter(href => /^\/stock\/\d{4}$/.test(href))).size >= route.stockLinksMin)
  expect(route.path, `industry links ≥ ${route.industryLinksMin}`, new Set(internalHrefs.filter(href => href.startsWith('/industry/'))).size >= route.industryLinksMin)
  expect(route.path, `tables ≥ ${route.tablesMin}`, (ssr.match(/<table[^>]*data-ssr-table/g) ?? []).length >= route.tablesMin)
  expect(route.path, 'no Product/AggregateRating', !ssr.includes('"Product"') && !ssr.includes('"AggregateRating"'))
  if (route.rankLinksMin) expect(route.path, `rank links ≥ ${route.rankLinksMin}`, new Set(internalHrefs.filter(href => /^\/rank\/[a-z-]+$/.test(href))).size >= route.rankLinksMin)
  if (route.templateLinksMin) expect(route.path, `template links ≥ ${route.templateLinksMin}`, new Set(internalHrefs.filter(href => /^\/screener\/[a-z-]+$/.test(href))).size >= route.templateLinksMin)
  // The compliance line sits in the page body（above the ranking table / at the end of a
  // condition page）, not only in the footer.
  if (route.disclaimer) expect(route.path, 'disclaimer in body', text.includes(DISCLAIMER))
  // A condition page shows a count, never the matching companies.
  if (route.noStockLinks) expect(route.path, 'no stock list', internalHrefs.every(href => !/^\/stock\/\d{4}$/.test(href)))
  expect(route.path, 'scroll regions labelled', [...ssr.matchAll(/class="shared-table-scroll[^>]*>/g)].every(match => match[0].includes('tabindex="0"') && match[0].includes('aria-label=')))
  if (route.noindex) expect(route.path, 'noindex, follow', robots.includes('noindex') && robots.includes('follow'), robots)

  await page.goto(url, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(6000)
  const liveTables = await page.locator('table[data-ssr-table]').evaluateAll(tables => tables.map(table => table.innerText.replace(/\s+/g, ' ').trim()))
  const ssrTables = tableTexts(ssrHtml)
  expect(route.path, 'tables stable', ssrTables.length === liveTables.length && ssrTables.every((table, index) => table === liveTables[index]), `${ssrTables.length}/${liveTables.length}`)
  expect(route.path, 'no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  expect(route.path, 'no hydration messages', hydrationMessages.length === 0, hydrationMessages.join(' | '))

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'best-practice']).analyze()
  const violations = axe.violations
    .filter(violation => !(route.axeIgnore ?? []).includes(violation.id))
    .map(violation => ({ id: violation.id, nodes: violation.nodes.filter(node => !node.target.some(target => String(target).includes('nuxt-devtools'))) }))
    .filter(violation => violation.nodes.length)
    .map(violation => `${violation.id}×${violation.nodes.length}`)
  expect(route.path, 'axe', violations.length === 0, violations.join(' '))

  console.log(`${route.path}: ${failures.some(failure => failure.startsWith(`${route.path} `)) ? 'FAIL' : 'ok'}`)
  await context.close()
}
// Deep link from a condition page: a guest landing on /screener?template=value gets that
// template's tab（no onboarding dialog）, real result rows, the guest banner, and a URL with the
// query dropped once applied.
{
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  await page.goto(`${baseUrl}/screener?template=value`, { waitUntil: 'load', timeout: 180000 })
  await page.locator('.screener-page__guest-banner').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(8000)
  const state = await page.evaluate(() => ({
    banner: !!document.querySelector('.screener-page__guest-banner'),
    dialogOpen: !!document.querySelector('.el-dialog[aria-modal="true"]'),
    rows: document.querySelectorAll('.el-table__body .el-table__row').length,
    search: location.search
  }))
  expect('/screener?template=value', 'guest tab from template', state.banner && !state.dialogOpen, JSON.stringify(state))
  expect('/screener?template=value', 'result rows', state.rows > 0, `${state.rows}`)
  expect('/screener?template=value', 'query dropped', state.search === '', state.search)
  expect('/screener?template=value', 'no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  console.log(`/screener?template=value: ${failures.some(failure => failure.startsWith('/screener?template=value ')) ? 'FAIL' : 'ok'}`)
  await context.close()
}
// Guest strategy picker (2026-09-19, replacing the old onboarding dialog — interface-complexity
// review): no dialog opens on load, the picker's own tiles are in the page, and picking one +
// confirming produces the same guest banner + result rows the deep-link case above gets.
{
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  await page.goto(`${baseUrl}/screener`, { waitUntil: 'load', timeout: 180000 })
  await page.locator('.guest-picker__tile').first().waitFor({ state: 'visible', timeout: 60000 })
  const noDialogOnLoad = await page.evaluate(() => document.querySelector('.el-dialog[aria-modal="true"]') === null)
  expect('/screener (guest picker)', 'no dialog on load', noDialogOnLoad)
  const tileCount = await page.locator('.guest-picker__tile').count()
  expect('/screener (guest picker)', 'tiles ≥ 7', tileCount >= 7, `${tileCount}`)
  await page.locator('.guest-picker__tile').first().click()
  await page.locator('.guest-picker__confirm').click()
  await page.locator('.screener-page__guest-banner').waitFor({ state: 'visible', timeout: 60000 })
  await page.waitForTimeout(8000)
  const rows = await page.locator('.el-table__body .el-table__row').count()
  expect('/screener (guest picker)', 'result rows after confirm', rows > 0, `${rows}`)
  expect('/screener (guest picker)', 'no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  console.log(`/screener (guest picker): ${failures.some(failure => failure.startsWith('/screener (guest picker) ')) ? 'FAIL' : 'ok'}`)
  await context.close()
}
await browser.close()

if (failures.length) {
  console.log('FAILURES:')
  for (const failure of failures) console.log(`  ${failure}`)
  process.exit(1)
}
console.log('PASS: hub pages')
