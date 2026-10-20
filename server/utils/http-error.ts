// 5xx 的原因代碼與路徑樣板（2026-10-21，管理站「排程與服務」頁要依原因、路徑列出 web-nuxt 的 5xx；使用者：「503 x 3」看不出原因）。
// 寫紀錄的是 server/plugins/http-errors.ts，GCP 的 log-based metric http_errors 從那一行數。零 import：scripts/check-http-error.mjs 直接載入。
//
// 原因代碼（管理站照這幾個字分組，改了要通知它）：
//   upstream_timeout     業務中台逾時：我們等不到（12 秒），或它自己回 504
//   upstream_unreachable 連不上業務中台（沒有回應）
//   upstream_error       業務中台回了 504 以外的 5xx
//   upstream_failed      讀上游失敗，但細節在中途被吞掉了（hub 的快取函式讀不到就回 null，路由再丟 503）
//   app_error            我們自己的程式沒接住的例外
// Cloud Run 平台自己回的（例如縮到 0 後「no available instance」）不會進到程式，指標裡那幾筆沒有 reason。
export type HttpErrorReason = 'upstream_timeout' | 'upstream_unreachable' | 'upstream_error' | 'upstream_failed' | 'app_error'

// 打業務中台失敗時的原因：ofetch 的 FetchError（逾時沒有狀態碼、上游回錯有狀態碼）
export function upstreamFailureReason(error: unknown): 'upstream_timeout' | 'upstream_unreachable' | 'upstream_error' {
  const e = (error ?? {}) as { name?: string; message?: string; statusCode?: number; status?: number }
  const status = e.statusCode ?? e.status
  if (status === 504 || /timeout|timed out|aborted/i.test(`${e.name ?? ''} ${e.message ?? ''}`)) return 'upstream_timeout'
  return status ? 'upstream_error' : 'upstream_unreachable'
}

// 錯誤鏈上的這一環是不是「打上游失敗」。h3 把沒接住的例外包成 H3Error 時，cause 會跳過 FetchError 本身、直接接到它底下的
// TypeError('fetch failed')（連不上）或 TimeoutError（逾時）——2026-10-21 實測；上游回了錯誤狀態的 FetchError 沒有 cause，會留在鏈上
export function isUpstreamFetchFailure(error: unknown): boolean {
  const e = (error ?? {}) as { name?: string; message?: string }
  return e.name === 'FetchError' || e.name === 'TimeoutError' || e.name === 'AbortError' || (e.name === 'TypeError' && e.message === 'fetch failed')
}

// 路徑樣板：去掉查詢字串，帶數字或大小寫混合的長亂碼（分享 token）換成 :id（/stock/2330/pe-ratio → /stock/:id/pe-ratio、/share/<token> → /share/:id），
// 免得每個代號各自成一條時間序列。
// ponytail: 靠「有沒有數字」猜參數；哪天有固定的路徑段本身帶數字（例如 top10），它也會變 :id——那時改成讀 router 的路由樣板。
export function routeTemplate(path: string): string {
  const pathname = path.split('?')[0] || '/'
  return pathname.split('/').map(segment => (/\d/.test(segment) || (segment.length >= 16 && /[A-Z]/.test(segment) && /[a-z]/.test(segment)) ? ':id' : segment)).join('/')
}
