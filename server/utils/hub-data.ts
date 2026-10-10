import type { DirectoryCompany, DirectorySector, HubSector, MarketDirectory, RankingPageData, RankingRow, ScreenerTemplateSummary, ScreenerTemplateWithSlug, SectorCompanies, SectorCompanyRow, SectorCycleRow, SectorCycleSummary, SectorGrowthSummary, SectorMetricHistory, SectorMonthlyRevenue, SectorStat, SectorStats, SectorDividendSummaryPageData } from '#shared/types/hub'

// Market-wide datasets behind the hub pages（/stock 個股總表, /industry/…, /rank/…, /screener/…,
// /metrics）— 2026-09-19, the SEO build. 總經特區的資料在 macro-data.ts（2026-10-08 拆出）。 Same defineCachedFunction rules as stock-data.ts:
// bffFetch throws → nothing cached; explicit names; stale-while-revalidate. These are the
// single source for BOTH the /api/hub/* routes and the sitemap handler, so a page and the
// sitemap can never disagree about which sectors/rank pages exist.

export const TTL_DAILY = 6 * HOUR
export const TTL_STATIC = 24 * HOUR
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
const SECTOR_COLUMNS = ['stock.price', 'exchangePeRatio.EOD', 'exchangePbRatio.EOD', 'dividendYield.EOD', 'roe.TTM', 'eps.TTM', 'debtRatio.Q', 'dividendGrowthRate3y.FY', 'revenueGrowthRate.TTM', 'netIncomeGrowthRate.TTM']
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
  return { count: sorted.length, median: quantile(sorted, 0.5), q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75), p10: quantile(sorted, 0.1), p90: quantile(sorted, 0.9) }
}

