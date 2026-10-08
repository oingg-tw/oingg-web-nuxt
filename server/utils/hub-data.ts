import type { DirectoryCompany, DirectorySector, HubSector, MacroPageData, MacroSeriesPoint, MarketDirectory, MarketEventDay, MarketEventMonth, MarketEventsPageData, RankingPageData, RankingRow, RateCyclePageData, ScreenerTemplateSummary, ScreenerTemplateWithSlug, SectorCompanies, SectorCompanyRow, SectorStat, TaiexPoint, UsRateCycleEvent, EquityRiskPremiumComponents, EquityRiskPremiumPageData, EquityRiskPremiumWindow, EcbRateCycleEvent, SectorDividendSummaryPageData } from '#shared/types/hub'

// Market-wide datasets behind the hub pages（/stock 個股總表, /industry/…, /rank/…, /screener/…,
// /metrics）— 2026-09-19, the SEO build. Same defineCachedFunction rules as stock-data.ts:
// bffFetch throws → nothing cached; explicit names; stale-while-revalidate. These are the
// single source for BOTH the /api/hub/* routes and the sitemap handler, so a page and the
// sitemap can never disagree about which sectors/rank pages exist.

const TTL_DAILY = 6 * HOUR
const TTL_STATIC = 24 * HOUR
const TTL_CATALOG = 1 * HOUR

