export interface IndustryValueChainChild {
  code: string
  name: string
  companyCount: number
}

export type IndustryValueChainMarket = 'listed' | 'otc' | 'rotc'

export interface IndustryValueChainCompany {
  symbol: string
  companyName: string
  market: IndustryValueChainMarket
}

export interface IndustryValueChainNode {
  found: boolean
  code: string | null
  level: 'industry' | 'subChain' | null
  name: string | null
  children: IndustryValueChainChild[]
  companies: IndustryValueChainCompany[]
  dataSource: string
}

const REQUEST_TIMEOUT_MS = 15_000

// Confirmed live with bff-ts 2026-09-09 (commit bde456f on bff-ts's side): GET
// /industries/value-chain?code=xxx, guest-usable, no auth. A COMPLETELY SEPARATE classification
// system from useIndustryTree.ts's own /industries/tree (財政部稅籍 5-level tree, one company =
// one unique path) — this is TPEx's own "產業價值鏈" (dataSource: ic.tpex.org.tw), only 2 levels
// (47 top-level industries → 422 subChains), and critically **a company can belong to MULTIPLE
// subChains at once** (e.g. 台達電 spans 64 of them) — never assume a single path/parent the way
// the tax-registration tree works. Covers all three markets (listed/otc/rotc — TWSE/TPEx/興櫃),
// wider than the tax tree's TWSE-only 999 companies.
//
// Same "give a code, get its children" shape as /industries/tree, just shallower and with a
// different field set — omitting `code` returns the 47 industry-level root children; passing an
// industry code returns its subChain children; passing a subChain code returns children:[] and
// its member companies. Note two real differences from /industries/tree's own shape: children
// here have no `hasChildren` flag (not needed — level alone tells you whether a child is another
// industry-level node or a leaf subChain), and there's no root-level aggregate companyCount, only
// each child's own. An unknown code returns found:false with HTTP 200, same as the tax tree.
//
// bff-ts was explicit there is NO reverse lookup (company → which subChains it's in, the
// /industries/flat equivalent) — a `symbol=` query param is silently ignored, returning the root
// node instead of a real result. Don't build a feature here that assumes one exists; the
// industry-value-chain.vue page this composable feeds was deliberately designed around a single
// selected industry (children + Promise.all over its subChains) specifically because that
// direction needs no reverse lookup at all.
export function useIndustryValueChain() {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, IndustryValueChainNode | null>>('industry-value-chain-cache', () => ({}))
  const data = ref<IndustryValueChainNode | null>(null)
  const pending = ref(false)

  async function load(code?: string): Promise<IndustryValueChainNode | null> {
    const cacheKey = code ?? '__root__'
    if (cacheKey in cache.value) {
      data.value = cache.value[cacheKey]
      return data.value
    }
    pending.value = true
    try {
      const response = await $fetch<IndustryValueChainNode>('/industries/value-chain', {
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
        console.warn(`[industry-value-chain] GET ${config.public.apiBase}/industries/value-chain unavailable (${reason})`)
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
