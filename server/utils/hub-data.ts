import type { DirectoryCompany, DirectorySector, HubSector, MarketDirectory, RankingPageData, RankingRow, RateCycleEvent, RateCyclePageData, ScreenerTemplateSummary, ScreenerTemplateWithSlug, SectorCompanies, SectorCompanyRow, SectorStat, TaiexPoint } from '#shared/types/hub'

// Market-wide datasets behind the hub pages（/stock 個股總表, /industry/…, /rank/…, /screener/…,
// /metrics）— 2026-09-19, the SEO build. Same defineCachedFunction rules as stock-data.ts:
// bffFetch throws → nothing cached; explicit names; stale-while-revalidate. These are the
// single source for BOTH the /api/hub/* routes and the sitemap handler, so a page and the
// sitemap can never disagree about which sectors/rank pages exist.

const TTL_DAILY = 6 * HOUR
const TTL_STATIC = 24 * HOUR
const TTL_CATALOG = 1 * HOUR

// GET /industries/securities-sectors → the 36 exchange sectors this app has a slug for, with
// bff-ts's own catalog counts; sectors with zero companies are dropped.
export const getSectors = defineCachedFunction(
  async (): Promise<HubSector[]> => {
    const response = await bffFetch<{ sectors: { code: string; name: string; companyCount: number }[] }>('/industries/securities-sectors')
    const sectors: HubSector[] = []
    for (const sector of response.sectors) {
      const known = SECTORS[sector.code]
      if (!known || sector.companyCount <= 0) continue
      sectors.push({ code: sector.code, name: known.name, slug: known.slug, companyCount: sector.companyCount })
    }
    return sectors.sort((a, b) => a.code.localeCompare(b.code))
  },
  { name: 'hub-sectors', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)

interface StocksCollectionResponse {
  count: number
  entries: { symbol: string; name: string; market?: 'TWSE' | 'TPEx' | null; sectorCode?: string | null; sectorName?: string | null }[]
}

const LISTED_SYMBOL = /^\d{4}$/
const STOCKS_PAGE_LIMIT = 1000

// GET /stocks（with market/sectorCode/sectorName since bff-ts 652eb68, 2026-09-19）paged in
// 1,000s → every four-digit symbol grouped by sector. The ~51 symbols bff-ts files under a
// non-industry code（07/91/98/XX → sectorCode null）go to `others`.
export const getMarketDirectory = defineCachedFunction(
  async (): Promise<MarketDirectory> => {
    const bySector = new Map<string, DirectoryCompany[]>()
    const others: DirectoryCompany[] = []
    let offset = 0
    let total = Infinity
    let listed = 0
    while (offset < total) {
      const response = await bffFetch<StocksCollectionResponse>('/stocks', { query: { limit: STOCKS_PAGE_LIMIT, offset } })
      total = response.count
      if (!response.entries.length) break
      for (const entry of response.entries) {
        if (!LISTED_SYMBOL.test(entry.symbol)) continue
        listed += 1
        const company: DirectoryCompany = { symbol: entry.symbol, name: entry.name, market: entry.market ?? null }
        const code = entry.sectorCode ?? null
        if (code && SECTORS[code]) {
          const list = bySector.get(code) ?? []
          list.push(company)
          bySector.set(code, list)
        } else {
          others.push(company)
        }
      }
      offset += response.entries.length
    }
    const bySymbol = (a: DirectoryCompany, b: DirectoryCompany) => a.symbol.localeCompare(b.symbol)
    const sectors: DirectorySector[] = [...bySector.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, companies]) => ({ code, name: SECTORS[code]!.name, slug: SECTORS[code]!.slug, companyCount: companies.length, companies: companies.sort(bySymbol) }))
    return { sectors, others: others.sort(bySymbol), total: listed }
  },
  { name: 'hub-market-directory', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

interface ScreenerFieldValue {
  value: string | null
  knowledgeDate: string
  nullReason: string | null
}

interface ScreenerRunResponse {
  count: number
  page: number
  pageSize: number
  totalPages: number
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

// The screener's own "sector population": a {min:null,max:null} filter keeps only rows where
// that field exists, and debtRatio.Q is the widest one（2,066 rows market-wide on 2026-09-19 vs
// 1,400–1,800 for the others）. Any page that includes stock.price is capped at 100 rows by bff-ts,
// so this pages in 100s.
const SECTOR_POPULATION_FIELD = 'debtRatio.Q'
const SECTOR_COLUMNS = ['stock.price', 'exchangePeRatio.EOD', 'exchangePbRatio.EOD', 'dividendYield.EOD', 'roe.TTM', 'eps.TTM', 'debtRatio.Q']
const SECTOR_PAGE_SIZE = 100
const SECTOR_MAX_PAGES = 30

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const weight = position - lower
  return Number((sorted[lower]! * (1 - weight) + sorted[upper]! * weight).toFixed(2))
}

function sectorStat(values: (number | null)[]): SectorStat {
  const sorted = values.filter((value): value is number => value !== null).sort((a, b) => a - b)
  return { count: sorted.length, median: quantile(sorted, 0.5), q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75) }
}

