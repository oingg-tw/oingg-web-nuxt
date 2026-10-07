// /api/core/<業務中台的路徑> — 瀏覽器呼叫業務中台（原 bff-ts）的唯一入口（2026-10-08，使用者：「讓 Nitro 成為完整的
// BFF」）。原本瀏覽器有 81 處、36 個檔案直接打業務中台；部署後會被 CORS 與 Cloud Run IAM 擋住，業務中台的網址也
// 寫在 HTML 裡。現在瀏覽器只跟同網域的 Nitro 說話，業務中台的網址只在伺服器設定（runtimeConfig.bffBase）。
//
// 這條路由會經手個資（持股、交易、觀察清單、方案）。照 conductor〈Nuxt Nitro 全端架構下的個人資料保護〉：
//   - 不快取：不用 defineCachedFunction；帶登入的回應一律 Cache-Control: private, no-store
//   - 不記錄：不 log 任何標頭與 body（錯誤也只回狀態，不印請求內容）
//   - 不留狀態：模組頂層沒有任何變數，每個請求自己的東西都在函式裡
//
// 刻意不套 server/utils/bff.ts 的「最多 6 個並行」：那是為了 SSR 爬蟲一次展開很多請求設計的，套在使用者請求上會
// 讓全站排同一條隊。公開、可快取的少數 GET 仍走 /api/bff（有白名單與快取），兩者用途不同。
//
// 回應原樣轉回（狀態碼、problem+json 內容不改），前端 classifyApiError／bffErrorCode 照舊能讀；
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
  // ponytail: 取 X-Forwarded-For 最右邊一個（前一跳代理加的，用戶端偽造不到），假設前面恰好一層代理；
  // 部署平台確定後若多一層 CDN，要改成取倒數第二個。
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',').at(-1)!.trim() : getRequestIP(event)

  const headers: Record<string, string> = {}
  if (authorization) headers.authorization = authorization
  if (contentType) headers['content-type'] = contentType
  if (clientIp) headers['x-oingg-client-ip'] = clientIp
  // 業務中台只在金鑰相符時才相信上面那個 IP（否則用 Nitro 自己的 IP，全站共用一份額度）
  const nitroKey = useRuntimeConfig(event).bffNitroKey
  if (nitroKey) headers['x-oingg-nitro-key'] = nitroKey

  try {
    const response = await $fetch.raw<string>(`/${path}`, {
      baseURL: useRuntimeConfig(event).bffBase,
      method: method as 'GET',
      query: getQuery(event),
      headers,
      body: method === 'GET' ? undefined : await readRawBody(event, false),
      timeout: 12_000,
      retry: 0,
      ignoreResponseError: true,
      responseType: 'text'
    })
    setResponseStatus(event, response.status, response.statusText)
    for (const name of PASSED_BACK) {
      const value = response.headers.get(name)
      if (value) setResponseHeader(event, name, value)
    }
    if (authorization) setResponseHeader(event, 'cache-control', 'private, no-store')
    return response._data ?? null
  } catch (error) {
    // 沒拿到回應：逾時或連不上。用跟業務中台相同的代碼，前端的分類照常
    const text = `${(error as Error)?.name ?? ''} ${(error as Error)?.message ?? ''}`
    return /timeout|timed out|aborted/i.test(text)
      ? problem(event, 504, 'Gateway Timeout', 'UPSTREAM_TIMEOUT', '業務中台回應逾時')
      : problem(event, 502, 'Bad Gateway', 'UPSTREAM_UNAVAILABLE', '連不上業務中台')
  }
})
