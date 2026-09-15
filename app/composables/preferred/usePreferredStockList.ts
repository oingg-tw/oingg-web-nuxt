// Field set per conductor's 特別股專區.md/特別股個股瀏覽.md's six contract dimensions
// (股息累積性/股息參與權/清算優先倍數/清算優先權/贖回條款/投資人賣回權) plus YTW and a
// derived 溢價率/負凸性警示 pair. Every field is nullable — wired to bff-ts's real
// GET /stocks/preferred-stocks, which only covers roughly half of this shape:
// - Real: price (no daily change field exists — no `change`/`changePercent` in this type at
//   all, rather than showing a fake 0.00), dividendRate, currentYield (a genuine metric,
//   distinct from YTW), ytw (analysis-ts's 特別股指標計算引擎, confirmed live 2026-09-07),
//   dividendType, participation, hasLiquidationPreference (bool presence only — analysis-ts
//   doesn't expose the actual multiple).
// - Not available anywhere yet, always null from real data: liquidationPreferenceMultiple (the
//   "1x/2x" badge the doc describes — only presence is known, not magnitude),
//   liquidationPriority, putable, and all four solvency ratios (would need
//   GET /companies/financial-statement, a different endpoint bff-ts hasn't aggregated here).
//   callPrice removed entirely 2026-09-07 (was always null — redemptionConditions is free text
//   like "按實際發行價格收回", parsing a number out of arbitrary legal wording is exactly the
//   kind of fragile guess this app avoids) once premiumRate/hasNegativeConvexityWarning in
//   preferred-stock-metrics.ts stopped depending on it — see that file's own comment.
// - redeemable/redemptionDate/redemptionConditions/ytc/ytcAssumption REMOVED entirely
//   2026-09-14 — mops-ts dropped the preferredStock domain's redemption tables
//   (PreferredStockRights/PreferredStockRedemptionOverride/PreferredStockIssuer/
//   PreferredStockSyncStatus), an unofficial-MOPS-endpoint data source with no official
//   replacement found in their 2026-09-13 sourcing audit; analysis-ts confirmed
//   GET /stocks/preferred-stocks itself stays healthy, but these specific fields come back null
//   going forward for every symbol. Removed from both this type and the pages that read it (see
//   preferred-stocks/index.vue and preferred-stocks/[code].vue's own top comments) rather than
//   left as permanently-null dead fields.
// null renders as "尚未提供" in the consuming pages, never a fabricated number or guessed badge.
export interface PreferredStock {
  code: string
  name: string
  price: number | null
  priceDate: string | null
  // Labels corrected 2026-09-08 per analysis-ts's own terminology review: 股息率 conventionally
  // means a yield (計算基礎是現價), not this fixed issue-price-based rate, so this is now
  // labeled 票面利率 (nominal/coupon rate) in both pages instead — the old label risked being
  // read backwards against 殖利率 below.
  dividendRate: number | null // 票面利率 — 票面年股息 ÷ 面額，發行時基準，不隨股價變動
  // "參考" was a non-standard qualifier implying a rough estimate — this is a standard yield
  // calculation (dividendRate ÷ 現價), so it's now just 殖利率 in both pages, per the same
  // terminology review.
  currentYield: number | null // 殖利率 — 股息率換算成現價的實際殖利率，非 YTW
  ytw: number | null // 最差殖利率 (Yield to Worst) — 持有至到期 vs 首個贖回日買回，取較低者
  dividendType: 'cumulative' | 'non-cumulative' | null
  participation: 'participating' | 'non-participating' | null
  issuePrice: number | null // 發行價 — 多數贖回條款寫的「按實際發行價格收回」即指這個金額
  issueDate: string | null
  // 僅知道有/無清算優先權時 liquidationPreferenceMultiple 為 null，hasLiquidationPreference
  // 才是真正確認過的欄位。
  liquidationPreferenceMultiple: number | null
  hasLiquidationPreference: boolean | null
  liquidationPriority: string | null
  putable: boolean | null
  // analysis-ts's own native field (confirmed live 2026-09-08 — replaced their earlier
  // negativeConvexityWarning boolean, which was just this same percentage pre-thresholded at
  // 2% server-side; analysis-ts's own reasoning: the frontend already computed this percentage
  // itself for 溢價率, so exposing both a raw number AND a boolean derived from the identical
  // formula was redundant). preferred-stock-metrics.ts's premiumRate()/
  // hasNegativeConvexityWarning() both read this directly now — no more separate
  // priceMinusIssuePrice division on this end, and the 2%-or-not threshold decision moved
  // client-side per analysis-ts's own note that this app owns that call now.
  premiumRatePct: number | null
  interestCoverage: number | null // 利息保障倍數（倍）
  debtRatio: number | null // 資產負債率（%）
  currentRatio: number | null // 流動比率（%）
  netDebtToEbitda: number | null // 淨負債對 EBITDA 比（倍）— 負值代表淨現金部位
}

