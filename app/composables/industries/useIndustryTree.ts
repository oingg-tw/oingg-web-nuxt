export type IndustryTreeLevel = 'section' | 'division' | 'group' | 'class' | 'subclass'

export interface IndustryTreeChild {
  code: string
  level: IndustryTreeLevel
  name: string
  companyCount: number
  hasChildren: boolean
}

export interface IndustryTreeCompany {
  symbol: string
  companyName: string
}

export interface IndustryTreeNode {
  found: boolean
  code: string | null
  level: IndustryTreeLevel | null
  name: string | null
  companyCount: number
  children: IndustryTreeChild[]
  companies: IndustryTreeCompany[]
}

const REQUEST_TIMEOUT_MS = 15_000

// Confirmed live with bff-ts 2026-09-09: GET /industries/tree?code=xxx, guest-usable, no auth.
// Omitting `code` returns the 19 top-level "section" nodes (root has code/level/name: null).
// Drilling down follows section (1 letter, e.g. "A") → division (2 digits) → group (3 digits) →
// class (4 digits) → subclass (e.g. "0119-99") — 5 levels total. `companies` is only ever
// non-empty at the subclass leaf (bff-ts's own design: avoids the same company appearing under
// every one of its ancestor levels); every other level's `children` array is what to drill into
// next. `hasChildren` reflects the classification DICTIONARY, not whether companyCount is
// currently non-zero — many real nodes have hasChildren:true with companyCount:0 (a valid
// category with no company currently registered under it, not a bug). An unknown `code` returns
// HTTP 200 with found:false, never a 404.
//
// This is a COMPLETELY DIFFERENT classification system from companyProfile.industry/
// industryName (TWSE's own single-level ~30-category exchange classification, e.g. 2330 is
// industry "24"/半導體業) — this tree is gov-ts's tax-registration industry classification
// (5-level hierarchy, alphanumeric codes, scoped to the 999 companies with a Taiwan tax
// registration; KY/foreign-registered companies aren't classifiable here at all). Never assume
// the two code systems convert into each other or can be merged/displayed together.
export function useIndustryTree() {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, IndustryTreeNode | null>>('industry-tree-cache', () => ({}))
  const data = ref<IndustryTreeNode | null>(null)
  const pending = ref(false)

  // Returns the fetched node directly (not just via the shared `data` ref) — the el-tree lazy
  // `load` callback may have several node expansions in flight at once (e.g. the user expands
  // two different branches before the first finishes), and each would otherwise race to
  // overwrite the same shared `data.value` between its own await and read. `data`/`pending`
  // stay for industries.vue's own non-tree (breadcrumb drill-down) usage, which only ever has
  // one fetch in flight at a time.
  async function load(code?: string): Promise<IndustryTreeNode | null> {
    const cacheKey = code ?? '__root__'
    if (cacheKey in cache.value) {
      data.value = cache.value[cacheKey]
      return data.value
    }
    pending.value = true
    try {
      const response = await $fetch<IndustryTreeNode>('/industries/tree', {
        baseURL: config.public.apiBase,
        method: 'GET',
        query: code ? { code } : undefined,
        timeout: REQUEST_TIMEOUT_MS
      })
      cache.value[cacheKey] = response
      data.value = response
      return response
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[industry-tree] GET ${config.public.apiBase}/industries/tree unavailable (${reason})`)
      }
      cache.value[cacheKey] = null
      data.value = null
      return null
    } finally {
      pending.value = false
    }
  }

  return { data, pending, load }
}
