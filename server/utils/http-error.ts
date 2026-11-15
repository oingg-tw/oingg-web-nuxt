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

// /api/core 自己擋下、不會到業務中台的請求（2026-11-15 紫隊演練招 4：打 /api/core/admin… 的 30 筆業務中台一筆都沒有，只有 web 這層
// 看得到；使用者：「兩個都按照建議」）。server/api/core/[...path].ts 每擋一筆寫一行 event: http_blocked，不算進 5xx 的 http_error。
// 原因代碼（管理站照這幾個字分組，改了要通知它）：
//   method_not_allowed  不是 GET／POST／PUT／PATCH／DELETE（405）
//   path_invalid        路徑有不接受的字元，或有 . 與 .. 段（400）
//   path_blocked        只給 Nitro 的 openapi.json、cold-starts/、admin/（404）
// 網站頁面的 404（/.env、/wp-login.php 這類掃描）不記：使用者只要 API 轉送自己擋下的，頁面 404 量大，一般打錯網址也會進來。
export type BlockedReason = 'method_not_allowed' | 'path_invalid' | 'path_blocked'

export function blockedRecord(method: string, path: string, status: number, reason: BlockedReason, ip: string | null | undefined) {
  // 截到 200 字：路徑是請求的人自己寫的，不讓一個超長路徑塞爆一行
  const route = routeTemplate(path).slice(0, 200)
  return { severity: 'WARNING', message: `http_blocked ${status} ${route} ${reason}`, event: 'http_blocked', route, reason, httpRequest: { requestMethod: method, status, remoteIp: ip ? maskIp(ip) : null } }
}

// IP 去識別化，跟業務中台的 mask_ip 一樣（oingg-business-rust crates/http/src/client_identity.rs）：IPv4 抹掉最後一段、
// IPv6 只留前 64 位元，同一個來源在兩邊的紀錄對得起來；完整 IP 不寫進紀錄
export function maskIp(ip: string): string {
  const v4Prefix = (s: string) => (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) ? s.slice(0, s.lastIndexOf('.')) : null)
  const v4 = v4Prefix(ip)
  if (v4) return `${v4}.0`
  const lastColon = ip.lastIndexOf(':')
  if (lastColon < 0) return '?'
  const mapped = v4Prefix(ip.slice(lastColon + 1))
  if (mapped) return `${ip.slice(0, lastColon + 1)}${mapped}.0`
  const [left = '', right] = ip.split('::')
  const groups = left ? left.split(':') : []
  if (right !== undefined) {
    const tail = right ? right.split(':') : []
    groups.push(...Array.from({ length: Math.max(0, 8 - groups.length - tail.length) }, () => '0'), ...tail)
  }
  return `${groups.slice(0, 4).join(':')}::`
}

// 路徑樣板：去掉查詢字串，帶數字或大小寫混合的長亂碼（分享 token）換成 :id（/stock/2330/pe-ratio → /stock/:id/pe-ratio、/share/<token> → /share/:id），
// 免得每個代號各自成一條時間序列。
// ponytail: 靠「有沒有數字」猜參數；哪天有固定的路徑段本身帶數字（例如 top10），它也會變 :id——那時改成讀 router 的路由樣板。
export function routeTemplate(path: string): string {
  const pathname = path.split('?')[0] || '/'
  return pathname.split('/').map(segment => (/\d/.test(segment) || (segment.length >= 16 && /[A-Z]/.test(segment) && /[a-z]/.test(segment)) ? ':id' : segment)).join('/')
}
