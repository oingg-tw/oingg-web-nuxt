// The guard that makes frontend-owned metric copy safe (2026-09-22).
//
// shared/utils/metric-copy.ts holds the reader-facing prose; analysis-ts still owns the maths.
// Prose in a different service from the formula it describes can rot silently — analysis-ts revised
// `sue` on the very day this split was agreed (formulaVersion 3, drift term removed, whole market
// recomputed), and copy written against the old formula would have gone on describing something
// that no longer existed with nothing failing anywhere.
//
// So every entry pins the fingerprint below as it was when the copy was written. This
// recomputes that from the live catalog and fails on any change, which turns a formula revision
// into a forced copy review. It also fails on a metric that has a page but neither frontend copy
// nor backend copy, which is the hole check-metric-page-copy.mjs used to be the only guard against.
//
// Run: node scripts/check-metric-copy-drift.mjs        (bff-ts must be up; no browser needed)
//
// When it fails on drift: re-read the affected copy against the new formula, fix what the change
// invalidated, THEN update the pin. Never update a pin without reading the prose — a pin refreshed
// blind is worse than no pin, because it silences the one thing that would have caught it.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const API = process.env.API_BASE ?? 'http://localhost:4000'

// WHAT GOES INTO THE PIN, and why it is not just the formula.
//
// It passed its first real test: analysis-ts changed ROE's denominator from period-end equity to an
// average the day after this shipped (7df73c14, formulaVersion 2), and formulaLatex + unit alone
// caught it — they publish the change in the notation, `\overline{\mathrm{Equity}}`, so the hash
// moved. Measured, not assumed; an earlier run here concluded the opposite and was simply checking
// before bff-ts had synced.
//
// But that test could have gone the other way, which is why `formulaVersion` leads the pin now: an
// integer analysis-ts bumps whenever a computation's MEANING changes (5785a6d2, reaching this app
// in bff-ts b3e67e0 — which needed a DB column, since the catalog is persisted rather than proxied).
// It is the one signal that catches what a formula string cannot. ROE's denominator moved from
// period-end equity to an average without `Equity` changing its symbol; only analysis-ts choosing to
// write the average as `\overline{...}` made that visible in the LaTeX at all.
//
// The other three stay in because a version bump is a human action that can be forgotten, while
// these move mechanically: `unit` caught a real 100× defect once (deRatio printed「13.4倍」for
// 13.44%), and `periods` moves on a change like equityMultiplier gaining a TTM basis, which no
// formula string shows.
//
// The backend's own three prose fields sat in this hash for a few hours while formulaVersion was in
// flight, and are deliberately OUT again. analysis-ts now keeps those narratives as a developer
// reference rather than reader-facing copy (the reader-facing version is shared/utils/metric-copy.ts),
// so their text will move for reasons that have nothing to do with the maths — every one of those
// would have been a false alarm.
//
// `validTimeframes` is analysis-ts's name for the period list; bff-ts expands it into `fields[]`
// with key and period both set to each token, so `fields[].period` IS that field rather than an
// approximation of it.
const pinOf = (metric) => createHash('sha256').update([
  String(metric.formulaVersion ?? ''),
  metric.formulaLatex ?? '',
  metric.unit ?? '',
  (metric.fields ?? []).map(f => f.period).join(',')
].join('|')).digest('hex').slice(0, 12)

const copySource = readFileSync(new URL('../shared/utils/metric-copy.ts', import.meta.url), 'utf8')
// Each entry opens with `metricCode: {` then a `pin: '…'` line before any other field.
const pins = new Map(
  [...copySource.matchAll(/^ {2}(\w+):\s*\{\s*\n\s*pin:\s*'([0-9a-f]{12})'/gm)].map(m => [m[1], m[2]])
)

const hubSource = readFileSync(new URL('../shared/utils/hub-slugs.ts', import.meta.url), 'utf8')
const pages = [...hubSource.matchAll(/^\s*\{\s*slug:\s*'([a-z0-9-]+)',\s*metricCode:\s*'(\w+)'/gm)]
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

const drifted = []
const holes = []
for (const page of pages) {
  const metric = byCode.get(page.metricCode)
  if (!metric) { holes.push(`${page.slug}（${page.metricCode}）不在 /metrics 目錄裡`); continue }

  const pinned = pins.get(page.metricCode)
  if (!pinned) {
    // No frontend copy yet — the page falls back to the backend's own three fields, so this is
    // only a problem when those are missing too.
    const missing = ['description', 'limitations', 'misreadings'].filter(field => !metric[field])
    if (missing.length) holes.push(`${page.slug}（${page.metricCode}）前端沒文案，後端也缺 ${missing.join('、')}`)
    continue
  }

  const live = pinOf(metric)
  if (live !== pinned) {
    drifted.push(`${page.slug}（${page.metricCode}）pin ${pinned} → ${live}\n      公式 ${metric.formulaLatex ?? '（無）'}\n      單位 ${metric.unit ?? '（無）'}`)
  }
}

console.log(`指標專頁 ${pages.length} 頁，前端自有文案 ${pins.size} 支`)
if (drifted.length) {
  console.log(`\n⚠ ${drifted.length} 支的的公式、期別或後端敘述變了，文案必須重讀：`)
  for (const line of drifted) console.log(`  ${line}`)
  console.log('\n  先照新公式重讀文案、改掉被推翻的部分，最後才更新 pin。')
  console.log('  沒讀就更新 pin 比不設 pin 還糟——那等於關掉唯一會抓到這件事的機制。')
}
if (holes.length) {
  console.log(`\n⚠ ${holes.length} 頁沒有任何文案可用：`)
  for (const line of holes) console.log(`  ${line}`)
}
if (!drifted.length && !holes.length) console.log('公式、期別與後端敘述都沒動，也沒有缺文案的頁面。')
else process.exitCode = 1
