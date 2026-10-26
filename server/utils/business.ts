// The one way Nitro code talks to oingg-bff-ts (2026-09-19, the SEO build). Every upstream call
// the server makes for a page goes through here so two things hold everywhere:
// - it fails fast and loudly（retry 0, 12s timeout, the error propagates）— the cached functions
//   in stock-data.ts/hub-data.ts must never cache a failure, and defineCachedFunction only skips
//   the write when the function throws;
// - at most MAX_CONCURRENT_UPSTREAM requests are in flight at once. A cold cache under a crawler
//   burst（every stock page fanning out 5–14 calls at once）would otherwise spike through 業務中台;
//   the semaphore turns that spike into a queue instead of a run of failures that would get cached
//   as thin pages. 6 → 12 on 2026-10-26: a stock page makes about 10 calls and now sends them
//   together (9b347da4), so at 6 the last four queued behind the first ones — on a cold start, behind
//   containers that were still booting. 業務中台 checked it: these calls carry the Nitro key and no
//   user IP or Bearer, so they skip its 300-per-60-seconds per-user/IP quota and only count against
//   its 6,000-a-minute per-container cap; it runs up to 4 containers × 20 concurrent, and 2 web-nuxt
//   instances × 12 fits. The cap still stops a crawler from opening the floodgates.
//
// `$fetch` and `useRuntimeConfig` are Nitro auto-imports. businessBase is server-only (2026-10-08): browsers reach
// 業務中台 only through /api/core and /api/cached.

import type { H3Event } from 'h3'
import type { ColdStartWait } from '#shared/utils/cold-start-timing'

declare module 'h3' {
  interface H3EventContext {
    // 這個請求叫醒的業務中台冷啟動（見 noteBusinessCall）；同時打好幾支時 Cloud Run 會一次開好幾個容器，每個一筆
    coldStarts?: ColdStartWait[]
    // 這個請求等過的每一支業務中台呼叫（開始、結束，performance.now()），冷啟動那一筆的 webWaitAllMs 取它們的聯集
    businessWaits?: [number, number][]
  }
}

type QueryValue = string | number | boolean | undefined

interface BusinessFetchOptions {
  query?: Record<string, QueryValue>
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  timeout?: number
}

const MAX_CONCURRENT_UPSTREAM = 12
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
// Cloudflare Workers 上沒有 metadata server（2026-10-27）：設了 googleServiceAccountKey 就用金鑰自己換（shared/utils/id-token.ts）。
// token 快取到到期前 5 分鐘。拿不到就丟錯——跟上游失敗一樣不會被快取。只快取值、不共用進行中的請求：Workers 上一個請求等另一個請求
// 的 promise，發起的那個先被取消就會卡住；冷的時候同時要的幾個請求各換一次
const METADATA_IDENTITY_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity'
let identity: { token: string; exp: number | null } | null = null

async function fetchIdToken(audience: string, serviceAccountKey: string): Promise<string> {
  if (!serviceAccountKey) {
    return $fetch<string>(METADATA_IDENTITY_URL, { query: { audience }, headers: { 'Metadata-Flavor': 'Google' }, responseType: 'text', timeout: 5000, retry: 1 })
  }
  // Nitro 讀環境變數時會把 JSON 字串先解析成物件（2026-10-27 Workers 上實測），兩種都收
  const key = (typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey) as ServiceAccountKey
  const assertion = await serviceAccountAssertion(key, { target_audience: audience }, Date.now() / 1000)
  const { id_token: token } = await $fetch<{ id_token: string }>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    timeout: 5000,
    retry: 1
  })
  return token
}

// 共享金鑰也在這裡加（2026-10-14，業務中台查 log：伺服器端渲染與 system-health 的呼叫都沒帶 x-oingg-nitro-key——原本只有
// /api/core 代理會加）。所有呼叫業務中台的路徑都經過這一支，所以一處加、處處有。代理另外加 x-oingg-client-ip；伺服器端渲染的快取
// 是全站共用的，沒有「某一位使用者」，只帶金鑰。
export async function businessAuthHeaders(): Promise<Record<string, string>> {
  const { businessAudience: audience, businessNitroKey: nitroKey, googleServiceAccountKey } = useRuntimeConfig()
  const headers: Record<string, string> = nitroKey ? { 'x-oingg-nitro-key': nitroKey } : {}
  if (!audience) return headers
  if (!identity || idTokenNeedsRefresh(identity.exp, Date.now() / 1000)) {
    const token = await fetchIdToken(audience, googleServiceAccountKey)
    identity = { token, exp: jwtExpiry(token) }
  }
  return { ...headers, 'x-serverless-authorization': `Bearer ${identity.token}` }
}

// 冷啟動等待（2026-10-26，見 shared/utils/cold-start-timing.ts）：每一支業務中台呼叫都記下起訖，回應帶 cold 標記的再記 id 與等了多久，
// 都記在使用者在等的那個請求上，server/plugins/cold-start-timing.ts 寫進它的 Server-Timing（只有叫醒冷啟動的請求才寫）。
// 伺服器渲染時呼叫自己的 /api 是內部請求，一路往上記到外層請求（coldStartParent，由那個外掛記）。快取在背景重算時碰到的，
// 回應多半已經送出、寫不進去，就不算（使用者沒在等）；還沒送出就會被算進去——管理站看 webServerMs 比 webWaitMs 短就知道是背景的。
// ponytail: 背景重算剛好在回應送出前跑完會被當成使用者在等，要精確得把 swr 的背景執行另外標記
export function noteBusinessCall(event: H3Event | null, serverTiming: string | null, startedAt: number, endedAt: number): void {
  if (!event) return
  let target = event
  while (target.context.coldStartParent) target = target.context.coldStartParent
  ;(target.context.businessWaits ??= []).push([startedAt, endedAt])
  const id = coldStartIdOf(serverTiming)
  if (!id) return
  const colds = (target.context.coldStarts ??= [])
  if (!colds.some(cold => cold.id === id)) colds.push({ id, waitMs: endedAt - startedAt })
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
    let serverTiming: string | null = null
    try {
      return await $fetch<T>(path, {
        baseURL: config.businessBase,
        method: options.method ?? 'GET',
        query: options.query,
        body: options.body,
        headers,
        retry: 0,
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
        onResponse: ({ response }) => {
          serverTiming = response.headers.get('server-timing')
        }
      })
    } finally {
      // 失敗、逾時也是在等
      noteBusinessCall(currentEvent(), serverTiming, startedAt, performance.now())
    }
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
