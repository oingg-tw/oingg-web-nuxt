import type { DirectoryCompany, DirectorySector, HubSector, MacroPageData, MacroSeriesPoint, MarketDirectory, MarketEventDay, MarketEventMonth, MarketEventsPageData, RankingPageData, RankingRow, RateCycleEvent, RateCyclePageData, ScreenerTemplateSummary, ScreenerTemplateWithSlug, SectorCompanies, SectorCompanyRow, SectorStat, TaiexPoint } from '#shared/types/hub'

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

// /macro/market-events 的一份資料 — 央行月報的加權指數月平均，事件本身是前端靜態資料。
//
// 央行月報（gov-ts export.monthly_stock_market_summary → analysis-ts 26174084 → bff-ts 25541bc）
// rather than /market/taiex-daily-price, switched 2026-09-22 by direct decision（「改用月平均換
// 39.3 年深度」）. The index series this page used until then is a MONTH-END CLOSE reaching
// 1999-01（333 rows, 27.7 years）; this one is a MONTHLY AVERAGE reaching 1987-05（471 rows,
// 39.3 years）.
//
// What the extra twelve years buy, and why it was worth changing what the line means:
//   * the 35-year lookback the page was asked for becomes real instead of a label on the same chart
//   * 1988-09-24 證所稅 and 1997-07-02 泰銖浮動 get a line under them at last — both were already
//     in the event list, filtered out for having no index to sit on
//
// The cost is two months of recency（this series ends 2026-07, the daily one reached 2026-09）and
// a different meaning for every point. The second is stated on the page rather than glossed: for
//「那個月大盤在什麼位置」a monthly mean is arguably the better answer anyway, since a single
// closing day can land on an extreme.
//
// The two series must NEVER be stitched — analysis-ts and bff-ts both carry that warning in their
// own OpenAPI docs, and the seam would invent a jump that never happened.
export const getMarketEvents = defineCachedFunction(
  async (): Promise<MarketEventsPageData> => {
    const [summary, daily] = await Promise.all([
      bffFetch<{ entries: { period: string; avgTaiex: string | number | null }[] }>('/macro/stock-market-summary'),
      // Daily alongside the monthly average — a different series with a different sensitivity, and
      // the page keeps them in separate lists. Fetched here rather than by the page so both halves
      // come from one cached call, same as every other page in this zone.
      bffFetch<{ entries: { tradeDate: string; close: string | number }[] }>(`/market/taiex-daily-price?interval=daily&limit=${TAIEX_LIMIT}`)
    ])
    const months: MarketEventMonth[] = summary.entries
      .map(entry => ({ period: entry.period, avgTaiex: Number(entry.avgTaiex) }))
      .filter(month => month.period && Number.isFinite(month.avgTaiex))
    const days: MarketEventDay[] = daily.entries
      .map(entry => ({ tradeDate: entry.tradeDate, close: Number(entry.close) }))
      .filter(day => Number.isFinite(day.close))
    return { months, days }
  },
  { name: 'hub-market-events', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)

// /macro/{slug} 的兩份資料 — 一支總經序列 + 同頻率的加權指數。
//
// The index is fetched MONTHLY and, for a quarterly page, reduced to the quarter's last month here
// rather than on the page: aligning two cadences is exactly the kind of thing that goes subtly
// wrong once per consumer, and there are six consumers. A quarterly period keeps whichever monthly
// close falls latest inside it, which is the quarter-end close.
//
// One cached entry per slug, so a page and the sitemap read the same source and the index window
// can't differ between two macro pages.
export const getMacroPage = defineCachedFunction(
  async (slug: string): Promise<MacroPageData> => {
    const page = findMacroPage(slug)
    if (!page) throw createError({ statusCode: 404, statusMessage: 'unknown macro page' })

    const [source, taiex] = await Promise.all([
      bffFetch<{ entries: Record<string, unknown>[] }>(page.endpoint),
      bffFetch<{ entries: { tradeDate: string; close: string | number }[] }>(`/market/taiex-daily-price?interval=monthly&limit=${TAIEX_LIMIT}`)
    ])

    const keys = page.series.map(spec => spec.key)
    // Two upstream contracts, not one. The monthly/quarterly series carry `period` because this
    // app asked analysis-ts to assemble it（the same (year, month) reassembly done per client is
    // the same bug per client）. usd-twd-rate does NOT: it shares /market/taiex-daily-price's own
    // contract and carries `tradeDate`, which is why it also takes interval/limit. Derived here so
    // the page template never learns there were two shapes — found by the exchange-rate page
    // rendering one empty row, since a missing `period` fell straight through the filter below.
    const periodOf = (entry: Record<string, unknown>): string => {
      const period = entry.period
      if (typeof period === 'string' && period.length > 0) return period
      const tradeDate = entry.tradeDate
      return typeof tradeDate === 'string' ? tradeDate.slice(0, 7) : ''
    }
    const series: MacroSeriesPoint[] = source.entries.map(entry => ({
      period: periodOf(entry),
      values: Object.fromEntries(keys.map(key => {
        const raw = entry[key]
        const value = typeof raw === 'string' ? Number(raw) : raw
        return [key, typeof value === 'number' && Number.isFinite(value) ? value : null]
      }))
    })).filter(point => point.period.length > 0)

    // 'YYYY-MM' → 'YYYY-Qn' for a quarterly page; the month's own key otherwise. Both are
    // lexicographically ordered, which is what every join and sort below relies on.
    const toPeriod = (tradeDate: string): string => {
      const month = tradeDate.slice(0, 7)
      if (page.cadence === 'monthly') return month
      const quarter = Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1
      return `${month.slice(0, 4)}-Q${quarter}`
    }
    const byPeriod = new Map<string, number>()
    for (const entry of taiex.entries) {
      const close = Number(entry.close)
      // Later rows overwrite earlier ones and bff-ts returns oldest-first, so each period keeps its
      // own last close — the quarter-end / month-end value.
      if (Number.isFinite(close)) byPeriod.set(toPeriod(entry.tradeDate), close)
    }

    return {
      slug,
      series,
      taiex: [...byPeriod.entries()].map(([period, close]) => ({ period, close })).sort((a, b) => a.period.localeCompare(b.period))
    }
  },
  { name: 'hub-macro-page', getKey: slug => slug, maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)