export const getSectorCompanies = defineCachedFunction(
  async (code: string): Promise<SectorCompanies> => {
    const rows: SectorCompanyRow[] = []
    const quoteDates: (string | undefined)[] = []
    const fundamentalsDates: (string | undefined)[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages && page <= SECTOR_MAX_PAGES) {
      const response = await bffFetch<ScreenerRunResponse>('/screener', {
        method: 'POST',
        body: {
          filters: [{ field: SECTOR_POPULATION_FIELD, min: null, max: null, exclude: false }],
          sectorCodes: [code],
          columns: SECTOR_COLUMNS,
          sortField: 'symbol',
          sortOrder: 'asc',
          page,
          pageSize: SECTOR_PAGE_SIZE
        }
      })
      totalPages = response.totalPages
      for (const result of response.results) {
        const cell = (field: string) => result.values[field] ?? null
        const number = (field: string) => parseDecimal(cell(field)?.value)
        quoteDates.push(cell('stock.price')?.knowledgeDate, cell('exchangePeRatio.EOD')?.knowledgeDate, cell('dividendYield.EOD')?.knowledgeDate)
        fundamentalsDates.push(cell('roe.TTM')?.knowledgeDate, cell('debtRatio.Q')?.knowledgeDate)
        rows.push({
          symbol: result.symbol,
          name: result.name,
          price: number('stock.price'),
          peRatio: number('exchangePeRatio.EOD'),
          pbRatio: number('exchangePbRatio.EOD'),
          dividendYield: number('dividendYield.EOD'),
          roe: number('roe.TTM'),
          eps: number('eps.TTM'),
          debtRatio: number('debtRatio.Q')
        })
      }
      if (!response.results.length) break
      page += 1
    }
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol))
    return {
      code,
      rows,
      stats: {
        peRatio: sectorStat(rows.map(row => row.peRatio)),
        pbRatio: sectorStat(rows.map(row => row.pbRatio)),
        dividendYield: sectorStat(rows.map(row => row.dividendYield)),
        roe: sectorStat(rows.map(row => row.roe))
      },
      quoteDate: maxIsoDate(quoteDates),
      fundamentalsDate: maxIsoDate(fundamentalsDates)
    }
  },
  { name: 'hub-sector-companies', getKey: code => code, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

interface RankingResponse {
  field: string
  direction: 'asc' | 'desc'
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

const RANKING_LIMIT = 50

// GET /screener/ranking — the 50-row market-wide ordering behind one /rank/{slug} page.
export const getRanking = defineCachedFunction(
  async (slug: string): Promise<RankingPageData> => {
    const definition = findRankPage(slug)
    if (!definition) throw new Error(`unknown rank page "${slug}"`)
    const response = await bffFetch<RankingResponse>('/screener/ranking', {
      query: { field: definition.field, direction: definition.direction, limit: RANKING_LIMIT }
    })
    const column = response.columns.find(item => item.field === definition.field) ?? response.columns[0]
    const rows: RankingRow[] = response.results.map((result, index) => {
      const cell = result.values[definition.field] ?? null
      return { rank: index + 1, symbol: result.symbol, name: result.name, value: parseDecimal(cell?.value), knowledgeDate: cell?.knowledgeDate ?? null }
    })
    return {
      slug,
      field: definition.field,
      direction: definition.direction,
      metricName: column?.metricName ?? definition.label,
      fieldName: column?.fieldName ?? '',
      unit: column?.unit ?? null,
      rows,
      asOf: maxIsoDate(rows.map(row => row.knowledgeDate))
    }
  },
  { name: 'hub-ranking', getKey: slug => slug, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// GET /metrics — the whole catalog, passed through untyped: the app types it as FilterSchema
// (useFilterSchema.ts) and the server never reads into it.
export const getMetricsCatalog = defineCachedFunction(
  () => bffFetch<{ categories: unknown[] }>('/metrics'),
  { name: 'hub-metrics-catalog', maxAge: TTL_CATALOG, staleMaxAge: TTL_STATIC, swr: true }
)

// GET /screener/templates（public）with this app's URL slug attached by template NAME.
export const getScreenerTemplates = defineCachedFunction(
  async (): Promise<ScreenerTemplateWithSlug[]> => {
    const response = await bffFetch<{ templates: ScreenerTemplateSummary[] }>('/screener/templates')
    return response.templates.map(template => ({ ...template, slug: screenerTemplateSlug(template.name) }))
  },
  { name: 'hub-screener-templates', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)

// How many companies currently match a template — POST /screener's `count` is the total match
// count regardless of the page（verified 2026-09-19: sector 24 → count 196 with one page of 50）.
// The condition pages show the number only, never the list.
export const getTemplateMatchCount = defineCachedFunction(
  async (slug: string): Promise<number | null> => {
    const templates = await getScreenerTemplates()
    const template = templates.find(item => item.slug === slug)
    if (!template || !template.filters.length) return null
    const response = await bffFetch<ScreenerRunResponse>('/screener', {
      method: 'POST',
      body: {
        filters: template.filters,
        columns: [template.filters[0]!.field],
        page: 1,
        pageSize: 50
      }
    })
    return response.count
  },
  { name: 'hub-template-match-count', getKey: slug => slug, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// /macro/policy-rate 的兩份資料 — 央行政策利率事件 + 加權指數月收盤，一次快取。
//
// MONTHLY, not daily, and that is the point rather than a compromise: /market/taiex-daily-price
// caps at 2000 rows whatever the interval, so daily reaches back only to 2018-07（7 rate events,
// six of them inside one 2022–2024 cluster）while monthly fits 1999-01 → today in 333 rows and
// covers every cycle since 2000（56 events）. Drawing a 25-year rate cycle never needed daily
// granularity; the parameter exists because this page asked for it（analysis-ts 1b5b7d02, and
// bff-ts e84badd after the param turned out to be dropped at their layer）.
//
// `from: '2000-01-01'` on the rate call rather than the full 77-row history: the index series
// starts at 1999, so the eleven 1989–1999 events would be markers with no line under them.
const RATE_CYCLE_FROM = '2000-01-01'
const TAIEX_LIMIT = 2000

export const getRateCycle = defineCachedFunction(
  async (): Promise<RateCyclePageData> => {
    const [rates, taiex] = await Promise.all([
      bffFetch<{ entries: RateCycleEvent[] }>(`/macro/cbc-policy-rate?from=${RATE_CYCLE_FROM}`),
      bffFetch<{ entries: { tradeDate: string; close: string | number }[] }>(`/market/taiex-daily-price?interval=monthly&limit=${TAIEX_LIMIT}`)
    ])
    // close arrives as a string（bff-ts's Decimal convention for every market-domain price）—
    // parsed once here so no consumer has to remember, and dropped rather than coerced to NaN if
    // it ever fails to parse.
    const points: TaiexPoint[] = taiex.entries
      .map(entry => ({ tradeDate: entry.tradeDate, close: Number(entry.close) }))
      .filter(point => Number.isFinite(point.close))
    return { events: rates.entries, taiex: points, interval: 'monthly' }
  },
  { name: 'hub-rate-cycle', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)