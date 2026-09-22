// Response shapes of the /api/hub/* routes (server/api/hub/*.get.ts) and the datasets behind
// them (server/utils/hub-data.ts) — the market-wide pages added in the 2026-09-19 SEO build
// (個股總表 /stock, 類股頁 /industry/…, 排行 /rank/…, 條件說明 /screener/…, 指標說明 /metrics/…).

export interface HubSector {
  code: string
  name: string
  slug: string
  // bff-ts's own catalog count for the sector (GET /industries/securities-sectors).
  companyCount: number
}

export interface DirectoryCompany {
  symbol: string
  name: string
  market: 'TWSE' | 'TPEx' | null
}

export interface DirectorySector extends HubSector {
  companies: DirectoryCompany[]
}

// /api/hub/directory — every four-digit listed symbol grouped by 證交所類股 from GET /stocks'
// sectorCode (2026-09-19); `others` are the ~51 symbols bff-ts lists under a non-industry code.
export interface MarketDirectory {
  sectors: DirectorySector[]
  others: DirectoryCompany[]
  total: number
}

// One row of a sector's company table — POST /screener columns parsed to numbers on the server
// (bff-ts sends every value as a string), null when the value or the whole cell is missing.
export interface SectorCompanyRow {
  symbol: string
  name: string
  price: number | null
  peRatio: number | null
  pbRatio: number | null
  dividendYield: number | null
  roe: number | null
  eps: number | null
  debtRatio: number | null
}

export interface SectorStat {
  // Number of rows with a value.
  count: number
  median: number | null
  q1: number | null
  q3: number | null
}

export interface SectorCompanies {
  code: string
  rows: SectorCompanyRow[]
  stats: {
    peRatio: SectorStat
    pbRatio: SectorStat
    dividendYield: SectorStat
    roe: SectorStat
  }
  // Latest knowledgeDate among the daily (EOD/price) cells — the "as of" date of the table.
  quoteDate: string | null
  // Latest knowledgeDate among the fundamental (TTM/Q) cells.
  fundamentalsDate: string | null
}

// /api/hub/industry/:code — the sector's table plus the directory members that have no
// screener row yet (listed, but no financial metrics on this site).
export interface IndustryPageData {
  sector: HubSector
  companies: SectorCompanies
  unranked: DirectoryCompany[]
}

export interface RankingRow {
  rank: number
  symbol: string
  name: string
  value: number | null
  knowledgeDate: string | null
}

// /api/hub/rank/:slug — GET /screener/ranking (limit ≤ 50) for one RANK_PAGES entry.
export interface RankingPageData {
  slug: string
  field: string
  direction: 'asc' | 'desc'
  metricName: string
  fieldName: string
  unit: string | null
  rows: RankingRow[]
  // Latest knowledgeDate among the rows.
  asOf: string | null
}

export interface ScreenerTemplateFilter {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
}

// GET /screener/templates entry (the app's useScreenerTemplates.ts has the full type; this is
// the subset the hub pages render).
export interface ScreenerTemplateSummary {
  id: string
  name: string
  category: string
  description: string
  tier: 'FREE' | 'PAID'
  status: 'AVAILABLE' | 'PENDING'
  pendingReason: string | null
  filters: ScreenerTemplateFilter[]
  isDefault: boolean
}

export interface ScreenerTemplateWithSlug extends ScreenerTemplateSummary {
  // null when the template's name has no entry in SCREENER_TEMPLATE_SLUGS (no page for it).
  slug: string | null
}

