// Field set per conductor's 特別股專區.md/特別股個股瀏覽.md's six contract dimensions
// (股息累積性/股息參與權/清算優先倍數/清算優先權/贖回條款/投資人賣回權) plus YTW/YTC and a
// derived 溢價率/負凸性警示 pair. Every field is nullable — wired to bff-ts's real
// GET /stocks/preferred-stocks, which only covers roughly half of this shape:
// - Real: price (no daily change field exists — no `change`/`changePercent` in this type at
//   all, rather than showing a fake 0.00), dividendRate, currentYield (a genuine metric,
//   distinct from YTW), ytw/ytc/negativeConvexityWarning (analysis-ts's 特別股指標計算引擎,
//   confirmed live 2026-09-07 — see ytc's own comment for the ytcAssumption caveat),
//   dividendType, participation, hasLiquidationPreference (bool presence only — analysis-ts
//   doesn't expose the actual multiple), redemptionDate/redemptionConditions. analysis-ts
//   sampled real redemption_conditions text on 2026-09-06 and found it consistently phrased as
//   the ISSUER's call right ("本公司得...收回"); mops-ts (the raw-data owner) confirmed
//   2026-09-07 this is MOPS's「是否收回」/「收回條件」field pair — generic free text with NO
//   structural guarantee of who holds the right, not every record necessarily an issuer call.
//   Per mops-ts's own recommendation, this app doesn't label the UI "發行人贖回權" — shown as
//   neutral "贖回條款", letting the raw redemptionConditions text speak for itself. mops-ts's
//   source table has no put-right field at all — a genuine data-source gap for `putable`, not
//   something bff-ts missed.
// - Not available anywhere yet, always null from real data: liquidationPreferenceMultiple (the
//   "1x/2x" badge the doc describes — only presence is known, not magnitude),
//   liquidationPriority, putable, and all four solvency ratios (would need
//   GET /companies/financial-statement, a different endpoint bff-ts hasn't aggregated here).
//   callPrice removed entirely 2026-09-07 (was always null — redemptionConditions is free text
//   like "按實際發行價格收回", parsing a number out of arbitrary legal wording is exactly the
//   kind of fragile guess this app avoids) once premiumRate/hasNegativeConvexityWarning in
//   preferred-stock-metrics.ts stopped depending on it — see that file's own comment.
// null renders as "尚未提供" in the consuming pages, never a fabricated number or guessed badge.
export interface PreferredStock {
  code: string
  name: string
  price: number | null
  priceDate: string | null
  dividendRate: number | null // 股息率 — 票面年股息 ÷ 面額
  currentYield: number | null // 參考殖利率 — 股息率換算成現價的實際殖利率，非 YTW
  ytw: number | null // 最差殖利率 (Yield to Worst) — 持有至到期 vs 首個贖回日買回，取較低者
  ytc: number | null // 贖回殖利率 (Yield to Call) — 見 ytcAssumption 的關鍵前提差異
  // 'scheduled_redemption_date'：贖回日還沒到，ytc 是對一個真實排定時點的試算。
  // 'past_redemption_date_assumed_next_period'：贖回日已過但發行人尚未動作（analysis-ts 實測
  // 26 檔可贖回特別股裡 14 檔／54% 屬於這種狀態），ytc 改用「假設下一次配息後即被贖回」的簡化
  // 情境試算，不是真實排定的贖回時間——UI 顯示時必須額外提示，避免使用者誤以為是精確預測。
  ytcAssumption: 'scheduled_redemption_date' | 'past_redemption_date_assumed_next_period' | null
  dividendType: 'cumulative' | 'non-cumulative' | null
  participation: 'participating' | 'non-participating' | null
  issuePrice: number | null // 發行價 — 多數贖回條款寫的「按實際發行價格收回」即指這個金額
  issueDate: string | null
  // 較發行價漲跌 (現價－發行價) — 後端計算後提供的欄位，前端只負責呈現，不在這裡自行相減
  // （直接請 bff-ts/analysis-ts 加這個欄位，2026-09-06，回覆前先以 null／"尚未提供" 呈現）。
  priceMinusIssuePrice: number | null
  // 僅知道有/無清算優先權時 liquidationPreferenceMultiple 為 null，hasLiquidationPreference
  // 才是真正確認過的欄位。
  liquidationPreferenceMultiple: number | null
  hasLiquidationPreference: boolean | null
  liquidationPriority: string | null
  putable: boolean | null
  // Named to match the source field directly (redemptionDate, per direct request "能直接用來源
  // 的變數就直接用 redemptionDate") — not renamed to callDate here.
  redemptionDate: string | null
  redemptionConditions: string | null
  // analysis-ts's own computed field (confirmed live 2026-09-07): true when current price is
  // >2% above issue price. See preferred-stock-metrics.ts's premiumRate() for the matching
  // (issuePrice-based, not a separate callPrice) derivation of the actual percentage to display
  // alongside this boolean.
  negativeConvexityWarning: boolean | null
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
  redeemable: boolean
  redemptionDate: string | null
  redemptionConditions: string | null
  // bff-ts's own computed field (confirmed live 2026-09-06) — latestClosePrice - issuePrice,
  // rounded to 2dp; null whenever latestClosePrice is null. Deliberately kept backend-computed
  // per direct request even though it's arithmetic over two fields already in this same
  // response — bff-ts raised that point directly, user confirmed centralizing derived metrics
  // backend-side is the intended architecture, not an oversight.
  priceMinusIssuePrice: number | null
  // analysis-ts's own field (confirmed live 2026-09-06, sign convention fixed same day —
  // now = 發行價 - 現價, symmetric with priceMinusIssuePrice). Not read anywhere below —
  // priceMinusIssuePrice already covers 較發行價漲跌／贖回機會(風險), no need for both.
  // callProtectionYears (贖回保護期年數) was added and removed same day — analysis-ts decided
  // redemptionDate + redemptionConditions together already convey this, no separate parsed-
  // years field needed.
  callRiskAmount: number | null
  // analysis-ts's 特別股指標計算引擎 fields, confirmed live 2026-09-07 — see PreferredStock's
  // own ytc/negativeConvexityWarning comments for the ytcAssumption caveat and the >2%
  // issue-price-premium threshold respectively.
  ytwPct: number | null
  ytcPct: number | null
  ytcAssumption: 'scheduled_redemption_date' | 'past_redemption_date_assumed_next_period' | null
  negativeConvexityWarning: boolean | null
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
    ytc: entry.ytcPct,
    ytcAssumption: entry.ytcAssumption,
    dividendType: entry.cumulativeDividend ? 'cumulative' : 'non-cumulative',
    participation: entry.participatingExcessDividend ? 'participating' : 'non-participating',
    issuePrice: entry.issuePrice,
    issueDate: entry.issueDate,
    priceMinusIssuePrice: entry.priceMinusIssuePrice,
    liquidationPreferenceMultiple: null,
    hasLiquidationPreference: entry.liquidationPreference,
    liquidationPriority: null,
    putable: null,
    redemptionDate: entry.redemptionDate,
    redemptionConditions: entry.redemptionConditions,
    negativeConvexityWarning: entry.negativeConvexityWarning,
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
