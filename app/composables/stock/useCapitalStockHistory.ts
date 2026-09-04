import type { Stock } from '~/composables/stock/useStocks'

export type CapitalStockChangeSource = 'cashIncrease' | 'capitalReserveTransfer' | 'retainedEarningsTransfer' | 'mergerIncrease' | 'capitalReduction'

export interface CapitalStockEntry {
  effectiveDate: string
  paidInShares: bigint | null
  paidInCapital: bigint | null
  // Only whichever of the five structured sources was non-zero for this entry, plus the raw
  // `other` text — never assume exactly one is set, analysis-ts's own five-flag shape allows
  // more than one on the same entry (e.g. a merger that also involved a cash component).
  changeSources: { source: CapitalStockChangeSource; amount: bigint }[]
  other: string | null
  // 庫藏股/可轉債轉換 have no structured field on this endpoint (confirmed with analysis-ts
  // 2026-09-04) — they only ever show up as free text in here, e.g. "註銷庫藏股3,249,000股".
  // Show this verbatim when present rather than trying to parse an amount out of it.
  remarks: string | null
}

const CHANGE_SOURCE_KEYS: { key: string; source: CapitalStockChangeSource }[] = [
  { key: 'cashIncrease', source: 'cashIncrease' },
  { key: 'capitalReserveTransfer', source: 'capitalReserveTransfer' },
  { key: 'retainedEarningsTransfer', source: 'retainedEarningsTransfer' },
  { key: 'mergerIncrease', source: 'mergerIncrease' },
  { key: 'capitalReduction', source: 'capitalReduction' }
]

export const CHANGE_SOURCE_LABELS: Record<CapitalStockChangeSource, string> = {
  cashIncrease: '現金增資',
  capitalReserveTransfer: '資本公積轉增資',
  retainedEarningsTransfer: '盈餘轉增資',
  mergerIncrease: '合併增資',
  capitalReduction: '減資'
}

function toBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return BigInt(value as string | number)
  } catch {
    return null
  }
}

function hydrateEntry(raw: Record<string, unknown>): CapitalStockEntry {
  const changeSource = (raw.changeSource ?? {}) as Record<string, unknown>
  const changeSources = CHANGE_SOURCE_KEYS.map(({ key, source }) => ({ source, amount: toBigInt(changeSource[key]) }))
    .filter((entry): entry is { source: CapitalStockChangeSource; amount: bigint } => entry.amount !== null && entry.amount !== 0n)

  return {
    effectiveDate: String(raw.effectiveDate),
    paidInShares: toBigInt(raw.paidInShares),
    paidInCapital: toBigInt(raw.paidInCapital),
    changeSources,
    other: (changeSource.other as string | null) ?? null,
    remarks: (raw.remarks as string | null) ?? null
  }
}

// GET /stocks/{symbol}/capital-stock-history — bff-ts's own forwarding route onto
// analysis-ts's endpoint (analysis-ts's own path was /companies/capital-stock-history?symbol=,
// but that's not what's reachable through bff-ts, which every request here has to go through —
// same path convention as useCompanyProfile.ts's /stocks/{symbol}/profile). Confirmed live and
// tested against 2330 by both analysis-ts and bff-ts, 2026-09-04. Entries come back newest-
// first; this re-sorts oldest-first since every chart on this page reads left-to-right
// chronologically.
//
// Returns null on a failed request (unreachable backend, unexpected shape) vs. a real `[]` on
// a genuine 200 with `entries: []` (a company that's simply never changed its capital) —
// deliberately NOT collapsed into one "nothing to show" case, since stock/[code].vue needs to
// tell "this endpoint isn't answering, show the structural shell" apart from "it answered:
// there's really no history, show that as a real, informative empty state" (see
// StockShareCapitalChart's own empty-state message).
export function useCapitalStockHistory(stock: Ref<Stock | undefined>) {
  const config = useRuntimeConfig()

  return useAsyncData<CapitalStockEntry[] | null>(
    () => `capital-stock-history-${stock.value?.code ?? 'none'}`,
    async () => {
      const current = stock.value
      if (!current) return null

      try {
        const raw = await $fetch<{ symbol: string; entries: Record<string, unknown>[] }>(`/stocks/${current.code}/capital-stock-history`, {
          baseURL: config.public.apiBase
        })
        return raw.entries.map(hydrateEntry).reverse()
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[capital-stock-history] GET ${config.public.apiBase}/stocks/${current.code}/capital-stock-history unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [stock], default: () => null }
  )
}
