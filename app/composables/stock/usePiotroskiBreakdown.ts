export interface PiotroskiBreakdownGroups {
  profitability: {
    positiveRoa: boolean | null
    positiveCfo: boolean | null
    roaImproved: boolean | null
    accrualQuality: boolean | null
  }
  leverageLiquidity: {
    leverageDecreased: boolean | null
    liquidityImproved: boolean | null
    noDilution: boolean | null
  }
  operatingEfficiency: {
    grossMarginImproved: boolean | null
    assetTurnoverImproved: boolean | null
  }
}

// One entry per Piotroski sub-group — requested from analysis-ts 2026-09-11 alongside
// signalLabels below, once the user made the actual reason clear ("因為未來要做多語言，這些還是
// 得到後端 早晚的事"): even the group-level name/summary/detail text describing our own 3-way UI
// split needed a backend home, not just the raw signal data. Modeled as Piotroski-specific
// fields on this endpoint rather than an extension to the shared MetricBadge shape (analysis-ts's
// own call — that type is shared by 12 badges, none of which have a sub-group concept). `key`
// matches PiotroskiBreakdownGroups' own top-level keys 1:1. `denominator` is the real signal
// count for that group (4/3/2).
//
// Still live after the 2026-09-19 remerge (see this file's own top comment) — `name` is now used
// purely as a section header inside the single merged badge's own detail dialog
// (StockGuruBadgeCategoryCard.vue's piotroskiSignalGroups()), not as 3 separate badges' own
// display names anymore.
export interface PiotroskiGroupMetadata {
  key: 'profitability' | 'leverageLiquidity' | 'operatingEfficiency'
  name: string
  nameEn: string
  summary: string
  detail: string
  denominator: number
}

export interface PiotroskiBreakdown {
  symbol: string
  found: boolean
  fiscalYear: number | null
  fiscalQuarter: number | null
  knowledgeDate: string | null
  knowledgeDateIsFallback: boolean | null
  totalScore: number | null
  groups: PiotroskiBreakdownGroups | null
  // Requested from analysis-ts 2026-09-11 ("多語系 跟 資料 都歸後端") — every signal key across
  // all 3 groups (positiveRoa/positiveCfo/.../assetTurnoverImproved) mapped to its own Chinese
  // display label, e.g. `{ positiveRoa: '稅後淨利為正（ROA > 0）' }`. Replaces guru-badges.ts's
  // own former hardcoded PIOTROSKI_SIGNAL_LABELS lookup table — that was real, avoidable
  // duplication (unlike badge name/author, which turned out NOT worth fetching, see that file's
  // own git history): the raw keys/booleans already come from this same endpoint, only their
  // display text was maintained separately. Optional/absent until analysis-ts actually ships
  // it — StockGuruBadgeCategoryCard.vue's piotroskiSignalGroups() falls back to the bare key
  // itself when a label isn't present, same "don't invent text that isn't real" rule as
  // everywhere else.
  signalLabels?: Record<string, string>
  // Both `groupMetadata` and `signalLabels` are STATIC — analysis-ts's own guarantee: they don't
  // vary by symbol/period, and are present even when `found: false`. Used by
  // StockGuruBadgeCategoryCard.vue's piotroskiSignalGroups() as the section headers inside the
  // single merged Piotroski badge's own detail dialog (see this file's own top comment for the
  // 2026-09-19 remerge that changed how this field is consumed, not its shape).
  groupMetadata?: PiotroskiGroupMetadata[]
}

// bff-ts's GET /stocks/:symbol/piotroski-breakdown (confirmed live 2026-09-10, commit dd5ea92) —
// a pure pass-through to analysis-ts's own GET /companies/piotroski-breakdown. Built per direct
// request ("Piotroski F-Score 徽章跟 analysis 喬一下要怎麼拿到9個指標列表顯示" / "我要把她一拆
// 為三") — the 9 individual pass/fail signals behind the aggregate 0-9 score, which analysis-ts
// already computes internally but previously only persisted the summed total.
//
// Originally used by StockGuruBadgeCategoryCard.vue to split Piotroski into 3 separate badges
// (獲利能力/財務韌性/營運周轉); that split was reverted 2026-09-19 per the user's own decision
// ("Piotroski F-Score 依使用者決定合併回「一個指標、一個徽章」") — this endpoint's own shape is
// UNCHANGED by that remerge (analysis-ts's own guarantee), it's just consumed differently now:
// the same 9 signals render as one grouped checklist inside a single badge's detail dialog instead
// of backing 3 separate badges. See guru-badges.ts's own PIOTROSKI_FIELD_ID comment.
// `found: false` (not a 404) means no data for the symbol/period, same convention as this app's
// other per-symbol endpoints. Only ever requests the latest quarter (no year/season params) —
// every other guru badge score on this site is "current" only, no historical browsing.
type CachedBreakdown = PiotroskiBreakdown | null

const inFlight = new Map<string, Promise<CachedBreakdown>>()

export function usePiotroskiBreakdown(symbol: Ref<string | undefined>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedBreakdown>>('piotroski-breakdown-cache', () => ({}))
  const data = ref<PiotroskiBreakdown | null>(null)
  const pending = ref(false)

  async function fetchBreakdown(targetSymbol: string): Promise<CachedBreakdown> {
    try {
      return await $fetch<PiotroskiBreakdown>(`/stocks/${targetSymbol}/piotroski-breakdown`, {
        baseURL: config.public.apiBase,
        retry: 0
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[piotroski-breakdown] GET ${config.public.apiBase}/stocks/${targetSymbol}/piotroski-breakdown unavailable (${reason})`)
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
    let cached: CachedBreakdown
    if (targetSymbol in cache.value) {
      cached = cache.value[targetSymbol] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(targetSymbol)
      if (!request) {
        request = fetchBreakdown(targetSymbol)
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
