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
// It is widened anyway, because that test could have gone the other way. The published formula is
// abstract enough that a denominator's MEANING can change without its symbol changing, and
// `formulaVersion` — the signal that would say so unambiguously, and which analysis-ts does
// maintain — is not exposed through GET /metrics. Asking for it is the proper fix and has been
// requested. Until then two more inputs cover the gap:
//
//   * periods — equityMultiplier gained a TTM basis in that same change, invisible in its formula
//   * the backend's own three prose fields — analysis-ts revises its narrative when it revises a
//     formula (「roe narrative 的 limitations 已寫明分母慣例與 Q2 季節性」), so their text is a
//     usable proxy for「something about this metric moved」
//
// The prose proxy will occasionally fire on a pure wording tweak with no maths change. That is the
// right way round to be wrong: a spurious review prompt costs a read, a missed one ships copy that
// describes a formula that no longer exists.
const pinOf = (metric) => createHash('sha256').update([
  metric.formulaLatex ?? '',
  metric.unit ?? '',
  (metric.fields ?? []).map(f => f.period).join(','),
  metric.description ?? '',
  metric.limitations ?? '',
  metric.misreadings ?? ''
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
