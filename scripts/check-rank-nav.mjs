// 排行側欄的目錄（app/components/rank/RankNav.vue，2026-11-25 方案 C）：每一種排行都在 RANK_CATEGORIES 的某一類，每一類都有排行，
// 一類只屬於一組（普通股或 ETF），名稱夠短放得進側欄一行（總覽卡片的分段鈕也用同一個名字）
// Run: node scripts/check-rank-nav.mjs
import assert from 'node:assert/strict'
import { RANK_CATEGORIES, RANK_PAGES } from '../shared/utils/hub-slugs.ts'

const keys = new Set(RANK_CATEGORIES.map(category => category.key))
for (const page of RANK_PAGES) {
  assert.ok(keys.has(page.category), `${page.slug} 的分類 ${page.category} 不在 RANK_CATEGORIES`)
  // 「單季每股盈餘由虧轉盈幅度」這種長名要有 short
  assert.ok((page.short ?? page.label).length <= 8, `${page.slug} 的名稱太長，加 short`)
}
for (const category of RANK_CATEGORIES) {
  const pages = RANK_PAGES.filter(page => page.category === category.key)
  assert.ok(pages.length, `${category.title} 沒有排行`)
  assert.equal(new Set(pages.map(page => page.universe === 'etf')).size, 1, `${category.title} 混了普通股與 ETF`)
}

console.log('check-rank-nav: ok')
