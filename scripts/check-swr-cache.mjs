// server/utils/swr-cache.ts：快取最多能舊多久。上限內照舊先回舊值、背景更新；超過 maxAge＋staleMaxAge 就當作沒有快取，先拿新的再回。
// Run: node scripts/check-swr-cache.mjs
import assert from 'node:assert/strict'
import { swrCache } from '../server/utils/swr-cache.ts'

const { validate, swr, maxAge, staleMaxAge } = swrCache(60, 120)
const ago = seconds => ({ value: 1, mtime: Date.now() - seconds * 1000 })

assert.deepEqual([swr, maxAge, staleMaxAge], [true, 60, 120], '照樣交給 Nitro 的 swr、maxAge、staleMaxAge')
assert.equal(validate(ago(30)), true, '還沒過期')
assert.equal(validate(ago(150)), true, '過期但在上限內：先回舊值、背景更新')
assert.equal(validate(ago(200)), false, '超過 maxAge＋staleMaxAge：先拿新的再回')
assert.equal(validate({ value: undefined, mtime: Date.now() }), false, '沒有值')
assert.equal(validate({ value: 1 }), false, '沒有寫入時間的舊格式當作太舊')

console.log('PASS: swr cache cap')
