// 帶 Firebase ID token 打業務中台的入口，一份（2026-10-02 先抽出共用的 authHeader，2026-10-08 連 apiFetch 一起包進來，
// 取代八支同步 composable 裡 28 份「取標頭→擋訪客→$fetch 帶 baseURL／timeout」的相同寫法）。
//
// 沒有登入的人：丟 statusCode 401 的 Error。呼叫端的每個函式都先用 currentUser 擋掉訪客再進 try，所以這個 401 只會在
// 登入狀態於請求途中改變時出現，落進同一個 catch、回同一個失敗值。
// 換 token 是一次網路往返（getIdToken 在過期時會跟 Firebase 換新的），所以有逾時；它丟的錯也落在呼叫端的 catch 裡——
// 2026-10-08 之前六支 composable 把它放在 try 外面，逾時是未處理的 rejection。
// 帶身分的回應一律不進瀏覽器快取（cache: 'no-store'），GET 與寫入都是。options.headers 不合併：沒有呼叫端帶別的標頭。
export function useAuthedFetch() {
  const currentUser = useCurrentUser()

  return async function authedFetch<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    if (!currentUser.value) throw Object.assign(new Error('not signed in'), { statusCode: 401 })
    const token = await withTimeout(currentUser.value.getIdToken(), AUTH_TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return apiFetch<T>(path, { cache: 'no-store', ...options, headers: { Authorization: `Bearer ${token}` } })
  }
}
