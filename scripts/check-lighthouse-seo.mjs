// seoIfIndexable（scripts/lighthouse-seo.mjs）：用合成的 Lighthouse 結果驗算。權重照 Lighthouse 12 的 SEO 分類（is-crawlable 4.0435，
// 其餘 1，structured-data 是 manual、權重 0）；數字對 2026-10-18 那筆 DEV 評測：只有 is-crawlable 沒過的頁 69 → 100，/holdings 58 → 92。
// Run: node scripts/check-lighthouse-seo.mjs
import assert from 'node:assert/strict'
import { seoIfIndexable } from './lighthouse-seo.mjs'

const CRAWLABLE = 4.043478260869565
const CONTENT = ['document-title', 'meta-description', 'http-status-code', 'link-text', 'crawlable-anchors', 'robots-txt', 'image-alt', 'hreflang', 'canonical']
// failing：沒過的稽核；notApplicable：不計分的（權重已是 0）。分類分數照 Lighthouse 算：Σ權重×分數 ÷ Σ權重
function lhr({ failing = [], notApplicable = [] }) {
  const refs = [{ id: 'is-crawlable', weight: CRAWLABLE }, ...CONTENT.map(id => ({ id, weight: notApplicable.includes(id) ? 0 : 1 })), { id: 'structured-data', weight: 0 }]
  const audits = Object.fromEntries(refs.map(({ id, weight }) => [id, { id, score: weight ? (failing.includes(id) ? 0 : 1) : null }]))
  const total = refs.reduce((sum, ref) => sum + ref.weight, 0)
  const score = refs.reduce((sum, ref) => sum + ref.weight * (audits[ref.id].score ?? 0), 0) / total
  return { categories: { seo: { score, auditRefs: refs } }, audits }
}
const seoOf = result => Math.round(result.categories.seo.score * 100)

const noindexOnly = lhr({ failing: ['is-crawlable'] })
assert.equal(seoOf(noindexOnly), 69)
assert.equal(seoIfIndexable(noindexOnly), 100, '只有 noindex 沒過：不扣就是滿分')

const holdings = lhr({ failing: ['is-crawlable', 'meta-description'], notApplicable: ['image-alt'] })
assert.equal(seoOf(holdings), 58)
assert.equal(seoIfIndexable(holdings), 92, '/holdings：noindex 不扣，缺 meta-description 照扣')

const production = lhr({ failing: ['meta-description'] })
assert.equal(seoIfIndexable(production), seoOf(production), '正式站 is-crawlable 本來就過：等於 seo')

assert.equal(seoIfIndexable({ categories: { seo: { score: null, auditRefs: [] } }, audits: {} }), null, '分類分數是 null（有稽核出錯）就是 null')
assert.equal(seoIfIndexable({ categories: {}, audits: {} }), null, '沒量 SEO 就是 null')

console.log('PASS: lighthouse seoIfIndexable')
