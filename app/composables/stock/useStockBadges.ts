export interface StockBadgeEntry {
  metricCode: string
  name: string
  nameEn: string
  timeframe: string
  value: number | null
  nullReason: string | null
  passed: boolean | null
  // Added 2026-09-14 (analysis-ts + bff-ts follow-up once this composable's own initial gap
  // report went out) — same semantics as metrics-history/piotroski-breakdown's own fields of the
  // same name: knowledgeDateIsFallback=true means the value is stamped with the fiscal-period-end
  // date because the real filing-announcement date isn't available, not a real disclosure date.
  // Both null when there's no data to date at all.
  knowledgeDate: string | null
  knowledgeDateIsFallback: boolean | null
}

export interface StockBadgeCategory {
  categoryKey: string
  categoryDisplayName: string
  badges: StockBadgeEntry[]
}

export interface StockBadges {
  symbol: string
  categories: StockBadgeCategory[]
}

// bff-ts's GET /stocks/:symbol/badges (confirmed live 2026-09-14, pure passthrough of
// analysis-ts's own new per-company badge-evaluation endpoint) — the backend's own computed
// pass/fail source of truth, added specifically to REPLACE StockGuruBadgeDialog.vue's own
// former client-side threshold comparison (guru-badges.ts's numeratorFor()/comparator engine),
// which analysis-ts confirmed had real bugs (inconsistent comparator handling, industry-exclusion
// null cases not handled correctly). knowledgeDate/knowledgeDateIsFallback added the same day
// once flagged as a gap (StockGuruBadgeDialog.vue's own "資料時間" line briefly went blank
// for non-Piotroski badges in between) — now reads directly off this endpoint.
//
// Does NOT cover the 3 Piotroski F-Score sub-badges (confirmed live: piotroskiFScore never
// appears in this response's categories) — those stay on usePiotroskiBreakdown.ts's own separate
// endpoint/shape (group booleans, not a single value/passed pair), unchanged by this migration.
//
// Cache/inFlight pattern matches usePiotroskiBreakdown.ts (symbol-keyed live value data, not
// SSR-cacheable static content).
// Exported (2026-09-19) for useStockPageDigest's SSR cache pre-warm — same useState key/shape.
export type CachedBadges = StockBadges | null

const inFlight = new Map<string, Promise<CachedBadges>>()

export function useStockBadges(symbol: Ref<string | undefined>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedBadges>>('stock-badges-cache', () => ({}))
  const data = ref<StockBadges | null>(null)
  const pending = ref(false)

  async function fetchBadges(targetSymbol: string): Promise<CachedBadges> {
    try {
      return await $fetch<StockBadges>(`/stocks/${targetSymbol}/badges`, {
        baseURL: config.public.apiBase,
        retry: 0
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-badges] GET ${config.public.apiBase}/stocks/${targetSymbol}/badges unavailable (${reason})`)
      }
      return null
    } finally {
      inFlight.delete(targetSymbol)
    }
  }

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      return
    }
    let cached: CachedBadges
    if (targetSymbol in cache.value) {
      cached = cache.value[targetSymbol] ?? null
    } else {
      pending.value = true
      // Client-only fetch (2026-09-19): on the server this composable never issues the request
      // itself — a cache HIT above still takes the synchronous path (that's how the page-level
      // useStockPageDigest's pre-warmed useState cache lets this card render real content in SSR),
      // but a MISS must not fire an un-awaited $fetch whose late cache write could land in the
      // payload after this render already took the pending branch (hydration mismatch). `pending`
      // is set before returning so the SSR markup is the same loading state the client's own first
      // render produces.
      if (import.meta.server) return
      let request = inFlight.get(targetSymbol)
      if (!request) {
        request = fetchBadges(targetSymbol)
        inFlight.set(targetSymbol, request)
      }
      cached = await request
      cache.value[targetSymbol] = cached
    }
    if (symbol.value !== targetSymbol) return
    pending.value = false
    data.value = cached
  }

  watch(symbol, load, { immediate: true })

  return { data, pending }
}

// Flat metricCode -> entry lookup across every category — StockGuruBadgeDialog.vue matches
// a GuruBadge's own `id` (===metricCode for every non-Piotroski badge, see guru-badges.ts's own
// metricBadgeToGuruBadge()) against this, not the categoryKey grouping (a badge's DISPLAY category
// here is this app's own 8-category taxonomy via METRIC_CATEGORY_KEY_TO_DISPLAY, independent of
// which of the new endpoint's categories happens to list it).
export function findStockBadgeEntry(badges: StockBadges | null, metricCode: string): StockBadgeEntry | null {
  if (!badges) return null
  for (const category of badges.categories) {
    const entry = category.badges.find(badge => badge.metricCode === metricCode)
    if (entry) return entry
  }
  return null
}
