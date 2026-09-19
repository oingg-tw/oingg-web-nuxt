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
const BACKEND_OWNED = ['股利穩健', '股價偏低']
const QUERY_LINK_ALLOW = [/^\/screener\?(sector|template)=/]

// Routes: expectations on the SSR HTML beyond the shared checks.
const ROUTES = [
  { path: '/', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0 },
  { path: '/stock', stockLinksMin: 2000, industryLinksMin: 30, tablesMin: 0 },
  { path: '/industry/24-semiconductor', stockLinksMin: 100, industryLinksMin: 30, tablesMin: 1 },
  { path: '/industry/13-electronics-legacy', stockLinksMin: 5, industryLinksMin: 30, tablesMin: 0, noindex: true }
]

const STATUS_CASES = [
  { path: '/industry/24-wrong', status: 301, location: '/industry/24-semiconductor' },
  { path: '/industry/99-x', status: 404 },
  { path: '/industry/19-conglomerate', status: 404 },
  { path: '/industry/abc', status: 404 }
]

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

function tableTexts(html) {
  return [...stripComments(html).matchAll(/<table[^>]*data-ssr-table[^>]*>([\s\S]*?)<\/table>/g)].map(match => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
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
  expect(route.path, 'description 60–90', route.path === '/' || route.noindex || (cjkLength(description) >= 60 && cjkLength(description) <= 90), `${cjkLength(description)}`)
  expect(route.path, 'self canonical', canonical === `${baseUrl}${route.path}` && !canonical.includes('?'), canonical)
  expect(route.path, 'BreadcrumbList', route.path === '/' || ssr.includes('"BreadcrumbList"'))
  expect(route.path, 'no query links', internalHrefs.every(href => !href.includes('?') || QUERY_LINK_ALLOW.some(pattern => pattern.test(href))), internalHrefs.filter(href => href.includes('?')).slice(0, 3).join(' '))
  expect(route.path, 'no banned words', banned.every(word => backendOwned.some(phrase => phrase.includes(word))), banned.join(','))
  if (backendOwned.length) console.log(`${route.path}: backend-owned phrases present (warning): ${backendOwned.join(', ')}`)
  expect(route.path, `stock links ≥ ${route.stockLinksMin}`, new Set(internalHrefs.filter(href => /^\/stock\/\d{4}$/.test(href))).size >= route.stockLinksMin)
  expect(route.path, `industry links ≥ ${route.industryLinksMin}`, new Set(internalHrefs.filter(href => href.startsWith('/industry/'))).size >= route.industryLinksMin)
  expect(route.path, `tables ≥ ${route.tablesMin}`, (ssr.match(/<table[^>]*data-ssr-table/g) ?? []).length >= route.tablesMin)
  expect(route.path, 'no Product/AggregateRating', !ssr.includes('"Product"') && !ssr.includes('"AggregateRating"'))
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
    .map(violation => ({ id: violation.id, nodes: violation.nodes.filter(node => !node.target.some(target => String(target).includes('nuxt-devtools'))) }))
    .filter(violation => violation.nodes.length)
    .map(violation => `${violation.id}×${violation.nodes.length}`)
  expect(route.path, 'axe', violations.length === 0, violations.join(' '))

  console.log(`${route.path}: ${failures.some(failure => failure.startsWith(`${route.path} `)) ? 'FAIL' : 'ok'}`)
  await context.close()
}
await browser.close()

if (failures.length) {
  console.log('FAILURES:')
  for (const failure of failures) console.log(`  ${failure}`)
  process.exit(1)
}
console.log('PASS: hub pages')
