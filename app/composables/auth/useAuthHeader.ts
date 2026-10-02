// 帶 Firebase ID token 的 Authorization 標頭，一份（2026-10-02）。
//
// 它原本在 6 支「同步到帳號」的 composable 裡各寫一份逐字相同的拷貝，連同各自的
// `const TOKEN_TIMEOUT_MS = 10_000` 與那句 '登入驗證逾時'。
//
// 回傳 null 代表「現在沒有登入的人」，而不是「取 token 失敗」——呼叫端一律把 null 當成
// 「這次不要同步，本地狀態照用」，那是這整組 composable 的共同契約。
//
// 逾時用 withTimeout 包起來是必要的：`getIdToken()` 在 token 過期時會去跟 Firebase 換新的，
// 而那是一次網路往返；沒有逾時的話，一個連不上 Firebase 的使用者會讓每一次同步永遠懸著。
const TOKEN_TIMEOUT_MS = 10_000

export function useAuthHeader() {
  const currentUser = useCurrentUser()

  return async function authHeader(): Promise<{ Authorization: string } | null> {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }
}
