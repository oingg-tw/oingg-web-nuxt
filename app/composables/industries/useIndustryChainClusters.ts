export interface IndustryClusterMember {
  code: string
  name: string
  // false = an international/unlisted supply-chain node (e.g. Apple, Nvidia, or any company
  // with no stock-detail page on this site) — confirmed live: ~5,654 of ~7,566 total nodes are
  // non-Taiwan-listed. Callers must check this before treating `code` as a real stock symbol
  // (e.g. before linking to /stock/:code) — a non-listed node's `code` is whatever internal
  // identifier the supply-chain graph assigned it, not a real TWSE/TPEx symbol.
  isListed: boolean
}

export interface IndustryCluster {
  clusterId: string | number
  label: string
  // Human-browsable top grouping added 2026-09-15 (bff-ts passthrough of analysis-ts's own new
  // metaGroup column) — collapses the 233 flat clusters into 17 groups per direct request from
  // playwright-py after re-evaluating "does the tree technically survive 233 flat root nodes"
  // (yes) vs "is that still a lot to browse without searching" (also yes, by actual HCI decision
  // theory they cited, not just a guess) — see industries.vue's own buildClusterTree() comment
  // for how the 3-level tree is assembled. Distribution is intentionally lopsided (one group,
  // 積體電路為主的跨產業樞紐群, holds 177 of 233 clusters) — confirmed by playwright-py as a real
  // reflection of how densely interconnected Taiwan's electronics/semiconductor supply chain is
  // vs every other industry, not a clustering bug. Nullable in the type even though 0/233 are
  // currently null (confirmed live) — bucketed the same defensive way as
  // useIndustryChainClassification.ts's own `category: null` handling, never assumed permanent.
  metaGroup: string | null
  directMembers: IndustryClusterMember[]
}

export interface IndustryChainClusters {
  clusters: IndustryCluster[]
}

const EMPTY: IndustryChainClusters = { clusters: [] }

// bff-ts's GET /industries/chain-clusters (confirmed live 2026-09-14, pure passthrough of
// analysis-ts's own endpoint over oingg-playwright-py's Louvain/dendrogram community-detected
// supply-chain clusters) — a SEPARATE, independent grouping from GET /industries/chain-
// classification (see useIndustryChainClassification.ts): that one is "same product category,"
// this one is "these companies actually trade with each other on the real supply-chain graph."
// Both stay live side by side in industries.vue as two tabs, neither replaces the other.
//
// Flattened to a single layer 2026-09-15 (playwright-py switched clustering to auto-adjusted
// resolution and dropped the sub-cluster level entirely — confirmed live: subClusters is now
// guaranteed empty, not just "may be empty," since sub_cluster_id is set to NULL for everything
// now) — the old `subClusters: IndustryClusterSubCluster[]` field and its type are removed
// rather than kept as a permanently-empty array; ~326 top-level clusters (20-90 members each)
// now sit directly under `directMembers`.
//
// CRITICAL: clusterId is NOT a stable identifier. Confirmed live to have reshuffled multiple
// times the same day this was integrated, the last time from a real underlying data-correction,
// not just a re-clustering — never persist it in a URL, bookmark, share link, or any cache keyed
// by its literal value across requests. This composable's own cache is fine (session-scoped,
// always a fresh fetch on reload), but nothing downstream may assume today's clusterId still
// means the same thing tomorrow.
//
// No scheduled refresh assumption either way has been confirmed for this endpoint specifically —
// treat it the same as every other analysis-ts cache here (loaded once at their server startup)
// unless told otherwise.
const inFlight = { current: null as Promise<IndustryChainClusters> | null }

export function useIndustryChainClusters() {
  const config = useRuntimeConfig()
  const cache = useState<IndustryChainClusters | null>('industry-chain-clusters-cache', () => null)
  const pending = ref(false)

  async function fetchClusters(): Promise<IndustryChainClusters> {
    try {
      return await $fetch<IndustryChainClusters>('/industries/chain-clusters', {
        baseURL: config.public.apiBase,
        timeout: 20_000
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[industry-chain-clusters] GET ${config.public.apiBase}/industries/chain-clusters unavailable (${reason})`)
      }
      return EMPTY
    } finally {
      inFlight.current = null
    }
  }

  async function ensureLoaded(): Promise<IndustryChainClusters> {
    if (cache.value) return cache.value
    pending.value = true
    try {
      let request = inFlight.current
      if (!request) {
        request = fetchClusters()
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
