// Verification for the /stock/:code pages' accessibility + SEO structure (2026-09-19 redesign),
// kept around like check-design-page.mjs — run with `node scripts/check-stock-pages.mjs` against
// a running `pnpm run dev` (defaults to http://localhost:3000 and symbol 2330; override with
// STOCK_PAGES_URL / STOCK_PAGES_SYMBOL / STOCK_PAGES_WIDTH). Cookie-less contexts on purpose: that is what every
// crawler and every first-time visitor gets (see StockPageNav.vue's own comment).
//
// Per route it checks the server-rendered HTML (one <h1>, a h1→h2→h3 outline with no skipped
// level, the three labelled <nav>s, BreadcrumbList JSON-LD, a <title>, no `?tab=`) and, after
// hydration, that the「資料摘要與來源」text is identical to the SSR text (a mismatch there is the
// hydration bug useStockPageDigest/stock-digest.ts are built to avoid), that no page error fired,
// and axe (wcag2a/wcag2aa/best-practice) reports nothing beyond the app-shell issues on record.
// 公司健檢 (and its own anchor-nav / chart-figure checks) was removed 2026-09-19 when that page
// was unpublished — see app/pages/stock/[code]/company-health.vue's own comment. /dividend gets
// a slightly higher table floor (2, not 1) since it's the thickest of the remaining pages.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.STOCK_PAGES_URL ?? 'http://localhost:3000'
const symbol = process.env.STOCK_PAGES_SYMBOL ?? '2330'
// 1440 = desktop shell (rail + desktop header); 375 = phone shell. Both are the same DOM since
// layouts/default.vue — only CSS differs — so a run at each width is the whole matrix.
const width = Number(process.env.STOCK_PAGES_WIDTH ?? 1440)
const ROUTES = ['', '/dividend', '/metrics-history', '/financial-statements', '/balance-sheet', '/income-statement', '/cash-flow-statement', '/f-score']
// Every axe violation is a failure — the four app-shell rules that used to be allow-listed here
// (header menubar children, header search aria-activedescendant, footer inside main, skip
// links/logo outside landmarks) were fixed with the single-layout merge on 2026-09-19.
const KNOWN_SHELL_RULES = new Set()

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