function sectorStats(rows: SectorCompanyRow[]): SectorStats {
  return {
    peRatio: sectorStat(rows.map(row => row.peRatio)),
    pbRatio: sectorStat(rows.map(row => row.pbRatio)),
    dividendYield: sectorStat(rows.map(row => row.dividendYield)),
    roe: sectorStat(rows.map(row => row.roe))
  }
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
          dividendGrowthRate3y: number('dividendGrowthRate3y.FY'),
          revenueGrowthRate: number('revenueGrowthRate.TTM'),
          netIncomeGrowthRate: number('netIncomeGrowthRate.TTM')
        })
      }
      if (!response.results.length) break
      page += 1
    }
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol))
    return {
      code,
      rows,
      stats: sectorStats(rows),
      quoteDate: maxIsoDate(quoteDates),
      fundamentalsDate: maxIsoDate(fundamentalsDates)
    }
  },
  { name: 'hub-sector-companies', getKey: code => code, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 一個類股的上市櫃公司（2026-10-09 從 /api/hub/industry/:code 抽出來，產業成長座標圖共用）。興櫃不顯示（2026-09-26
// 「industry 請先不要顯示興櫃的公司」）；興櫃代號同樣四碼，screener 列上也沒有市場別，只能 join 目錄的 isEmerging。
// **統計在過濾之後重算**：原本 stats 是 getSectorCompanies 在過濾前算的，類股頁的四分位數字因此含興櫃、表格卻不含。
export async function getListedSectorCompanies(code: string) {
  const [companies, directory] = await Promise.all([getSectorCompanies(code), getMarketDirectory()])
  const allMembers = directory.sectors.find(sector => sector.code === code)?.companies ?? []
  const emerging = new Set(allMembers.filter(company => company.isEmerging).map(company => company.symbol))
  const rows = companies.rows.filter(row => !emerging.has(row.symbol))
  return {
    companies: { ...companies, rows, stats: sectorStats(rows) },
    members: allMembers.filter(company => !company.isEmerging)
  }
}

// /industries/growth：各類股的營收、淨利近四季年增率中位數（2026-10-10 起讀上游 GET /industries/sector-summary，取代原本
// 34 次 getSectorCompanies；上游同樣是每家各自最新一筆的混期快照、排除興櫃）。沒有 p10／p90，那兩格是 null。
const GROWTH_FIELDS = ['revenueGrowthRate.TTM', 'netIncomeGrowthRate.TTM'] as const
interface SectorSummaryResponse {
  sectors: { sectorCode: string; sectorName: string; companyCount: number; fields: Record<string, { count: number; median: number | null; q1: number | null; q3: number | null }> }[]
}
export const getSectorGrowthSummary = defineCachedFunction(
  async (): Promise<SectorGrowthSummary> => {
    const [summary, sectors] = await Promise.all([
      bffFetch<SectorSummaryResponse>('/industries/sector-summary', { query: { fields: GROWTH_FIELDS.join(',') } }),
      getSectors()
    ])
    const slugOf = new Map(sectors.map(sector => [sector.code, sector.slug]))
    const stat = (cell: SectorSummaryResponse['sectors'][number]['fields'][string] | undefined): SectorStat =>
      ({ count: cell?.count ?? 0, median: cell?.median ?? null, q1: cell?.q1 ?? null, q3: cell?.q3 ?? null, p10: null, p90: null })
    return {
      sectors: summary.sectors
        .filter(row => slugOf.has(row.sectorCode))
        .map(row => ({
          code: row.sectorCode,
          name: row.sectorName,
          slug: slugOf.get(row.sectorCode)!,
          revenueGrowthRate: stat(row.fields[GROWTH_FIELDS[0]]),
          netIncomeGrowthRate: stat(row.fields[GROWTH_FIELDS[1]])
        })),
      fundamentalsDate: null
    }
  },
  { name: 'hub-sector-growth-summary', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 類股指標中位數逐期（產業頁三率走勢、個股指標頁的同類股中位數）。只收季報型指標，每股類上游回 400。
export const getSectorMetricHistory = defineCachedFunction(
  (code: string, metricCode: string, basis: string, limit: number): Promise<SectorMetricHistory> =>
    bffFetch<SectorMetricHistory>(`/industries/${code}/metric-history`, { query: { metricCode, basis, limit } }),
  { name: 'hub-sector-metric-history', getKey: (code, metricCode, basis, limit) => `${code}:${metricCode}:${basis}:${limit}`, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 一檔股票所屬類股、同一個期別基準的中位數逐期（指標頁與徽章頁的「跟同類股中位數比」共用）。讀不到就 null。
export async function getSymbolSectorMedian(symbol: string, metricCode: string, basis: string, limit: number): Promise<SectorMetricHistory | null> {
  const directory = await getMarketDirectory().catch(() => null)
  const sectorCode = directory?.sectors.find(sector => sector.companies.some(company => company.symbol === symbol))?.code
  if (!sectorCode) return null
  return getSectorMetricHistory(sectorCode, metricCode, basis, limit).catch(() => null)
}

// 類股月營收（冷查詢 1～2 秒，上游建議快取）
export const getSectorMonthlyRevenue = defineCachedFunction(
  (code: string): Promise<SectorMonthlyRevenue> =>
    bffFetch<SectorMonthlyRevenue>(`/industries/${code}/monthly-revenue-history`, { query: { limit: 60 } }),
  { name: 'hub-sector-monthly-revenue', getKey: code => code, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 景氣同時指標（去趨勢），/industries/cycle 的對照序列。不走 getMacroPage：那支只留總經頁設定的 series 鍵，加鍵會讓
// 景氣燈號頁多一條線。用同時指標不用燈號分數——燈號含股價指數，每年除息季會機械性下滑（conductor 景氣對策信號文件 §2.2）。
export const getBusinessCycleCoincident = defineCachedFunction(
  // 回傳普通物件不回 Map：快取是 JSON，Map 讀回來會變成 {}
  async (): Promise<Record<string, number>> => {
    const response = await bffFetch<{ entries: { period: string; coincidentIndexDetrended: number | string | null }[] }>('/macro/business-cycle-indicator')
    return Object.fromEntries(response.entries.flatMap(entry => {
      const value = Number(entry.coincidentIndexDetrended)
      return entry.coincidentIndexDetrended !== null && Number.isFinite(value) ? [[entry.period, value]] : []
    }))
  },
  { name: 'hub-business-cycle-coincident', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

const previousMonth = (yearMonth: string, back: number): string => {
  const [year, month] = yearMonth.split('-').map(Number) as [number, number]
  const index = year * 12 + month - 1 - back
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

// 近三個月累計營收年增率（%）：三個月營收加總 ÷ 去年同三個月加總 − 1。單月年增率會被農曆年落在一月或二月拉成暴衝，
// 三個月累計把它攤平。缺任一個月就不算。上游每月用「兩年都有申報的同一批公司」，三個月的家數可能差一兩家，誤差可忽略。
function rollingThreeMonthYoy(entries: SectorMonthlyRevenue['entries']): { yearMonth: string; value: number }[] {
  const byMonth = new Map(entries.map(entry => [entry.yearMonth, entry]))
  return entries.flatMap(entry => {
    const window = [0, 1, 2].map(back => byMonth.get(previousMonth(entry.yearMonth, back)))
    if (window.some(month => !month)) return []
    const revenue = window.reduce((sum, month) => sum + Number(month!.revenue), 0)
    const lastYear = window.reduce((sum, month) => sum + Number(month!.lastYearRevenue), 0)
    return lastYear > 0 && Number.isFinite(revenue) ? [{ yearMonth: entry.yearMonth, value: (revenue / lastYear - 1) * 100 }] : []
  })
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
// 母體標準差（這 N 個月就是要描述的全部，不是抽樣）
const populationStdev = (values: number[]) => {
  const m = mean(values)
  return Math.sqrt(mean(values.map(value => (value - m) ** 2)))
}
function pearson(xs: number[], ys: number[]): number | null {
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0; let sxx = 0; let syy = 0
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i]! - my); sxx += (x - mx) ** 2; syy += (ys[i]! - my) ** 2 })
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

// 少於兩年的重疊月份不給相關係數（新類股或資料剛開始的類股）
const MIN_CORRELATION_MONTHS = 24
const round2 = (value: number) => Math.round(value * 100) / 100

export const getSectorCycleSummary = defineCachedFunction(
  async (): Promise<SectorCycleSummary> => {
    const [sectors, coincident] = await Promise.all([getSectors(), getBusinessCycleCoincident()])
    const rows: SectorCycleRow[] = []
    const months: string[] = []
    // 4 個一批，不一次 34 個並發（類股月營收冷查詢 1～2 秒）；讀不到的類股就不列
    for (let i = 0; i < sectors.length; i += 4) {
      const batch = await Promise.all(sectors.slice(i, i + 4).map(sector => getSectorMonthlyRevenue(sector.code).then(revenue => ({ sector, revenue }), () => null)))
      for (const item of batch) {
        if (!item) continue
        const { sector, revenue } = item
        const yoy = rollingThreeMonthYoy(revenue.entries)
        if (!yoy.length) continue
        months.push(yoy[0]!.yearMonth, yoy.at(-1)!.yearMonth)
        const paired = yoy.filter(point => point.yearMonth in coincident)
        const correlation = paired.length >= MIN_CORRELATION_MONTHS
          ? pearson(paired.map(point => point.value), paired.map(point => coincident[point.yearMonth]!))
          : null
        const sorted = [...yoy].sort((a, b) => a.value - b.value)
        const point = (p: { yearMonth: string; value: number }) => ({ yearMonth: p.yearMonth, value: round2(p.value) })
        rows.push({
          code: sector.code,
          name: sector.name,
          slug: sector.slug,
          companyCount: revenue.entries.at(-1)?.companyCount ?? 0,
          amplitude: round2(populationStdev(yoy.map(p => p.value))),
          correlation: correlation === null ? null : round2(correlation),
          months: correlation === null ? 0 : paired.length,
          lowest: point(sorted[0]!),
          highest: point(sorted.at(-1)!)
        })
      }
    }
    months.sort()
    return {
      sectors: rows,
      firstMonth: months[0] ?? null,
      lastMonth: months.at(-1) ?? null,
      indicatorLastMonth: Object.keys(coincident).sort().at(-1) ?? null
    }
  },
  { name: 'hub-sector-cycle-summary', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

interface RankingResponse {
  field: string
  direction: 'asc' | 'desc'
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

const RANKING_LIMIT = 50

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

// /industries 的類股股利統計（2026-09-30）。一次呼叫、34 個類股，不需要扇出。
export const getSectorDividendSummary = defineCachedFunction(
  async (): Promise<SectorDividendSummaryPageData> =>
    bffFetch<SectorDividendSummaryPageData>('/industries/sector-dividend-summary'),
  { name: 'hub-sector-dividend-summary', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)
