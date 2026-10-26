// The one runnable check for shared/utils/id-token.ts（Nitro 呼叫有 IAM 鎖的業務中台時，ID token 何時換新）。
// Run: node scripts/check-business-auth.mjs
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { GOOGLE_TOKEN_URL, idTokenNeedsRefresh, jwtExpiry, serviceAccountAssertion } from '../shared/utils/id-token.ts'

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

// 服務帳戶金鑰簽的 JWT（Cloudflare Workers 上換 ID token 用）：Google 的公鑰驗得過、欄位對
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const assertion = await serviceAccountAssertion({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: privateKey, private_key_id: 'k1' }, { target_audience: 'https://x.a.run.app' }, 1_000_000.7)
const [head, body, signature] = assertion.split('.')
assert.ok(verify('sha256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(signature, 'base64url')))
assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: 'k1' })
assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url')), { iss: 'sa@p.iam.gserviceaccount.com', sub: 'sa@p.iam.gserviceaccount.com', aud: GOOGLE_TOKEN_URL, iat: 1_000_000, exp: 1_003_600, target_audience: 'https://x.a.run.app' })

console.log('check-business-auth: ok')
