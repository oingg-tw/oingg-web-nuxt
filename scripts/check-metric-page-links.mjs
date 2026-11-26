// 篩選結果表每一格的連結（shared/utils/metric-pages.ts 的 metricPageSlug，2026-10-30）：別名的目的地都要有頁，
// 專頁的 metricCode 要直接對到自己的 slug。Run: node scripts/check-metric-page-links.mjs
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { METRIC_PAGES, METRIC_PAGE_ALIASES, drawnMetricCode, metricPageSlug, quickViewChartOf } from '../shared/utils/metric-pages.ts'

const registry = new Set(METRIC_PAGES.map(page => page.slug))
for (const [code, slug] of Object.entries(METRIC_PAGE_ALIASES)) {
  assert.ok(registry.has(slug) || existsSync(new URL(`../app/pages/stock/[code]/${slug}.vue`, import.meta.url)), `${code} → /${slug} 沒有這一頁`)
}
assert.equal(metricPageSlug('eps'), 'eps')
assert.equal(metricPageSlug('grossMargin'), 'gross-margin')
assert.equal(metricPageSlug('livePeRatio'), 'pe-ratio')
assert.equal(metricPageSlug('liveCashDividendYield'), 'dividend')
assert.equal(metricPageSlug('market'), null)
assert.equal(metricPageSlug('groupCapitalAdequacyRatio'), 'capital-adequacy')

// 資本適足率頁畫哪一支（holdingMetricCode，2026-11-22 DEV 實測的三種公司）：金控畫集團資本適足率，銀行照舊，兩支都沒有的照舊（頁面說誰才有）
const cell = (value, nullReason = null) => ({ value, nullReason })
const fhc = [{ values: { bankCarRatio: cell(null, 'not_applicable_industry'), groupCapitalAdequacyRatio: cell(120.11) } }]
const bank = [{ values: { bankCarRatio: cell(13.99), groupCapitalAdequacyRatio: cell(null, 'not_applicable_industry') } }]
assert.equal(drawnMetricCode('bankCarRatio', 'groupCapitalAdequacyRatio', fhc), 'groupCapitalAdequacyRatio')
assert.equal(drawnMetricCode('bankCarRatio', 'groupCapitalAdequacyRatio', bank), 'bankCarRatio')
assert.equal(drawnMetricCode('bankCarRatio', 'groupCapitalAdequacyRatio', []), 'bankCarRatio')
assert.equal(drawnMetricCode('bankCarRatio', undefined, fhc), 'bankCarRatio')
// 指標速覽的卡片也帶著它，圖才會自己判斷
assert.equal(quickViewChartOf('capital-adequacy').holdingMetricCode, 'groupCapitalAdequacyRatio')
console.log('PASS: metric page links')
