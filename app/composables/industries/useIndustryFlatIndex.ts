export interface IndustryFlatPathEntry {
  code: string
  level: 'section' | 'division' | 'group' | 'class' | 'subclass'
  name: string
}

export interface IndustryFlatCompany {
  symbol: string
  companyName: string
  path: IndustryFlatPathEntry[]
}

interface IndustryFlatResponse {
  companies: IndustryFlatCompany[]
}

const REQUEST_TIMEOUT_MS = 20_000

// Confirmed live with bff-ts/analysis-ts 2026-09-09 (commit 1a0605c on bff-ts's side): GET
// /industries/flat, no query params, returns all 999 companies at once, each with its full
// 5-level ancestor path (same code/level/name shape as GET /industries/tree's own nodes — see
// useIndustryTree.ts's own comment). Built specifically to support search ("加上 search
// 功能...搜尋 1435...輸入半導體") — /industries/tree alone has no way to look up a company or
// category by name/keyword, only "give a code, get its children." Same 999-company/listed-only
// scope as the tree endpoint. Whole-payload fetch (~380KB) cached for the session rather than
// refetched per keystroke — this is what a search box searches against client-side.
export function useIndustryFlatIndex() {
  const config = useRuntimeConfig()
  const cache = useState<IndustryFlatCompany[] | null>('industry-flat-cache', () => null)
  const pending = ref(false)

  async function ensureLoaded(): Promise<IndustryFlatCompany[]> {
    if (cache.value) return cache.value
    pending.value = true
    try {
      const response = await $fetch<IndustryFlatResponse>('/industries/flat', {
        baseURL: config.public.apiBase,
        method: 'GET',
        timeout: REQUEST_TIMEOUT_MS
      })
      cache.value = response.companies
      return response.companies
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[industry-flat-index] GET ${config.public.apiBase}/industries/flat unavailable (${reason})`)
      }
      cache.value = []
      return []
    } finally {
      pending.value = false
    }
  }

  return { ensureLoaded, pending }
}
