export interface IndustryChainCompany {
  symbol: string
  companyName: string
  category: string | null
  coarseGroup: string | null
  // Replaced confidence/sampleSize with a single source flag 2026-09-15 per analysis-ts's
  // methodology change (relayed by bff-ts): 'keyword' = free keyword-rule match only, 'gemini' =
  // additionally Gemini-verified/corrected (~99% of rows). Not rendered anywhere in this app —
  // kept in the type only to mirror the real payload shape.
  source: 'keyword' | 'gemini' | null
  updatedAt: string | null
}

export interface IndustryChainGroup {
  coarseGroup: string
  fineCategories: string[]
}

export interface IndustryChainClassification {
  companies: IndustryChainCompany[]
  groups: IndustryChainGroup[]
}

const EMPTY: IndustryChainClassification = { companies: [], groups: [] }

// bff-ts's GET /industries/chain-classification (confirmed live 2026-09-14, pure passthrough of
// analysis-ts's own new endpoint) — replaces useIndustryTree.ts/useIndustryFlatIndex.ts as the
// data source for industries.vue (產業追蹤), per direct request 2026-09-14 ("產業追蹤還是要的，
// 只是接新的API"): same page/feature, migrated off gov-ts's 財政部稅籍行業標準分類 (the old
// 5-level section/division/group/class/subclass tree) onto oingg-playwright-py's Gemini-parsed
// real supply-chain classification (same source GET /stocks/:symbol/peer-group already uses).
//
// Genuinely simpler shape than the old tree/flat pair it replaces: ONE bulk payload (all ~1984
// companies + their category/coarseGroup, plus the 10-group→33-category membership list) instead
// of a lazy per-node tree endpoint + a separate flat search index — this app builds the whole
// browsable tree client-side from this single response (see industries.vue's own buildTree()),
// no server round-trip needed per node expansion anymore.
//
// 271 of 1984 companies have `category: null` (confirmed live) — a real "supply-chain report
// never mentioned this company" state, not filtered out here; industries.vue buckets these into
// their own "尚未分類" tree node rather than silently dropping them from the browse/search
// experience. confidence/sampleSize/updatedAt mirror useStockBadges.ts's own per-badge fields
// (same underlying company_category_summary cache, same "loaded once at server startup, no
// scheduled refresh" caveat analysis-ts flagged — don't word any freshness UI as real-time sync).
const inFlight = { current: null as Promise<IndustryChainClassification> | null }

export function useIndustryChainClassification() {
  const config = useRuntimeConfig()
  const cache = useState<IndustryChainClassification | null>('industry-chain-classification-cache', () => null)
  const pending = ref(false)

  async function fetchClassification(): Promise<IndustryChainClassification> {
    try {
      return await $fetch<IndustryChainClassification>('/industries/chain-classification', {
        baseURL: config.public.apiBase,
        timeout: 20_000
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[industry-chain-classification] GET ${config.public.apiBase}/industries/chain-classification unavailable (${reason})`)
      }
      return EMPTY
    } finally {
      inFlight.current = null
    }
  }

  async function ensureLoaded(): Promise<IndustryChainClassification> {
    if (cache.value) return cache.value
    pending.value = true
    try {
      let request = inFlight.current
      if (!request) {
        request = fetchClassification()
        inFlight.current = request
      }
      const result = await request
      cache.value = result
      return result
    } finally {
      pending.value = false
    }
  }

  return { ensureLoaded, pending }
}
