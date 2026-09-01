// Confirmed live with bff-ts 2026-09-01: GET /market/volume-top20 — 成交量前20, no params,
// TWSE+TPEx merged. Deliberately does NOT exclude ETFs, unlike this app's other rankings.
// TPEx rows lack transaction/open/high/low/close/dir/change (null, not a query failure —
// TPEx's own data source just doesn't have them). Every ranking value is a string.
export interface VolumeTop20Row {
  rank: number
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  volume: string
  transaction: string | null
  open: string | null
  high: string | null
  low: string | null
  close: string | null
  dir: string | null
  change: string | null
}

export interface VolumeTop20 {
  tradeDate: string
  rankings: VolumeTop20Row[]
}

const FALLBACK: VolumeTop20 = { tradeDate: '', rankings: [] }

export function useVolumeTop20() {
  const config = useRuntimeConfig()

  return useAsyncData<VolumeTop20>(
    'volume-top20',
    async () => {
      try {
        return await $fetch<VolumeTop20>('/market/volume-top20', { baseURL: config.public.apiBase })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[volume-top20] GET ${config.public.apiBase}/market/volume-top20 unavailable (${reason}), using fallback instead`)
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
