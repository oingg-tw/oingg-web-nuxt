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

import type { H3Event } from 'h3'

declare module 'h3' {
  interface H3EventContext {
    // 這個請求叫醒了業務中台的冷啟動（見 noteBusinessColdStart）
    coldStart?: { id: string; waitMs: number }
  }
}

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

// 共享金鑰也在這裡加（2026-10-14，業務中台查 log：伺服器端渲染與 system-health 的呼叫都沒帶 x-oingg-nitro-key——原本只有
// /api/core 代理會加）。所有呼叫業務中台的路徑都經過這一支，所以一處加、處處有。代理另外加 x-oingg-client-ip；伺服器端渲染的快取
// 是全站共用的，沒有「某一位使用者」，只帶金鑰。
export async function businessAuthHeaders(): Promise<Record<string, string>> {
  const { businessAudience: audience, businessNitroKey: nitroKey } = useRuntimeConfig()
  const headers: Record<string, string> = nitroKey ? { 'x-oingg-nitro-key': nitroKey } : {}
  if (!audience) return headers
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
  return { ...headers, 'x-serverless-authorization': `Bearer ${identity.token}` }
}

// 冷啟動等待（2026-10-26，見 shared/utils/cold-start-timing.ts）：業務中台的回應帶 cold 標記，就把 id 與這一趟等了多久記在
// 使用者在等的那個請求上，server/plugins/cold-start-timing.ts 寫進它的 Server-Timing。伺服器渲染時呼叫自己的 /api 是內部請求，
// 一路往上記到外層請求（coldStartParent，由那個外掛記）。快取在背景重算時碰到的，回應多半已經送出、寫不進去，就不算
//（使用者沒在等）；還沒送出就會被算進去——管理站看 webServerMs 比 webWaitMs 短就知道是背景的。
// ponytail: 背景重算剛好在回應送出前跑完會被當成使用者在等，要精確得把 swr 的背景執行另外標記
export function noteBusinessColdStart(event: H3Event | null, serverTiming: string | null, waitMs: number): void {
  const id = coldStartIdOf(serverTiming)
  if (!id || !event) return
  let target = event
  while (target.context.coldStartParent) target = target.context.coldStartParent
  target.context.coldStart ??= { id, waitMs }
}

function currentEvent(): H3Event | null {
  try {
    return useEvent()
  } catch {
    return null
  }
}

export async function businessFetch<T>(path: string, options: BusinessFetchOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  await acquireSlot()
  try {
    const headers = await businessAuthHeaders()
    // 從送出才開始算（不含排隊與要 IAM 身分）。管理站的網路時間＝webWaitMs −（業務中台的 firstRequestAt − processStartedAt
    // ＋ firstRequestMs），剩下的是台灣到新加坡的網路＋Cloud Run 在行程啟動前開容器，兩者分不開
    const startedAt = performance.now()
    return await $fetch<T>(path, {
      baseURL: config.businessBase,
      method: options.method ?? 'GET',
      query: options.query,
      body: options.body,
      headers,
      retry: 0,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      onResponse: ({ response }) => noteBusinessColdStart(currentEvent(), response.headers.get('server-timing'), performance.now() - startedAt)
    })
  } finally {
    releaseSlot()
  }
}

// Cache TTLs in seconds — one vocabulary for every defineCachedFunction in server/utils.
export const HOUR = 60 * 60

// Latest knowledgeDate among a set of ISO date strings (null when none).
export function maxIsoDate(dates: (string | null | undefined)[]): string | null {
  return dates.reduce<string | null>((latest, date) => (date && (!latest || date > latest) ? date : latest), null)
}

// 業務中台 sends every metric value as a decimal string（"34.78"）; the pages want numbers, parsed
// ONCE here on the server so both renders (SSR and hydration) read the identical JSON payload.
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}