// /macro/policy-rate（政策利率與大盤, 2026-09-21, moved under /macro 2026-09-22）— the first
// market-wide page in this app that is
// about neither a company nor a metric.
//
// It exists as ONE page rather than one per symbol by direct decision（「升降息圖要配合大盤走勢」）,
// and that shape is the whole reason it is worth having: a rate decision is a market-wide event, so
// a per-stock version would have been ~2,600 URLs whose content is 95% identical — the thin-content
// shape this app rejects everywhere else. With 加權指數 as the line, the page's content is unique.
export interface RateCycleEvent {
  // CBC publishes an EFFECTIVE date only, never the decision date（the 理監事會 meets the day
  // before by convention）— gov-ts confirmed they hold no decision date and deliberately don't
  // derive one. The chart and the table both label this as 生效日 for that reason: inferring
  // 決議日 = effectiveDate − 1 would be this app inventing a fact.
  effectiveDate: string
  // 重貼現率 — the policy rate「升息半碼」refers to. The other two are carried through because the
  // upstream row has them and a reader comparing with a news report may want them.
  discountRate: number
  collateralAccommodationRate: number
  unsecuredAccommodationRate: number
  // Change in the DISCOUNT rate against the previous decision, in basis points（12.5 = 半碼）.
  // null only on the very first row of the whole series（1989-04-01, nothing before it）.
  changeBp: number | null
}

export interface TaiexPoint {
  // NOT guaranteed to be a weekday: Taiwan had Saturday trading sessions in 1999–2000, so the
  // monthly series opens on 1999-01-30, a Saturday（flagged by analysis-ts, verified in the live
  // response）. Nothing here may assume a Mon–Fri date.
  tradeDate: string
  // bff-ts serialises every market-domain price as a STRING（their Decimal convention, documented
  // on TaiexDailyPriceEntry）— parsed once in the server route so no page has to remember.
  close: number
}

export interface RateCyclePageData {
  events: RateCycleEvent[]
  taiex: TaiexPoint[]
  // Which aggregation the index series came back at — stated on the page rather than assumed,
  // since the same endpoint serves daily/weekly/monthly off one parameter.
  interval: 'daily' | 'weekly' | 'monthly'
}

// /macro/market-events — the index alone. The EVENTS are static frontend data
// (shared/utils/market-events.ts), unlike every other page in this zone where both halves come
// from upstream; that asymmetry is the whole reason that file carries a written inclusion rule.
export interface MarketEventMonth {
  // 'YYYY-MM'.
  period: string
  // 加權股價指數的月平均 — the mean of that month's daily closes, NOT the month-end close, and the
  // two must never be stitched into one line. Same index and same base period as
  // /market/taiex-daily-price（證交所編製, 1966 年平均 = 100）; CBC just averages it over the month.
  //
  // Verified rather than taken on trust before this page switched to it: across the 97 months where
  // daily data also exists, the average fell inside that month's daily close min–max every time,
  // 97/97. Over the wider 1999+ overlap it tracks the month-end close to within 14.3% at worst
  //（2000-09, avg 7,069 vs close 6,185）— which is the gap a falling month is supposed to produce,
  // not a discrepancy.
  avgTaiex: number
}

export interface MarketEventDay {
  tradeDate: string
  close: number
}

export interface MarketEventsPageData {
  months: MarketEventMonth[]
  // Daily closes, 2018-07 onwards — /market/taiex-daily-price caps at 2000 rows whatever the
  // interval, so this is as deep as daily goes. Carried for the 市場階段 page's second list: a
  // decline the monthly average halves（COVID: −28.7% daily, −15.2% monthly）only shows up on this
  // series. The two are never merged into one list.
  days: MarketEventDay[]
}

// /macro/{slug}（總經特區, 2026-09-22）— one macro series read against 加權股價指數.
//
// The index is carried on EVERY macro page rather than fetched separately by each: the zone's whole
// premise is「不同指標跟大盤比較」, so the index is not an optional extra, and one cached function
// serving both halves is what keeps the two series' time windows consistent from page to page.
export interface MacroSeriesPoint {
  // 'YYYY-MM' for a monthly series, 'YYYY-Qn' for a quarterly one — analysis-ts builds it upstream
  // rather than leaving every client to assemble (year, month) itself, which was this app's own
  // request: the same assembly done in six places is the same bug in six places.
  period: string
  // Keyed by the series' own field name（signalScore, m1bYoyPercent, …）, since a page may draw one
  // or two of them. null wherever the source has no value — the 1987 monetary rows have no
  // year-on-year figure because nothing precedes them.
  values: Record<string, number | null>
}

export interface MacroPageData {
  slug: string
  series: MacroSeriesPoint[]
  // The index at the same cadence, already reduced to one point per period so a page never has to
  // align two different frequencies itself.
  taiex: { period: string; close: number }[]
}