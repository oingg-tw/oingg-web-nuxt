// Every metric page's explanatory copy comes from GET /metrics — `description` (feeds「X 是
// 什麼？」), `limitations` and `misreadings` (together feed「X 要跟誰比、什麼時候會看錯？」,
// renamed 2026-09-30 from「看 X 要注意什麼？」). This app
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
import { BADGE_PAGES, METRIC_PAGES } from '../shared/utils/metric-pages.ts'

const API = process.env.API_BASE ?? 'http://localhost:4000'
const FIELDS = ['description', 'limitations', 'misreadings']

// Read from the registry itself rather than duplicated here — the same "one registry decides what exists" rule the
// sitemap and the page components follow (metric-pages.ts has no imports, so Node loads it directly).
const pages = [...METRIC_PAGES, ...BADGE_PAGES].map(page => ({ slug: page.slug, metricCode: page.metricCode, topic: page.topic, ownName: !page.copyKey && !page.valueTopic }))

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

// 頁名（2026-10-11 生態系詞彙表）：頁面就是那支指標本身時，頁名一律等於 analysis-ts 的 `name`；只有「同一支指標、不同頁面」
// （設了 copyKey 或 valueTopic，例如負債組成頁讀 debtRatio）可以有自己的頁名。
// ponytail: topic 仍寫在 metric-pages.ts（SSR 標題、側欄、sitemap 都同步讀它），這裡只擋漂移；要完全不存一份得把頁名改成執行期讀型錄。
const renamed = pages.filter(page => page.ownName && page.topic && byCode.get(page.metricCode)?.name !== page.topic)
console.log(`\n頁名與 /metrics name 不一致 ${renamed.length} 頁`)
for (const page of renamed) console.log(`  ${page.slug.padEnd(34)}頁名「${page.topic}」　型錄「${byCode.get(page.metricCode)?.name}」`)
if (renamed.length) process.exitCode = 1
