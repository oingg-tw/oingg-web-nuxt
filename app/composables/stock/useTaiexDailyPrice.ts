export interface TaiexDailyPriceEntry {
  tradeDate: string
  close: number | null
}

interface TaiexDailyPriceResponse {
  entries: { tradeDate: string; close: string | null }[]
}

// bff-ts's GET /market/taiex-daily-price (confirmed live 2026-09-14, pure passthrough of
// analysis-ts's own new endpoint requested this same day for the "個股股價 vs 大盤" Beta
// comparison card) — oldest→newest, close normalized as a string (bff-ts convention for numeric
// fields, same as daily-price-history's own close), null when no trade that day. limit is a
// day-count capped 1-2000 by bff-ts, defaults 250 — mirrors useDailyPriceHistory.ts's own shape.
type CachedEntries = TaiexDailyPriceEntry[] | null

const inFlight = new Map<string, Promise<CachedEntries>>()

function toNumber(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function useTaiexDailyPrice(limit: Ref<number>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<number, CachedEntries>>('taiex-daily-price-cache', () => ({}))
  const data = ref<TaiexDailyPriceEntry[] | null>(null)
  const pending = ref(false)

  async function fetchEntries(targetLimit: number): Promise<CachedEntries> {
    try {
      const result = await $fetch<TaiexDailyPriceResponse>('/market/taiex-daily-price', {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { limit: targetLimit }
      })
      return result.entries.map(entry => ({ tradeDate: entry.tradeDate, close: toNumber(entry.close) }))
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[taiex-daily-price] GET ${config.public.apiBase}/market/taiex-daily-price unavailable (${reason})`)
      }
      return null
    } finally {
      inFlight.delete(String(targetLimit))
    }
  }

  async function load() {
    const targetLimit = limit.value
    const key = targetLimit
    let cached: CachedEntries
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(String(key))
      if (!request) {
        request = fetchEntries(targetLimit)
        inFlight.set(String(key), request)
      }
      cached = await request
      cache.value[key] = cached
    }
    if (limit.value !== targetLimit) return
    pending.value = false
    data.value = cached
  }

  watch(limit, load, { immediate: true })

  return { data, pending }
}
