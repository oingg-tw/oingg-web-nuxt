// server/utils/swr-cache.ts：快取最多能舊多久。上限內照舊先回舊值、背景更新；超過 maxAge＋staleMaxAge 就當作沒有快取，先拿新的再回。
// Run: node scripts/check-swr-cache.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { swrCache } from '../server/utils/swr-cache.ts'

const { validate, swr, maxAge, staleMaxAge } = swrCache(60, 120)
const ago = seconds => ({ value: 1, mtime: Date.now() - seconds * 1000 })

assert.deepEqual([swr, maxAge, staleMaxAge], [true, 60, 120], '照樣交給 Nitro 的 swr、maxAge、staleMaxAge')
assert.equal(validate(ago(30)), true, '還沒過期')
assert.equal(validate(ago(150)), true, '過期但在上限內：先回舊值、背景更新')
assert.equal(validate(ago(200)), false, '超過 maxAge＋staleMaxAge：先拿新的再回')
assert.equal(validate({ value: undefined, mtime: Date.now() }), false, '沒有值')
assert.equal(validate({ value: 1 }), false, '沒有寫入時間的舊格式當作太舊')

// KV 的鍵跟著這個上限過期（2026-11-14，管理站盤點：「KV 快取的上游資料永遠不會過期」，使用者「好加上」）：Nitro 只在沒開 swr 時給 KV
// expirationTtl，這裡每支都開 swr，所以 patches/nitropack@2.13.6.patch 讓 swr 的寫入帶 maxAge＋staleMaxAge。升級 Nitro 掉了這段補丁就會在這裡失敗
const nitroCache = join(dirname(createRequire(createRequire(import.meta.url).resolve('nuxt/package.json')).resolve('nitropack/package.json')), 'dist/runtime/internal/cache.mjs')
assert.match(readFileSync(nitroCache, 'utf8'), /opts\.staleMaxAge > 0\) \{[^}]*ttl: opts\.maxAge \+ opts\.staleMaxAge/, '裝好的 Nitro 有 swr 鍵過期的補丁')

console.log('PASS: swr cache cap')
