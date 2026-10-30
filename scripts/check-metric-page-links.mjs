// 篩選結果表每一格的連結（shared/utils/metric-pages.ts 的 metricPageSlug，2026-10-30）：別名的目的地都要有頁，
// 專頁的 metricCode 要直接對到自己的 slug。Run: node scripts/check-metric-page-links.mjs
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { BADGE_PAGES, METRIC_PAGES, METRIC_PAGE_ALIASES, metricPageSlug } from '../shared/utils/metric-pages.ts'

const registry = new Set([...METRIC_PAGES, ...BADGE_PAGES].map(page => page.slug))
for (const [code, slug] of Object.entries(METRIC_PAGE_ALIASES)) {
  assert.ok(registry.has(slug) || existsSync(new URL(`../app/pages/stock/[code]/${slug}.vue`, import.meta.url)), `${code} → /${slug} 沒有這一頁`)
}
assert.equal(metricPageSlug('eps'), 'eps')
assert.equal(metricPageSlug('grossMargin'), 'gross-margin')
assert.equal(metricPageSlug('livePeRatio'), 'pe-ratio')
assert.equal(metricPageSlug('liveCashDividendYield'), 'dividend')
assert.equal(metricPageSlug('market'), null)
console.log('PASS: metric page links')
