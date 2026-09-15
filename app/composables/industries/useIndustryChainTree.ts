// Field names confirmed live 2026-09-15 (real bug found: assumed {code,name} matching
// chain-clusters' own member shape without checking, produced "undefined　undefined" for every
// company row — this endpoint actually uses {symbol,companyName}, a different shape from
// chain-clusters' IndustryClusterMember despite both being "a company in a tree leaf").
export interface IndustryTreeMember {
  symbol: string
  companyName: string
}

export type IndustryTreeNodeType = 'coarse_group' | 'category' | 'segment' | 'misc'

export interface IndustryTreeNode {
  nodeId: string
  nodeType: IndustryTreeNodeType
  label: string
  depth: number
  // Total company count including all descendants, not just this node's own direct members.
  size: number
  children: IndustryTreeNode[]
  // Only ever populated on a node with no children (a real leaf) — but per playwright-py's own
  // explicit warning, 'misc' nodes are NOT guaranteed to be leaves (a long-tail bucket can itself
  // get sub-divided further), so callers must branch on whether `children` is non-empty, never on
  // `nodeType === 'misc'`. All-Taiwan-listed only (unlike chain-clusters' members, which include
  // ~5,654 international non-listed nodes) — no `isListed` field needed here.
  members: IndustryTreeMember[]
}

export interface IndustryChainTree {
  roots: IndustryTreeNode[]
}

const EMPTY: IndustryChainTree = { roots: [] }

// bff-ts's GET /industries/chain-tree (confirmed live 2026-09-15, pure passthrough of
// analysis-ts's own endpoint over oingg-playwright-py's rebuilt browse-oriented classification
// tree) — replaces useIndustryChainClassification.ts as industries.vue's own 分類 tab data
// source (confirmed with bff-ts/analysis-ts: chain-classification itself is NOT retired, it
// stays live for GET /stocks/:symbol/peer-group and per-company industry-tag display elsewhere;
// this is purely an ADDITIONAL, more browse-friendly tree shape, the two coexist and this
// composable's own caller does not touch chain-classification's data at all anymore).
//
// Built specifically to solve the "one category flattening 99 companies at one level" problem
// the flat classification tree had: every level fans out to ≤10 children and every genuine leaf
// caps at ≤20 companies (a handful of long-tail 其他 buckets excepted), max depth 4. Confirmed
// live: 11 top-level roots, 273 total nodes, 208 leaves.
//
// CRITICAL: nodeId is NOT a stable identifier (same caveat as chain-clusters' clusterId/
// metaGroup) — it's a path string like "電子零組件與半導體/積體電路/0/0" that reshuffles whenever
// analysis-ts rebuilds the tree. Never persist it in a URL, bookmark, share link, or any cache
// keyed by its literal value across requests.
const inFlight = { current: null as Promise<IndustryChainTree> | null }

export function useIndustryChainTree() {
  const config = useRuntimeConfig()
  const cache = useState<IndustryChainTree | null>('industry-chain-tree-cache', () => null)
  const pending = ref(false)

  async function fetchTree(): Promise<IndustryChainTree> {
    try {
      return await $fetch<IndustryChainTree>('/industries/chain-tree', {
        baseURL: config.public.apiBase,
        timeout: 20_000
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[industry-chain-tree] GET ${config.public.apiBase}/industries/chain-tree unavailable (${reason})`)
      }
      return EMPTY
    } finally {
      inFlight.current = null
    }
  }

  async function ensureLoaded(): Promise<IndustryChainTree> {
    if (cache.value) return cache.value
    pending.value = true
    try {
      let request = inFlight.current
      if (!request) {
        request = fetchTree()
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
