// Every metric page's explanatory copy comes from GET /metrics — `description` (feeds「X 是
// 什麼？」), `limitations` and `misreadings` (together feed「看 X 要注意什麼？」). This app
// deliberately keeps no frontend copy of any of it, so a metric whose catalog entry is blank
// renders a page with fewer sections than its siblings.
//
// Written 2026-09-22 on a live report（「我注意到該區塊跨指標的文案不一樣，請讓他有同樣的格式，避免
// 漏改，或是產生不一致」）. The page TEMPLATE was already uniform — a fixed 限制/常見誤讀 pair, each
// conditional (StockMetricDetailPage.vue) — so there was no format to unify. What varies is which
// metrics analysis-ts has written the prose for, and it varies all-or-nothing: at the time of
// writing 25 of 31 pages had all three fields and 6 had none of them.
//
// So this is the check, not a copy-editing pass: the inconsistency is a data gap, it is invisible
// until someone opens two pages side by side, and nothing failed when a page shipped with a hole.
// A page missing `description` is already `noindex` (see that component), which covers SEO but not
// the visitor who reached it from the sidebar.
//
// Run: node scripts/check-metric-page-copy.mjs        (bff-ts must be up; no browser needed)
// Exits non-zero when any nav-reachable metric page has a hole, so it can gate a commit.
// Sets process.exitCode rather than calling process.exit(): on Windows, exiting with the fetch
// handle still open trips a libuv assertion and reports 127 instead of the intended code.
import { readFileSync } from 'node:fs'

const API = process.env.API_BASE ?? 'http://localhost:4000'
const FIELDS = ['description', 'limitations', 'misreadings']

// Parsed out of the registry rather than duplicated here — the same "one registry decides what
// exists" rule the sitemap and the page components follow. Matches both METRIC_PAGES and
// BADGE_PAGES entries; a commented-out (pulled) entry is skipped, which is the point of pulling one.
const source = readFileSync(new URL('../shared/utils/hub-slugs.ts', import.meta.url), 'utf8')
const pages = [...source.matchAll(/^\s*\{\s*slug:\s*'([a-z0-9-]+)',\s*metricCode:\s*'(\w+)'/gm)]
  .map(m => ({ slug: m[1], metricCode: m[2] }))

const response = await fetch(`${API}/metrics`, { signal: AbortSignal.timeout(30_000) })
if (!response.ok) {
  console.error(`GET ${API}/metrics failed with ${response.status}`)
  process.exitCode = 2
  throw new Error('catalog unavailable')
}
const catalog = await response.json()
const byCode = new Map()
for (const category of catalog.categories ?? []) {
  for (const metric of category.metrics ?? []) byCode.set(metric.key, metric)
}

const holes = []
for (const page of pages) {
  const metric = byCode.get(page.metricCode)
  if (!metric) {
    holes.push({ slug: page.slug, metricCode: page.metricCode, missing: ['不在 /metrics 目錄裡'] })
    continue
  }
  const missing = FIELDS.filter(field => !metric[field])
  if (missing.length) holes.push({ slug: page.slug, metricCode: page.metricCode, missing })
}

// Both identifiers on every row, deliberately. Reporting the SLUG alone once sent analysis-ts
// hunting for a metricCode that doesn't exist（2026-09-22: the page at
// /stock/{code}/interest-bearing-debt-to-equity reads the metric `deRatio`, which analysis-ts had
// itself renamed to 有息負債權益比 — so the slug says one thing and the catalog key says another,
// and only the key is actionable on their side）. The slug is this app's URL vocabulary; the
// metricCode is the only half the backend can act on.
console.log(`指標／徽章專頁 ${pages.length} 頁，文案齊全 ${pages.length - holes.length} 頁，有缺口 ${holes.length} 頁`)
for (const hole of holes) {
  console.log(`  ${hole.slug.padEnd(34)}metricCode ${String(hole.metricCode).padEnd(30)}缺 ${hole.missing.join('、')}`)
}

if (holes.length) {
  console.log('\n缺的是 analysis-ts 的 GET /metrics 欄位，不是前端文案——請提需求，不要在前端寫死一份。')
  process.exitCode = 1
} else {
  console.log('全部齊全。')
}
