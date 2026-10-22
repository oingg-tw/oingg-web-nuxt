// 篩選器「已經持有」（2026-10-22）：條件轉成 業務中台 body 最上層的範圍、挑選面板裡的指標（app/composables/screener/screener-tab-model.ts）。
// 送錯範圍的後果是靜默的：包含與排除對調，結果看起來照樣合理。Run: node scripts/check-screener-held.mjs
import assert from 'node:assert/strict'
import { HELD_FIELD_ID, heldScopeFor, heldSlot, isHeldField, scopeFor, sectorSlot, withHeldCondition } from '../app/composables/screener/screener-tab-model.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

// 包含／排除各自只填一邊，另一邊是空陣列（PATCH 換模式時才會清掉另一邊）
assert.deepEqual(heldScopeFor([heldSlot(0, [A, B], false)]), { heldPortfolioIds: [A, B], excludeHeldPortfolioIds: [] })
assert.deepEqual(heldScopeFor([heldSlot(0, [A], true)]), { heldPortfolioIds: [], excludeHeldPortfolioIds: [A] })
assert.deepEqual(heldScopeFor([]), { heldPortfolioIds: [], excludeHeldPortfolioIds: [] })
// ETF、特別股的畫面欄位 id 帶 .snapshot，一樣認得
assert.ok(isHeldField(HELD_FIELD_ID) && isHeldField(`${HELD_FIELD_ID}.snapshot`) && !isHeldField('sector.code') && !isHeldField(null))
assert.deepEqual(heldScopeFor([{ ...heldSlot(0, [A], false), fieldId: `${HELD_FIELD_ID}.snapshot` }]).heldPortfolioIds, [A])

// 類股與已經持有一起送，四個鍵都在
assert.deepEqual(scopeFor({ slots: [sectorSlot(0, ['24'], true), heldSlot(1, [A], false)] }), {
  sectorCodes: [], excludeSectorCodes: ['24'], heldPortfolioIds: [A], excludeHeldPortfolioIds: []
})

// 挑選面板：帳戶讀到了卻一個都沒有就不加；讀到前選項是空的、刪掉的帳戶還不能說是刪掉的
const base = [{ key: 'profile', name: '基本資料', sort: 0, metrics: [] }]
assert.equal(withHeldCondition(base, []), base)
const common = withHeldCondition(base, [{ portfolioId: A, name: '元大' }])
const metric = common.at(-1).metrics[0]
assert.equal(`${metric.key}.${metric.fields[0].key}`, HELD_FIELD_ID)
assert.deepEqual(metric.options, [{ value: A, label: '元大' }])
assert.equal(metric.missingOptionLabel, '已刪除的帳戶')
const universe = withHeldCondition(base, null, `${HELD_FIELD_ID}.snapshot`).at(-1).metrics[0]
assert.equal(`${universe.key}.${universe.fields[0].key}`, `${HELD_FIELD_ID}.snapshot`)
assert.equal(universe.missingOptionLabel, '…')

console.log('check-screener-held: ok')
