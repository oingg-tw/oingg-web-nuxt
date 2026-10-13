// The one runnable check for shared/utils/id-token.ts（Nitro 呼叫有 IAM 鎖的業務中台時，ID token 何時換新）。
// Run: node scripts/check-business-auth.mjs
import assert from 'node:assert/strict'
import { idTokenNeedsRefresh, jwtExpiry } from '../shared/utils/id-token.ts'

const base64url = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = payload => `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url(payload)}.signature`

// exp 讀得出來，包括 base64url 的 -／_ 與省略的 padding
assert.equal(jwtExpiry(jwt({ exp: 1760000000, aud: 'https://x.a.run.app' })), 1760000000)
assert.equal(jwtExpiry(jwt({ exp: 1760000000, sub: '>>>???~~~' })), 1760000000)
// 格式不對、沒有 exp、payload 不是 JSON → null
assert.equal(jwtExpiry('not-a-jwt'), null)
assert.equal(jwtExpiry(jwt({ aud: 'x' })), null)
assert.equal(jwtExpiry('a.!!!.c'), null)

// 到期前 5 分鐘才換；讀不到 exp 一律換
const exp = 1_000_000
assert.equal(idTokenNeedsRefresh(exp, exp - 301), false)
assert.equal(idTokenNeedsRefresh(exp, exp - 300), true)
assert.equal(idTokenNeedsRefresh(exp, exp + 10), true)
assert.equal(idTokenNeedsRefresh(null, 0), true)

console.log('check-business-auth: ok')
