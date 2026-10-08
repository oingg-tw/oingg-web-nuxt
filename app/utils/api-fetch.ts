// 瀏覽器端打 bff-ts 的統一入口與錯誤分類（2026-10-08，使用者要讀取失敗改成全站統一彈窗，並「跟 bff 一起想想
// api best practice」）。伺服器端早就有自己的入口 server/utils/bff.ts（不重試、10 秒、限並行）；這裡是瀏覽器那一側。
// 名字刻意不叫 bffFetch：兩邊都是自動匯入，同名只會讓人以為是同一支。
//
// 逾時預算一條鏈：瀏覽器 15 秒（BFF_REQUEST_TIMEOUT_MS）＞ bff 等上游 10 秒，下游一定比上游先放棄，
// 所以上游慢的時候我們拿到的是 bff 的 502／504，而不是自己先逾時、什麼都不知道。

// 瀏覽器端打業務中台一律走同網域的 Nitro 轉發（2026-10-08，「讓 Nitro 成為完整的 BFF」）：業務中台的網址只在伺服器
// 設定裡，瀏覽器看不到也連不到。見 server/api/core/[...path].ts。公開、可快取的少數 GET 走 /api/bff。
export const BFF_BASE = '/api/core'
// 公開、可快取的少數 GET 走 Nitro 的快取轉發（2026-09-19，server/api/bff/[...path].get.ts）：同路徑同形狀、伺服器快取一小時，
// 爬幾千頁只讓業務中台每小時算一次型錄
export const BFF_CACHED_BASE = '/api/bff'

export function apiFetch<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
  return $fetch<T>(path, {
    baseURL: BFF_BASE,
    timeout: BFF_REQUEST_TIMEOUT_MS,
    // ofetch 預設 GET 失敗重試一次：對連不上的後端只是加倍等待（實測還讓呼叫端的 pending 卡住），一律不重試
    retry: 0,
    ...options
  }) as Promise<T>
}

// 讀取失敗可能的原因。只是「可能」：瀏覽器分不出「伺服器很慢」與「中間的網路很慢」，文案要照這個分寸寫。
//   offline     瀏覽器回報沒有網路
//   timeout     等太久（我們自己逾時，或 bff 等上游逾時的 504）
//   unavailable 連不上或上游掛了（502／503／429、網路錯誤）
//   server      其他 5xx
//   client      4xx——重試多半沒用，不自動重試
export type LoadFailureKind = 'offline' | 'timeout' | 'unavailable' | 'busy' | 'server' | 'client'

export interface ClassifiedFailure {
  kind: LoadFailureKind
  status: number | null
  // 秒；bff 有給 Retry-After 時照它排下一次重試
  retryAfter: number | null
  // bff 有給 X-Request-Id 時顯示給使用者，回報問題時對得上
  requestId: string | null
}

// 業務中台的錯誤代碼（RFC 9457 problem+json 的 `code`，bffErrorCode 已轉小寫）。可不可以重試由代碼推得，表只放這一份；
// 沒有代碼的錯誤（網路層、沒帶代碼的 502）才退回看狀態碼。
const CODE_KINDS: Record<string, LoadFailureKind> = {
  upstream_timeout: 'timeout',
  upstream_unavailable: 'unavailable',
  upstream_bad_response: 'unavailable',
  rate_limited: 'unavailable',
  // 503＋Retry-After：全站每分鐘額度（每個實例 3,800 次，2026-10-08）滿了，不是這個呼叫端的錯（RFC 9110），所以不是 429
  server_busy: 'busy',
  internal: 'server',
  validation: 'client',
  unauthenticated: 'client',
  quota_exceeded: 'client',
  not_found: 'client',
  conflict: 'client'
}

interface FetchLikeError {
  name?: string
  message?: string
  statusCode?: number
  status?: number
  response?: { status?: number; headers?: { get(name: string): string | null } }
}

export function classifyApiError(error: unknown): ClassifiedFailure {
  // useAsyncData 把錯誤包成 NuxtError，原本的回應（含 Retry-After、X-Request-Id 標頭）在 cause 裡——不拆開的話
  // 503 的 Retry-After 讀不到（2026-10-08 用攔截請求實測：倒數照預設 5 秒而不是 12 秒）
  const wrapped = error && typeof error === 'object' ? (error as { cause?: unknown }).cause : null
  const source = wrapped && typeof wrapped === 'object' && ('response' in wrapped || 'statusCode' in wrapped) ? wrapped : error
  const e = (source ?? {}) as FetchLikeError
  const status = e.statusCode ?? e.status ?? e.response?.status ?? null
  const retryAfterRaw = e.response?.headers?.get('retry-after') ?? null
  const retryAfter = retryAfterRaw !== null && /^\d+$/.test(retryAfterRaw.trim()) ? Number(retryAfterRaw) : null
  // 參考編號：X-Request-Id 標頭（bff 已對瀏覽器開放），或 problem+json 的 instance（urn:uuid:<同一個 id>）
  const instance = (source as { data?: { instance?: unknown } } | null)?.data?.instance
  const requestId = e.response?.headers?.get('x-request-id') ?? (typeof instance === 'string' ? instance.replace(/^urn:uuid:/, '') : null)
  const base = { status, retryAfter, requestId }
  if (import.meta.client && typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline', ...base }
  const coded = CODE_KINDS[bffErrorCode(source) ?? '']
  if (coded) return { kind: coded, ...base }
  if (status === null || status === 0) {
    const text = `${e.name ?? ''} ${e.message ?? ''}`
    return { kind: /timeout|timed out|aborted/i.test(text) ? 'timeout' : 'unavailable', ...base }
  }
  if (status === 504 || status === 408) return { kind: 'timeout', ...base }
  if (status === 502 || status === 503 || status === 429) return { kind: 'unavailable', ...base }
  if (status >= 500) return { kind: 'server', ...base }
  return { kind: 'client', ...base }
}

// ---- POST /screener/values 的單一入口（2026-10-08）----
// 指標速覽、觀察清單、持股報價三處都走這一支，要調整（例如拆批）只改這裡。
// ponytail: 不拆批。早上量到 12 欄單檔冷快取超過 bff 的 10 秒、整批 502（逐欄 0.3～1.9 秒），當天下午重量：三檔新的
// 冷股票 12 欄一次送 0.33～0.35 秒，拆成 4 欄×3 批並行反而 0.7～1.3 秒、還吃三倍 bff 每 IP 每 60 秒 300 次的額度。
// 早上的慢是本機 analysis-ts 回填期間的暫時現象（見記憶「本機讀 DEV 資料」），讀不到時由全站彈窗自動重試。若雲端
// 也量到欄數一多就逾時，再在這裡拆批——特殊欄位（stock.*）不能自成一批，只送特殊欄位 bff 會回 400。
export interface ScreenerValuesResult<V> {
  results: { symbol: string; values: Record<string, V | undefined> }[]
}

export function fetchScreenerValues<V>(symbols: string[], fields: string[]): Promise<ScreenerValuesResult<V>> {
  return apiFetch<ScreenerValuesResult<V>>('/screener/values', {
    method: 'POST',
    body: { symbols, columns: fields.map(field => ({ field })) }
  })
}