// bff-ts's real GET /stocks/preferred-stocks (confirmed live 2026-09-06, relayed from
// analysis-ts) — raw shape, before mapping to PreferredStock above.
interface PreferredStockEntry {
  symbol: string
  name: string
  isinCode: string
  listedDate: string
  marketType: string
  issueDate: string
  issuePrice: number
  dividendRate: number
  nominalDividendRatePct: number
  currentYieldPct: number
  latestClosePrice: number
  latestPriceDate: string
  cumulativeDividend: boolean
  participatingExcessDividend: boolean
  liquidationPreference: boolean
  votingRights: boolean
  convertible: boolean
  conversionStartDate: string | null
  // analysis-ts's 特別股指標計算引擎 field, confirmed live 2026-09-07.
  ytwPct: number | null
  // bff-ts/analysis-ts breaking change 2026-09-08: `priceMinusIssuePrice` (bff-ts's own
  // backend-computed latestClosePrice-issuePrice arithmetic) and `callRiskAmount` (analysis-ts's
  // never-read symmetric counterpart) were both removed under a new "proxy endpoints must be
  // pure passthrough, no derived arithmetic" rule — a self-computed number a client can't trace
  // back to its own source is exactly the kind of thing bff-ts decided its own proxies shouldn't
  // manufacture. `negativeConvexityWarning` (boolean) was replaced by `premiumRatePct` (the raw
  // percentage) for the same reason in spirit — see PreferredStock's own premiumRatePct comment.
  premiumRatePct: number | null
}

interface PreferredStockListResponse {
  entries: PreferredStockEntry[]
}

function mapEntry(entry: PreferredStockEntry): PreferredStock {
  return {
    code: entry.symbol,
    name: entry.name,
    price: entry.latestClosePrice,
    priceDate: entry.latestPriceDate,
    dividendRate: entry.nominalDividendRatePct,
    currentYield: entry.currentYieldPct,
    ytw: entry.ytwPct,
    dividendType: entry.cumulativeDividend ? 'cumulative' : 'non-cumulative',
    participation: entry.participatingExcessDividend ? 'participating' : 'non-participating',
    issuePrice: entry.issuePrice,
    issueDate: entry.issueDate,
    liquidationPreferenceMultiple: null,
    hasLiquidationPreference: entry.liquidationPreference,
    liquidationPriority: null,
    putable: null,
    premiumRatePct: entry.premiumRatePct,
    interestCoverage: null,
    debtRatio: null,
    currentRatio: null,
    netDebtToEbitda: null
  }
}

// No fixture fallback anymore (per direct request "把假資料特別股拿掉，資料還在加載中就用loader
// 呈現") — a fetch failure now returns an empty list rather than hand-picked fixture entries
// that could be mistaken for real quotes; consuming pages show a loading state via this
// composable's own `pending` while the real fetch is in flight instead.
export function usePreferredStockList() {
  const config = useRuntimeConfig()

  return useAsyncData<PreferredStock[]>(
    'preferred-stock-list',
    async () => {
      try {
        const response = await $fetch<PreferredStockListResponse>('/stocks/preferred-stocks', {
          baseURL: config.public.apiBase
        })
        return response.entries.map(mapEntry)
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[preferred-stocks] GET ${config.public.apiBase}/stocks/preferred-stocks unavailable (${reason})`)
        }
        return []
      }
    },
    { default: () => [], lazy: true, server: false }
  )
}

export function getPreferredStockFromList(list: PreferredStock[], code: string): PreferredStock | undefined {
  return list.find(stock => stock.code === code)
}
