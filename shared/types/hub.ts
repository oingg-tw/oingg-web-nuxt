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
