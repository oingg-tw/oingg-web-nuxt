// The one way Nitro code talks to oingg-bff-ts (2026-09-19, the SEO build). Every upstream call
// the server makes for a page goes through here so two things hold everywhere:
// - it fails fast and loudly（retry 0, 12s timeout, the error propagates）— the cached functions
//   in stock-data.ts/hub-data.ts must never cache a failure, and defineCachedFunction only skips
//   the write when the function throws;
// - at most MAX_CONCURRENT_UPSTREAM requests are in flight at once. bff-ts rate-limits at
//   300 requests per 60 seconds per IP (its own ratelimit-policy header); the cache keeps the
//   steady state far below that, but a cold cache under a crawler burst（every stock page fanning
//   out 5–14 calls at once）would otherwise spike through it. A small semaphore turns that spike
//   into a queue instead of a run of 429s that would get cached as thin pages.
//
// `$fetch` and `useRuntimeConfig` are Nitro auto-imports; public.apiBase is the same base URL
// the browser-side composables use.

type QueryValue = string | number | boolean | undefined

interface BffFetchOptions {
  query?: Record<string, QueryValue>
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  timeout?: number
}

const MAX_CONCURRENT_UPSTREAM = 6
// 逾時一層比一層短（2026-10-08，使用者選了 bff 提的 15＞12＞10）：瀏覽器 15 秒（BFF_REQUEST_TIMEOUT_MS）＞
// 這裡 12 秒＞bff 等上游 10 秒。原本這裡也是 10 秒、跟 bff 同時放棄，於是永遠收不到 bff 那個帶 UPSTREAM_TIMEOUT
// 代碼的 504，只看到自己逾時。改這個數字前先確認 bff 那一層還是比它短。
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

export async function bffFetch<T>(path: string, options: BffFetchOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  await acquireSlot()
  try {
    return await $fetch<T>(path, {
      baseURL: config.public.apiBase,
      method: options.method ?? 'GET',
      query: options.query,
      body: options.body,
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

// bff-ts sends every metric value as a decimal string（"34.78"）; the pages want numbers, parsed
// ONCE here on the server so both renders (SSR and hydration) read the identical JSON payload.
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}