// GET /industries/securities-sectors → the 36 exchange sectors this app has a slug for.
//
// CROSS-CHECKED AGAINST THE DIRECTORY（2026-09-23）, not taken from the catalog alone. The catalog's
// own `companyCount` disagrees with it: bff-ts reports 32 companies under 13 電子工業（舊分類）,
// while /api/hub/directory has no sector 13 at all（34 sectors against the catalog's 35）. That
// disagreement reached a reader as a BROKEN LINK — the homepage rendered a chip reading
//「電子工業（舊分類）（32）」whose page answers 404, because industry/[code].get.ts 404s a sector
// with neither screener rows nor directory members. Measured: 35 chips on the homepage, 34 resolving.
//
// A dead link on the page whose whole job is looking trustworthy is not a cosmetic bug: the
// credibility reference this app follows lists「零 404 斷鏈」among the things a site must not have.
// So the count is no longer trusted on its own — a sector ships only if somebody is actually
// listed under it.
export const getSectors = defineCachedFunction(
  async (): Promise<HubSector[]> => {
    const [response, directory] = await Promise.all([
      bffFetch<{ sectors: { code: string; name: string; companyCount: number }[] }>('/industries/securities-sectors'),
      getMarketDirectory()
    ])
    // 家數用 directory 自己數、而且**排除興櫃**，不用型錄的 companyCount（2026-10-01）。
    //
    // 原本直接用型錄那個數字，而 2026-09-26「industry 請先不要顯示興櫃的公司」之後，產業頁的公司表
    // 已經不含興櫃——於是膠囊寫的家數跟點進去看到的家數對不上。實測 34 個類股裡 26 個不一致，最大的
    // 是生技醫療業：膠囊 252、頁面實際列出 159（差 93 全部是興櫃）。
    //
    // 兩個數字都「對」，但一個頁面上只能有一種意思，而讀者會拿膠囊的數字去對表格的列數。
    // 選列出的那個：顯示的數字必須是讀者數得出來的那個。
    //
    // 這同時取代了舊的 `listed.has(code)` 交叉檢查——家數 > 0 本身就蘊含「directory 裡有成員」，
    // 而且門檻更嚴（只有興櫃成員的類股也會被擋掉，那種類股的頁面會列出 0 家）。
    const listedCounts = new Map(
      directory.sectors.map(sector => [sector.code, sector.companies.filter(company => !company.isEmerging).length])
    )
    const sectors: HubSector[] = []
    for (const sector of response.sectors) {
      const known = SECTORS[sector.code]
      const companyCount = listedCounts.get(sector.code) ?? 0
      if (!known || companyCount <= 0) continue
      sectors.push({ code: sector.code, name: known.name, slug: known.slug, companyCount })
    }
    return sectors.sort((a, b) => a.code.localeCompare(b.code))
  },
  { name: 'hub-sectors', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)

interface StocksCollectionResponse {
  count: number
  entries: { symbol: string; name: string | null; market?: 'TWSE' | 'TPEx' | null; isEmerging?: boolean | null; sectorCode?: string | null; sectorName?: string | null }[]
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
        // isEmerging 帶上來但**不在這裡過濾**（2026-09-26「industry 請先不要顯示興櫃的公司」）：這份
        // directory 不只餵 /industry，在源頭砍掉會連帶改到沒被指名的頁面。哪一頁要不要顯示興櫃是那一頁
        // 自己的決定，資料在這裡備好就好。興櫃股的代號同樣是四碼（6744、6748…），所以 LISTED_SYMBOL
        // 那道正規表示式擋不掉它們——這個欄位是唯一可靠的判準。
        // name 可能是 null（bff-ts f750e92）：用代號頂上，產業頁表格與搜尋都假設它是字串
        const company: DirectoryCompany = { symbol: entry.symbol, name: entry.name ?? entry.symbol, market: entry.market ?? null, isEmerging: entry.isEmerging ?? false }
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
const SECTOR_COLUMNS = ['stock.price', 'exchangePeRatio.EOD', 'exchangePbRatio.EOD', 'dividendYield.EOD', 'roe.TTM', 'eps.TTM', 'debtRatio.Q', 'dividendGrowthRate3y.FY']
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
          debtRatio: number('debtRatio.Q'),
          dividendGrowthRate3y: number('dividendGrowthRate3y.FY')
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

interface ScreenerRunResponse {
  count: number
  totalPages: number
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

const SCREENER_PAGE_SIZE = 50
// 抓頁數的上限。derivedMinus 的頁面要把符合的全抓回來才排得對，而「符合的」目前是 442 家 ＝ 9 頁
// （實測 2026-10-01），所以 12 頁留了餘裕。超過就截斷並在註解裡說清楚代價：排序會少掉後面那些
// 頁裡可能更大的幅度。真的長到超過，要改的是上游給一個可排序的欄位，不是把這個數字往上加——
// 每一頁都是一次 screener 查詢（每頁約 0.9 秒）。
const SCREENER_MAX_PAGES = 12

// POST /screener — 需要先篩族群再排序的 /rank 頁面走這條（見 RANK_PAGES 的 `screener` 註解）。
// `GET /screener/ranking` 不吃 filter，所以那一支做不到。
async function runScreenerRanking(definition: RankPageDefinition): Promise<RankingPageData> {
  const spec = definition.screener!
  const body = {
    filters: spec.filters,
    columns: spec.columns,
    ...(spec.sortField ? { sortField: spec.sortField, sortOrder: definition.direction } : {}),
    pageSize: SCREENER_PAGE_SIZE
  }
  const first = await bffFetch<ScreenerRunResponse>('/screener', { method: 'POST', body: { ...body, page: 1 } })
  const results = [...first.results]
  // derivedMinus 的排序值算不出來在伺服器端，所以要全抓；sortField 的頁面第一頁就是答案。
  if (spec.derivedMinus) {
    const pages = Math.min(first.totalPages ?? 1, SCREENER_MAX_PAGES)
    for (let page = 2; page <= pages; page++) {
      const next = await bffFetch<ScreenerRunResponse>('/screener', { method: 'POST', body: { ...body, page } })
      results.push(...next.results)
    }
  }

  const valueField = spec.derivedMinus ? spec.derivedMinus[0] : definition.field
  const column = first.columns.find(item => item.field === valueField) ?? first.columns[0]
  const valueOf = (values: Record<string, ScreenerFieldValue | null>): number | null => {
    if (!spec.derivedMinus) return parseDecimal(values[definition.field]?.value)
    const minuend = parseDecimal(values[spec.derivedMinus[0]]?.value)
    const subtrahend = parseDecimal(values[spec.derivedMinus[1]]?.value)
    if (minuend === null || subtrahend === null) return null
    // 兩個運算元都只報到分（每股盈餘的精度），所以相減的**精確**答案也只到分——
    // 23.439999999999998 是二進位浮點的雜訊不是精度。四捨五入到分是還原正確值，不是修飾畫面：
    // 這個數字會進到答句與 meta description，而那兩處不經過畫面的格式化函式。
    return Math.round((minuend - subtrahend) * 100) / 100
  }

  const ordered = results
    .map(result => ({ result, value: valueOf(result.values) }))
    .filter((entry): entry is { result: typeof entry.result; value: number } => entry.value !== null)
  // sortField 的頁面上游已經排好，順序不要動（它排的是 null 以外的全市場，我們只看到第一頁）。
  if (spec.derivedMinus) ordered.sort((a, b) => (definition.direction === 'asc' ? a.value - b.value : b.value - a.value))

  const rows: RankingRow[] = ordered.slice(0, RANKING_LIMIT).map((entry, index) => ({
    rank: index + 1,
    symbol: entry.result.symbol,
    name: entry.result.name,
    value: entry.value,
    knowledgeDate: entry.result.values[valueField]?.knowledgeDate ?? null
  }))

  return {
    slug: definition.slug,
    field: definition.field,
    direction: definition.direction,
    metricName: spec.metricName ?? column?.metricName ?? definition.label,
    fieldName: column?.fieldName ?? '',
    unit: spec.unit ?? column?.unit ?? null,
    rows,
    asOf: maxIsoDate(rows.map(row => row.knowledgeDate))
  }
}

// GET /screener/ranking — the 50-row market-wide ordering behind one /rank/{slug} page.
export const getRanking = defineCachedFunction(
  async (slug: string): Promise<RankingPageData> => {
    const definition = findRankPage(slug)
    if (!definition) throw new Error(`unknown rank page "${slug}"`)
    if (definition.screener) return runScreenerRanking(definition)
    const floor = definition.growthBaseFloor
    const response = await bffFetch<RankingResponse>('/screener/ranking', {
      // `columns` 讓同一次呼叫多帶一個欄位（實測 2026-10-01 可用），所以基期門檻不需要第二次往返。
      query: { field: definition.field, direction: definition.direction, limit: RANKING_LIMIT, ...(floor ? { columns: floor.valueField } : {}) }
    })
    const column = response.columns.find(item => item.field === definition.field) ?? response.columns[0]
    // 基期太小的列剔掉（見 RANK_PAGES 的 growthBaseFloor 註解）。**`limit` 上限是 50**（實測，送 120
    // 回 400），所以沒辦法多抓一些再篩到 50——篩完就是不足 50 列，那是誠實的結果而不是缺陷：
    // 「年增率最高的 50 檔，排除基期幾乎沒有營收的」本來就不保證有 50 檔。站台檢查對這一頁的要求是
    // 「前 50 名至少有 3 個不同的值」，不是 50 列。
    //
    // 算不出基期的列（任一欄缺值、或年增率剛好 −100% 讓分母為 0）一律保留：門檻的職責是剔除「已知
    // 基期太小」，不是剔除「不知道基期」——後者會讓一個缺欄位的上游問題靜靜地改變榜單內容。
    const kept = floor
      ? response.results.filter(result => {
          const growth = Number(parseDecimal(result.values[definition.field]?.value))
          const current = Number(parseDecimal(result.values[floor.valueField]?.value))
          if (!Number.isFinite(growth) || !Number.isFinite(current)) return true
          const divisor = 1 + growth / 100
          if (divisor === 0) return true
          // **帶正負號比，不要用絕對值**（2026-10-01 修）。上游的年增率分母是 |基期|（型錄的
          // formulaLatex 寫得很明確），所以基期為負的公司年增率是**正的**——「虧損縮小」會被排進
          // 「成長最高」。原本寫 `Math.abs(...)`，於是本季 EPS −5、虧損縮小的公司推算基期是 −3.33，
          // 絕對值 3.33 過得了門檻而留在榜上。要求基期 > 0 就同時擋掉「虧損縮小」與「由虧轉盈」。
          //
          // 對營收沒有影響（基期為負只有退貨或會計調整那種罕見情況，實測 50 列全正），但對 EPS 是
          // 必要的，而這條門檻是共用的。
          return current / divisor >= floor.minBase
        })
      : response.results
    const rows: RankingRow[] = kept.map((result, index) => {
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

// 三個利率頁的資料（央行 2026-09-21、聯準會 09-29、歐洲央行 09-30）：政策利率事件＋加權指數月收盤，同一支快取函式、以來源為鍵；
// 事件型別各不相同（見 shared/types/hub.ts），三個 export 各自縮回正確的型別。
// 指數用月收盤不用日線：幾十年的利率循環不需要日線解析度（2026-10-08 量到 1990-01 起 442 列；建頁時是 1999-01 起 333 列），三頁共用同一份快取（hub-taiex-monthly）、畫的是
// 同一條線。利率事件一律取完整歷史（2026-09-29 更正：原本帶 from=2000-01-01，連表一起砍掉了——美國 186 筆少 111 筆、台灣少
// 1989–1999 的 21 筆）：表給完整歷史，圖只畫指數有值的那一段，差幾筆在圖的答句裡說。
// 8000：上游上限 2026-09-22 起（analysis-ts 113dd818 → bff-ts 91f5aec），月線用不到、日線 1999 起約 6,900 列也裝得下。
const TAIEX_LIMIT = 8000

// close 是字串（bff-ts 市場資料的 Decimal 慣例），在這裡轉一次；轉不成的丟掉而不是留 NaN
const cachedTaiexMonthly = defineCachedFunction(
  async (): Promise<TaiexPoint[]> => {
    const taiex = await bffFetch<{ entries: { tradeDate: string; close: string | number }[] }>(
      `/market/taiex-daily-price?interval=monthly&limit=${TAIEX_LIMIT}`
    )
    return taiex.entries
      .map(entry => ({ tradeDate: entry.tradeDate, close: Number(entry.close) }))
      .filter(point => Number.isFinite(point.close))
  },
  { name: 'hub-taiex-monthly', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)

const RATE_CYCLE_SOURCES = { cbc: '/macro/cbc-policy-rate', us: '/macro/us-policy-rate', ecb: '/macro/ecb-policy-rate' } as const

// TTL_STATIC（gov-ts 2026-09-29 建議）：來源每天 05:12 一班 ingest，真正的變動一年最多 8 次，快取再積極也快不過來源
const cachedRateCycle = defineCachedFunction(
  async (source: keyof typeof RATE_CYCLE_SOURCES): Promise<RateCyclePageData<unknown>> => {
    const [rates, taiex] = await Promise.all([bffFetch<{ entries: unknown[] }>(RATE_CYCLE_SOURCES[source]), cachedTaiexMonthly()])
    return { events: rates.entries, taiex }
  },
  { name: 'hub-rate-cycle', getKey: source => source, maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)
export const getRateCycle = (): Promise<RateCyclePageData> => cachedRateCycle('cbc') as Promise<RateCyclePageData>
export const getUsRateCycle = (): Promise<RateCyclePageData<UsRateCycleEvent>> => cachedRateCycle('us') as Promise<RateCyclePageData<UsRateCycleEvent>>
export const getEcbRateCycle = (): Promise<RateCyclePageData<EcbRateCycleEvent>> => cachedRateCycle('ecb') as Promise<RateCyclePageData<EcbRateCycleEvent>>

// /industries 的類股股利統計（2026-09-30）。一次呼叫、34 個類股，不需要扇出。
export const getSectorDividendSummary = defineCachedFunction(
  async (): Promise<SectorDividendSummaryPageData> =>
    bffFetch<SectorDividendSummaryPageData>('/industries/sector-dividend-summary'),
  { name: 'hub-sector-dividend-summary', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// /macro/equity-risk-premium 的四個窗口（2026-09-29）。
//
// 先打一次不帶參數的，為的是拿 windowEnd——窗口終點由上游的資料覆蓋決定（目前 2026-07，受 10 年期
// 公債殖利率那一支的最新月份限制），寫死會在下個月變成錯的。其餘三個窗口從那個終點往回推。
//
// 四次呼叫一個快取鍵：這四個數字是一組的，分開快取會讓它們落在不同世代，而這一頁的全部內容就是
// 它們之間的差。
const ERP_WINDOW_YEARS = [20, 10, 5] as const

interface ErpResponse {
  windowStart: string
  windowEnd: string
  months: number
  erpGeometric: number | null
  erpArithmetic: number | null
  dataCoverage?: { taiexDateRange?: { min: string; max: string } }
  supplySide: (EquityRiskPremiumComponents & { erp: number | null }) | null
}

export const getEquityRiskPremium = defineCachedFunction(
  async (): Promise<EquityRiskPremiumPageData> => {
    const full = await bffFetch<ErpResponse>('/macro/equity-risk-premium')
    const [endYear, endMonth] = full.windowEnd.split('-').map(Number) as [number, number]
    const rest = await Promise.all(
      ERP_WINDOW_YEARS.map(years =>
        bffFetch<ErpResponse>(
          `/macro/equity-risk-premium?startYear=${endYear - years}&startMonth=${endMonth}&endYear=${endYear}&endMonth=${endMonth}`
        )
      )
    )
    const toWindow = (label: string, response: ErpResponse): EquityRiskPremiumWindow => ({
      label,
      windowStart: response.windowStart,
      windowEnd: response.windowEnd,
      months: response.months,
      erpGeometric: response.erpGeometric,
      erpArithmetic: response.erpArithmetic,
      supplySideErp: response.supplySide?.erp ?? null
    })
    const { erp: _erp, ...components } = full.supplySide ?? { erp: null }
    return {
      windows: [
        toWindow('完整', full),
        ...rest.map((response, index) => toWindow(`${ERP_WINDOW_YEARS[index]} 年`, response))
      ],
      components: full.supplySide ? (components as EquityRiskPremiumComponents) : null,
      taiexRange: full.dataCoverage?.taiexDateRange ?? null
    }
  },
  { name: 'hub-equity-risk-premium', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
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