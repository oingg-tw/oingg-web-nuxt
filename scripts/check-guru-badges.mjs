// 大師徽章的清單照型錄組（app/utils/guru-badges.ts 的 buildGuruBadges）：網站不認得的分類不能整類不見。
// 2026-11-26 數據中台說徽章會依回測重訂，可能多出技術面、籌碼面這種新分類；原本 key 對不到顯示名稱就整類略過。
// Run: node scripts/check-guru-badges.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { FINANCIAL_ANALYSIS_DIMENSIONS } from '../app/utils/financial-analysis-dimensions.ts'

// guru-badges.ts 在網站裡靠自動匯入
Object.assign(globalThis, { FINANCIAL_ANALYSIS_DIMENSIONS })
const { buildGuruBadges, guruCategoryIcon, GURU_CATEGORY_ICON, GURU_BADGE_CATEGORIES } = await import('../app/utils/guru-badges.ts')

const badge = name => ({ name, nameEn: name, author: 'A', summary: '', detail: '', timeframe: 'Q', threshold: { description: '≥ 7', denominator: 9 } })
const metric = (key, withBadge = true) => ({ key, name: key, unit: '分', fields: [{ key: 'Q', period: 'Q' }], ...(withBadge ? { badge: badge(key) } : { badge: null }) })
const catalog = [
  { key: 'quality', name: '獲利品質', sort: 0, metrics: [metric('piotroskiFScore'), metric('eps', false)] },
  // 型錄的名稱跟本站用詞不同的照本站的（營運效率 → 營運周轉）
  { key: 'efficiency', name: '營運效率', sort: 1, metrics: [metric('cashConversionCycle')] },
  // 本站不認得的分類：用型錄自己的名稱，不略過
  { key: 'technical', name: '技術面', sort: 2, metrics: [metric('rsi')] },
  // 沒有徽章的分類不出現
  { key: 'profile', name: '基本資料', sort: 3, metrics: [metric('listedYears', false)] }
]
const badges = buildGuruBadges(catalog)
assert.deepEqual(badges.map(item => [item.id, item.category]), [['piotroskiFScore', '獲利品質'], ['cashConversionCycle', '營運周轉'], ['rsi', '技術面']])
assert.equal(badges[0].fieldId, 'piotroskiFScore.Q')
// 圖示：認得的用自己的，不認得的有預設、不是 undefined
assert.equal(guruCategoryIcon('獲利品質'), GURU_CATEGORY_ICON['獲利品質'])
assert.ok(guruCategoryIcon('技術面'))
assert.ok(GURU_BADGE_CATEGORIES.every(category => GURU_CATEGORY_ICON[category]))

// 警示那一端（2026-11-27，數據中台把徽章換成「正向 5 個、警示 5 個」）：型錄的 threshold.warning.description 要帶到畫面；
// 只有警示的徽章沒有通過條件（description 是 null 或不帶），不能印出 undefined，也不能把警示當成通過條件
const withThreshold = threshold => ({ key: 'x', name: 'x', unit: '', fields: [{ key: 'Q', period: 'Q' }], badge: { ...badge('x'), threshold } })
const thresholdOf = threshold => buildGuruBadges([{ key: 'quality', name: '獲利品質', sort: 0, metrics: [withThreshold(threshold)] }])[0].threshold
assert.deepEqual(thresholdOf({ description: '≥ 8', denominator: 9, warning: { description: '≤ 2' } }), { description: '≥ 8', warning: '≤ 2', denominator: 9, isPercentileRank: false, percentileDirection: null })
assert.deepEqual(thresholdOf({ description: '≥ 7', denominator: 9 }), { description: '≥ 7', warning: null, denominator: 9, isPercentileRank: false, percentileDirection: null })
// 只有警示：精簡版型錄不帶 null 的鍵（pickKeys），所以兩種寫法都要當成沒有
for (const only of [{ description: null, denominator: 1, warning: { description: '≤ −2 個百分點' } }, { denominator: 1, warning: { description: '≤ −2 個百分點' } }]) {
  assert.deepEqual(thresholdOf(only), { description: null, warning: '≤ −2 個百分點', denominator: 1, isPercentileRank: false, percentileDirection: null })
}

console.log('PASS: guru badges')
