// LINE 登入（2026-10-18，使用者：「避免 webview 的坑是主要目的」）。不走 Firebase 的 popup／redirect——那兩條在 LINE 內建瀏覽器
// 會失敗（Google 擋嵌入式 WebView、redirect 跨網域的 sessionStorage 讀不到）。改成一般的網頁跳轉：LINE Login 導回我們自己網域的
// /auth/line，業務中台用 channel secret 換 token、驗過之後發 Firebase custom token，前端 signInWithCustomToken（只是一次 API 呼叫）。
// LINE 內建瀏覽器打開登入網址會自動登入，不必輸入帳密。state／nonce 存在我們自己網域的 sessionStorage，同一個分頁跳轉回來還在。
const STORAGE_KEY = 'line-login'

export const lineRedirectUri = () => `${location.origin}/auth/line`

// LINE 的內建瀏覽器（使用者代理有「Line/版本」）：Google 登入在這裡一定失敗
export const isLineInAppBrowser = () => import.meta.client && / Line\//.test(navigator.userAgent)

export function startLineLogin(returnTo: string) {
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nonce, returnTo }))
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: useRuntimeConfig().public.lineLoginChannelId,
    redirect_uri: lineRedirectUri(),
    state,
    nonce,
    scope: 'openid profile'
  }).toString()
  location.assign(url.href)
}

// 讀出並刪掉（一次用），回來的 state 對不上就當沒有。returnTo 只接受站內路徑（不接受 //別的網域）
export function takeLineLogin(state: unknown): { nonce: string; returnTo: string } | null {
  let pending: { state?: string; nonce?: string; returnTo?: string } | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!pending?.nonce || !pending.state || pending.state !== state) return null
  const returnTo = pending.returnTo?.startsWith('/') && !pending.returnTo.startsWith('//') && !pending.returnTo.startsWith('/auth/') ? pending.returnTo : '/'
  return { nonce: pending.nonce, returnTo }
}