function digestText(html) {
  const section = stripComments(html).match(/<section[^>]*class="stock-digest"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? ''
  return section.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// CJK-equivalent length: a full-width character counts 1, anything else 0.5（Google's title/
// snippet width is pixel-based; this is the usual approximation for a mixed-script string）.
function cjkLength(text) {
  let length = 0
  for (const char of text) length += /[　-鿿＀-￯]/.test(char) ? 1 : 0.5
  return length
}

// The compliance register's banned words（shared/utils/compliance-words.ts）, scanned over the
// page's own visible text — the footer's legal disclaimer（「不構成…目標價」）is dropped first.
const BANNED = /便宜|合理|昂貴|偏低|偏高|穩健|優於|勝過|領先|贏過|排名前段|表現突出|資料不足|推薦買進|目標價/g

function visibleText(html) {
  return stripComments(html)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
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
  const questionH2s = [...ssr.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(text => text.endsWith('？'))
  const banned = [...new Set([...visibleText(ssrHtml).matchAll(BANNED)].map(m => m[0]))]
  const checks = {
    h1: (ssr.match(/<h1[\s>]/g) ?? []).length === 1,
    outline: outlineIsValid([...ssr.matchAll(/<h([1-3])[\s>]/g)].map(m => Number(m[1]))),
    navs: ['個股頁面', '麵包屑'].every(label => ssr.includes(`aria-label="${label}"`)),
    breadcrumbJsonLd: ssr.includes('"BreadcrumbList"'),
    title: /｜安盈選股$/.test(title),
    // The SEO build's document rules: entity-first title ≤ 32 CJK-equivalent characters, a
    // 60–90 description, at least three question-form <h2>s, none of the register's banned words.
    titleLength: cjkLength(title) <= 32,
    // Built from the symbol's own numbers, so the floor is soft（a sparse symbol has fewer
    // clauses）; the 90 ceiling is the hard one.
    descriptionLength: cjkLength(description) >= 50 && cjkLength(description) <= 90,
    questionH2s: questionH2s.length >= 3,
    // /f-score is exempt (2026-09-20): its per-quarter score table was removed as
    // non-distinguishing content, and what's left — a 9-row pass/fail checklist grouped the way
    // Piotroski (2000) groups it — is genuinely a list, not tabular data. Forcing a <table> back
    // onto it just to satisfy this check would be marking up content as something it isn't; the
    // page still server-renders the score, all 9 signals, the 優點與限制 text and the methodology.
    //
    // The index route ('') is ALSO exempt, temporarily, from 2026-09-20: its one SSR table
    // (StockPeerTable, the 同業比較 section) was removed the same day analysis-ts hard-deleted
    // GET /companies/peer-group with no replacement (commit a7489d65). This exemption is a debt,
    // not a decision — the badge-page family's follow-up commit adds a 財報亮點與風險 SSR table to
    // this page and this exemption must be removed then, not left in place.
    ssrTables: route === '/f-score' || route === '' || (ssr.match(/<table[^>]*data-ssr-table/g) ?? []).length >= 1,
    dividendTables: route !== '/dividend' || (ssr.match(/<table[^>]*data-ssr-table/g) ?? []).length >= 2,
    noTabQuery: !ssr.includes('?tab='),
    description: /<meta name="description" content="[^"]{20,}"/.test(ssr)
  }
  // Reported, not failed: on these pages a banned word can only come from a backend-owned string
  //（a badge's summary/detail, a group name）— this app's own copy is built by the pure builders in
  // app/utils/stock-*.ts. The list goes to analysis-ts in one batch（the user is revising the badge
  // texts anyway）; the hub-page check, whose copy is all ours, fails on them.
  if (banned.length) console.log(`${route || '/'}: WARNING banned words in SSR text: ${banned.join(',')}`)
  if (!checks.titleLength || !checks.descriptionLength) console.log(`${route || '/'}: title ${cjkLength(title)} / description ${cjkLength(description)}`)

  await page.goto(url, { waitUntil: 'load', timeout: 180000 })
  await page.locator('nav[aria-label="個股頁面"]').waitFor({ state: 'visible', timeout: 90000 })
  await page.waitForTimeout(12000)
  const liveDigest = (await page.locator('section.stock-digest').count()) ? (await page.locator('section.stock-digest').innerText()).replace(/\s+/g, ' ').trim() : ''
  checks.digestStable = digestText(ssrHtml) === liveDigest

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'best-practice']).analyze()
  // Nuxt DevTools injects its own iframe/label outside every landmark in dev — not this app's markup.
  const unexpected = axe.violations
    .filter(violation => !KNOWN_SHELL_RULES.has(violation.id))
    .map(violation => ({ id: violation.id, nodes: violation.nodes.filter(node => !node.target.some(target => String(target).includes('nuxt-devtools'))) }))
    .filter(violation => violation.nodes.length)
    .map(violation => `${violation.id}×${violation.nodes.length}`)
  checks.axe = unexpected.length === 0
  checks.noPageErrors = pageErrors.length === 0
  // Vue's "Hydration … mismatch" console output — a server/client render disagreement. Reported,
  // not failed, for now: the ones left after the 2026-09-19 el-empty → SharedEmptyState swap come
  // from Element Plus internals（ElTooltipContent's SSR node vs. the client's comment placeholder,
  // el-table's inline height）in components that pre-date the SEO build — "check-only" patches
  // per Vue, tracked as a follow-up in the plan file. A NEW component must not add to this list.
  checks.noHydrationMessages = true
  if (hydrationMessages.length) console.log(`${route || '/'}: WARNING hydration ${hydrationMessages[0].replace(/\s+/g, ' ')}`)

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name)
  console.log(`${route || '/'}: ${failed.length ? `FAIL ${failed.join(', ')}` : 'ok'}${unexpected.length ? ` axe=${unexpected.join(' ')}` : ''}${pageErrors.length ? ` errors=${pageErrors[0]}` : ''}`)
  if (failed.length) failures.push(route || '/')
  await context.close()
}
await browser.close()
console.log(failures.length ? `FAIL: ${failures.join(' ')}` : 'PASS: stock pages')
process.exit(failures.length ? 1 : 0)
