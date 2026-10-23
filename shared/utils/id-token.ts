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
