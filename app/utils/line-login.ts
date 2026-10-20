// LINE 登入（2026-10-18，使用者：「避免 webview 的坑是主要目的」）。不走 Firebase 的 popup／redirect——那兩條在 LINE 內建瀏覽器
// 會失敗（Google 擋嵌入式 WebView、redirect 跨網域的 sessionStorage 讀不到）。改成一般的網頁跳轉：LINE Login 導回我們自己網域的
// /auth/line，業務中台用 channel secret 換 token、驗過之後發 Firebase custom token，前端 signInWithCustomToken（只是一次 API 呼叫）。
// LINE 內建瀏覽器打開登入網址會自動登入，不必輸入帳密。state／nonce 存在我們自己網域的 sessionStorage，同一個分頁跳轉回來還在。
const STORAGE_KEY = 'line-login'

export const lineRedirectUri = () => `${location.origin}/auth/line`

// LINE 的內建瀏覽器（使用者代理有「Line/版本」）：Google 登入在這裡一定失敗
export const isLineInAppBrowser = () => import.meta.client && / Line\//.test(navigator.userAgent)

// intent（2026-10-20 帳號綁定）：login＝登入；link＝已登入 Google／email 的人把這個 LINE 綁到目前的帳號（回來時不重新登入，
// 改打 POST /auth/line/link）。跟 state 存在一起，回呼頁照它分流——redirect_uri 不變，LINE 後台不用多登記網址。
// 不拿 email（使用者 2026-10-20 聽完風險後決定不做 email 自動對應：LINE 不保證 email 驗證過，有人在自己的 LINE 填別人的 Gmail
// 就能進到對方帳號）。連到既有帳號只靠主動綁定
export type LineIntent = 'login' | 'link'

export function startLineLogin(returnTo: string, intent: LineIntent = 'login') {
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nonce, returnTo, intent }))
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
export function takeLineLogin(state: unknown): { nonce: string; returnTo: string; intent: LineIntent } | null {
  let pending: { state?: string; nonce?: string; returnTo?: string; intent?: string } | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!pending?.nonce || !pending.state || pending.state !== state) return null
  const returnTo = pending.returnTo?.startsWith('/') && !pending.returnTo.startsWith('//') && !pending.returnTo.startsWith('/auth/') ? pending.returnTo : '/'
  // 舊格式（沒有 intent）與不認得的值一律當登入
  return { nonce: pending.nonce, returnTo, intent: pending.intent === 'link' ? 'link' : 'login' }
}
