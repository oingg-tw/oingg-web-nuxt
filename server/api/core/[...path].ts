// /api/core/<業務中台的路徑> — 瀏覽器呼叫業務中台的唯一入口（2026-10-08，使用者要求瀏覽器的每一個
// 請求都改由 web-nuxt 伺服器層轉發）。原本瀏覽器有 81 處、36 個檔案直接打業務中台；部署後會被 CORS 與 Cloud Run IAM 擋住，業務中台的網址也
// 寫在 HTML 裡。現在瀏覽器只跟同網域的 Nitro 說話，業務中台的網址只在伺服器設定（runtimeConfig.businessBase）。
//
// 這條路由會經手個資（持股、交易、觀察清單、方案）。照 conductor〈Nuxt Nitro 全端架構下的個人資料保護〉：
//   - 不快取：不用 defineCachedFunction；帶登入的回應一律 Cache-Control: private, no-store
//   - 不記錄：不 log 任何標頭與 body（錯誤也只回狀態，不印請求內容）
//   - 不留狀態：模組頂層沒有任何變數，每個請求自己的東西都在函式裡
//
// 刻意不套 server/utils/business.ts 的「最多 6 個並行」：那是為了 SSR 爬蟲一次展開很多請求設計的，套在使用者請求上會
// 讓全站排同一條隊。公開、可快取的少數 GET 仍走 /api/cached（有白名單與快取），兩者用途不同。
//
// 回應原樣轉回（狀態碼、problem+json 內容不改），前端 classifyApiError／businessErrorCode 照舊能讀；
// X-Request-Id、Retry-After、RateLimit-* 也轉回。逾時 12 秒：瀏覽器 15＞這裡 12＞業務中台等上游 10。

import type { H3Event } from 'h3'

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const PASSED_BACK = ['content-type', 'x-request-id', 'retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'ratelimit-policy', 'cache-control']

function problem(event: H3Event, status: number, title: string, code: string | null, detail: string) {
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', 'application/problem+json')
  setResponseHeader(event, 'cache-control', 'no-store')
  const type = code ? `tag:oingg.com,2026:${code.toLowerCase().replace(/_/g, '-')}` : 'about:blank'
  return { type, title, status, detail, ...(code ? { code } : {}) }
}

export default defineEventHandler(async (event) => {
  const method = event.method.toUpperCase()
  if (!METHODS.has(method)) return problem(event, 405, 'Method Not Allowed', null, `不接受 ${method}`)

  // 只轉到業務中台根網址下：路徑只允許這些字元，任何 .. 都拒絕
  const path = getRouterParam(event, 'path') ?? ''
  if (!/^[A-Za-z0-9/_.-]+$/.test(path) || path.split('/').includes('..')) return problem(event, 400, 'Bad Request', null, '不接受的路徑')

  const authorization = getRequestHeader(event, 'authorization')
  const contentType = getRequestHeader(event, 'content-type')
  // 使用者的 IP，給業務中台第二階段「依 IP 限流未登入請求」用——它只在確認請求來自 Nitro 之後才採用這個標頭。
  // Firebase App Hosting 上實測（2026-10-14，對照測試機的對外 IP）：X-Forwarded-For 是「使用者, 35.219.200.76（App Hosting 的 CDN）,
  // 66.249.82.x（Google 前端，每次不同）」；故意送 X-Forwarded-For: 1.2.3.4 時它被接在最左邊。所以從右邊數第 3 段才是使用者，
  // 而且偽造不到——最左邊那段可以被使用者自己填，不能用。本機沒有代理、沒有這個標頭，用連線的 IP。
  // ponytail: 層數寫死 2（CDN＋Google 前端）；換部署平台或前面多一層代理就要重量一次，改成 runtimeConfig。
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  const clientIp = forwarded?.split(',').map(part => part.trim()).at(-3) ?? getRequestIP(event)

  const headers: Record<string, string> = {}
  if (authorization) headers.authorization = authorization
  if (contentType) headers['content-type'] = contentType
  if (clientIp) headers['x-oingg-client-ip'] = clientIp
  // 共享金鑰（業務中台只在金鑰相符時才相信上面那個 IP）與 Cloud Run IAM 的身分——見 server/utils/business.ts 的 businessAuthHeaders
  Object.assign(headers, await businessAuthHeaders())

  try {
    const body = method === 'GET' ? undefined : await readRawBody(event, false)
    // 冷啟動等待從真正送出才開始算（同 businessFetch），不含讀瀏覽器送來的內容
    const startedAt = performance.now()
    const response = await $fetch.raw<string>(`/${path}`, {
      baseURL: useRuntimeConfig(event).businessBase,
      method: method as 'GET',
      query: getQuery(event),
      headers,
      body,
      timeout: 12_000,
      retry: 0,
      ignoreResponseError: true,
      responseType: 'text'
    })
    setResponseStatus(event, response.status, response.statusText)
    noteBusinessCall(event, response.headers.get('server-timing'), startedAt, performance.now())
    // 上游的 5xx 原樣轉回；原因給 server/plugins/http-errors.ts 記
    if (response.status >= 500) event.context.httpErrorReason = response.status === 504 ? 'upstream_timeout' : 'upstream_error'
    for (const name of PASSED_BACK) {
      const value = response.headers.get(name)
      if (value) setResponseHeader(event, name, value)
    }
    if (authorization) setResponseHeader(event, 'cache-control', 'private, no-store')
    return response._data ?? null
  } catch (error) {
    // 沒拿到回應：逾時或連不上。用跟業務中台相同的代碼，前端的分類照常
    const reason = upstreamFailureReason(error)
    event.context.httpErrorReason = reason
    return reason === 'upstream_timeout'
      ? problem(event, 504, 'Gateway Timeout', 'UPSTREAM_TIMEOUT', '伺服器回應逾時，請稍後再試')
      : problem(event, 502, 'Bad Gateway', 'UPSTREAM_UNAVAILABLE', '暫時連不上伺服器，請稍後再試')
  }
})
