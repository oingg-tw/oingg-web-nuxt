// 排行側欄與手機膠囊列的熱門清單（shared/utils/hub-slugs.ts 的 RANK_NAV）：每一項都是排行頁、放在自己那一組、不重複，名稱夠短
// Run: node scripts/check-rank-nav.mjs
import assert from 'node:assert/strict'
import { RANK_NAV, findRankPage } from '../shared/utils/hub-slugs.ts'

for (const [group, slugs] of Object.entries(RANK_NAV)) {
  assert.equal(new Set(slugs).size, slugs.length, `${group} 有重複`)
  for (const slug of slugs) {
    const page = findRankPage(slug)
    assert.ok(page, `${group}: ${slug} 不是排行頁`)
    assert.equal(page.universe === 'etf', group === 'etf', `${slug} 放錯組`)
    // 側欄一行放得下：「單季每股盈餘由虧轉盈幅度」這種長名要有 short
    assert.ok((page.short ?? page.label).length <= 8, `${slug} 的名稱太長，加 short`)
  }
}

console.log('check-rank-nav: ok')
