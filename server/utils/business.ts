// The one way Nitro code talks to oingg-bff-ts (2026-09-19, the SEO build). Every upstream call
// the server makes for a page goes through here so two things hold everywhere:
// - it fails fast and loudly（retry 0, 12s timeout, the error propagates）— the cached functions
//   in stock-data.ts/hub-data.ts must never cache a failure, and defineCachedFunction only skips
//   the write when the function throws;
// - at most MAX_CONCURRENT_UPSTREAM requests are in flight at once. 業務中台 rate-limits at
//   300 requests per 60 seconds per IP (its own ratelimit-policy header); the cache keeps the
//   steady state far below that, but a cold cache under a crawler burst（every stock page fanning
//   out 5–14 calls at once）would otherwise spike through it. A small semaphore turns that spike
//   into a queue instead of a run of 429s that would get cached as thin pages.
//
// `$fetch` and `useRuntimeConfig` are Nitro auto-imports. businessBase is server-only (2026-10-08): browsers reach
// 業務中台 only through /api/core and /api/cached.

type QueryValue = string | number | boolean | undefined

interface BusinessFetchOptions {
  query?: Record<string, QueryValue>
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  timeout?: number
}

const MAX_CONCURRENT_UPSTREAM = 6
// 逾時一層比一層短（2026-10-08，使用者選了 業務中台 提的 15＞12＞10）：瀏覽器 15 秒（BUSINESS_REQUEST_TIMEOUT_MS）＞
// 這裡 12 秒＞業務中台 等上游 10 秒。原本這裡也是 10 秒、跟 業務中台 同時放棄，於是永遠收不到 業務中台 那個帶 UPSTREAM_TIMEOUT
// 代碼的 504，只看到自己逾時。改這個數字前先確認 業務中台 那一層還是比它短。
const DEFAULT_TIMEOUT_MS = 12_000

let active = 0
const waiters: (() => void)[] = []

function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT_UPSTREAM) {
    active += 1
    return Promise.resolve()
  }
  return new Promise(resolve => {
    waiters.push(() => {
      active += 1
      resolve()
    })
  })
}

function releaseSlot(): void {
  active -= 1
  const next = waiters.shift()
  if (next) next()
}

// 業務中台在 Cloud Run 上有 IAM 鎖（2026-10-14，部署到 Firebase App Hosting）：沒帶 Google 身分會被 403。Nitro 用自己的執行身分
//（App Hosting 的 firebase-app-hosting-compute 服務帳戶）向 metadata server 要一張 ID token，放在 X-Serverless-Authorization——
// Authorization 已經被使用者的 Firebase token 佔用（/api/core 照轉），Cloud Run 會先看 X-Serverless-Authorization。
// businessAudience 空字串＝本機與 CI：不帶任何身分，行為跟以前一樣（本機的業務中台沒有 IAM 鎖）。
// token 快取到到期前 5 分鐘；同時多個請求要新 token 時共用同一次 metadata 請求。拿不到就丟錯——跟上游失敗一樣不會被快取。
const METADATA_IDENTITY_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity'
let identity: { token: string; exp: number | null } | null = null
let identityRequest: Promise<string> | null = null

export async function businessAuthHeaders(): Promise<Record<string, string>> {
  const audience = useRuntimeConfig().businessAudience
  if (!audience) return {}
  if (!identity || idTokenNeedsRefresh(identity.exp, Date.now() / 1000)) {
    identityRequest ??= $fetch<string>(METADATA_IDENTITY_URL, {
      query: { audience },
      headers: { 'Metadata-Flavor': 'Google' },
      responseType: 'text',
      timeout: 5000,
      retry: 1
    }).finally(() => {
      identityRequest = null
    })
    const token = await identityRequest
    identity = { token, exp: jwtExpiry(token) }
  }
  return { 'x-serverless-authorization': `Bearer ${identity.token}` }
}

export async function businessFetch<T>(path: string, options: BusinessFetchOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  await acquireSlot()
  try {
    return await $fetch<T>(path, {
      baseURL: config.businessBase,
      method: options.method ?? 'GET',
      query: options.query,
      body: options.body,
      headers: await businessAuthHeaders(),
      retry: 0,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS
    })
  } finally {
    releaseSlot()
  }
}

// Cache TTLs in seconds — one vocabulary for every defineCachedFunction in server/utils.
export const HOUR = 60 * 60

// Latest knowledgeDate among a set of ISO date strings (null when none).
export function maxIsoDate(dates: (string | null | undefined)[]): string | null {
  let latest: string | null = null
  for (const date of dates) {
    if (date && (!latest || date > latest)) latest = date
  }
  return latest
}

// 業務中台 sends every metric value as a decimal string（"34.78"）; the pages want numbers, parsed
// ONCE here on the server so both renders (SSR and hydration) read the identical JSON payload.
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}
