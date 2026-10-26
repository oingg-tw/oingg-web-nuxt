// Google ID token（JWT）的到期判斷（2026-10-14，部署到 Firebase App Hosting）：Nitro 呼叫有 Cloud Run IAM 鎖的業務中台時，
// 向 metadata server 取一張 ID token，快取到快過期才換（server/utils/business.ts 的 businessAuthHeaders）。這裡只放純函式，
// 讓 scripts/check-business-auth.mjs 直接 import。只讀 payload 的 exp，不驗簽——token 是 metadata server 剛發給自己的，驗簽是業務中台的事。

// JWT 的 exp（秒）；格式不對或沒有 exp 回 null
export function jwtExpiry(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

// 到期前 5 分鐘就換新；讀不到 exp 的一律當作要換（寧可多要一次，不拿過期的去打）
export function idTokenNeedsRefresh(exp: number | null, nowSeconds: number): boolean {
  return exp === null || nowSeconds >= exp - 300
}

// 沒有 metadata server 的平台（Cloudflare Workers，2026-10-27 使用者選「服務帳戶金鑰」）：用服務帳戶金鑰自己簽一張 JWT，POST 到
// GOOGLE_TOKEN_URL 換 token。claims 帶 target_audience 換 ID token（業務中台的 IAM 鎖），帶 scope 換 access token。
// RS256 用 Web Crypto（Node 與 Workers 都有）
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface ServiceAccountKey {
  client_email: string
  private_key: string
  private_key_id?: string
}

export async function serviceAccountAssertion(key: ServiceAccountKey, claims: Record<string, string>, nowSeconds: number): Promise<string> {
  const iat = Math.floor(nowSeconds)
  const encode = (value: object) => base64url(new TextEncoder().encode(JSON.stringify(value)))
  const header = { alg: 'RS256', typ: 'JWT', ...(key.private_key_id ? { kid: key.private_key_id } : {}) }
  const unsigned = `${encode(header)}.${encode({ iss: key.client_email, sub: key.client_email, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600, ...claims })}`
  const der = Uint8Array.from(atob(key.private_key.replace(/-----[A-Z ]+-----|\s/g, '')), char => char.charCodeAt(0))
  const signingKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64url(new Uint8Array(signature))}`
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
