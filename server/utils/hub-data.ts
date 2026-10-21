import type { BusinessCycleIndicatorPoint, BusinessCyclePeriod, BusinessCycleReferenceCycle, DirectoryCompany, DirectorySector, ExDividendKind, ExDividendMonthCell, ExDividendRow, HubSector, MarketDirectory, RankingPageData, RankingRow, ScreenerTemplateSummary, ScreenerTemplateWithSlug, SectorCompanies, SectorCompanyRow, SectorCycleRow, SectorCycleSummary, SectorGrowthSummary, SectorMetricHistory, SectorMonthlyRevenue, SectorStat, SectorStats, SectorDividendSummaryPageData } from '#shared/types/hub'

// Market-wide datasets behind the hub pages（/stock 個股總表, /industry/…, /rank/…, /screener/…,
// /metrics）— 2026-09-19, the SEO build. 總經特區的資料在 macro-data.ts（2026-10-08 拆出）。 Same defineCachedFunction rules as stock-data.ts:
// businessFetch throws → nothing cached; explicit names; stale-while-revalidate. These are the
// single source for BOTH the /api/hub/* routes and the sitemap handler, so a page and the
// sitemap can never disagree about which sectors/rank pages exist.

export const TTL_DAILY = 6 * HOUR
export const TTL_STATIC = 24 * HOUR
const TTL_CATALOG = 1 * HOUR

// GET /industries/securities-sectors → the 36 exchange sectors this app has a slug for.
//
// CROSS-CHECKED AGAINST THE DIRECTORY（2026-09-23）, not taken from the catalog alone. The catalog's
// own `companyCount` disagrees with it: 業務中台 reports 32 companies under 13 電子工業（舊分類）,
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
      businessFetch<{ sectors: { sectorCode: string; sectorName: string; companyCount: number }[] }>('/industries/securities-sectors'),
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
      const known = SECTORS[sector.sectorCode]
      const companyCount = listedCounts.get(sector.sectorCode) ?? 0
      if (!known || companyCount <= 0) continue
      sectors.push({ code: sector.sectorCode, name: known.name, slug: known.slug, companyCount })
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

// GET /stocks（with market/sectorCode/sectorName since 業務中台 652eb68, 2026-09-19）paged in
// 1,000s → every four-digit symbol grouped by sector. The ~51 symbols 業務中台 files under a
// non-industry code（07/91/98/XX → sectorCode null）go to `others`.
export const getMarketDirectory = defineCachedFunction(
  async (): Promise<MarketDirectory> => {
    const bySector = new Map<string, DirectoryCompany[]>()
    const others: DirectoryCompany[] = []
    let offset = 0
    let total = Infinity
    let listed = 0
    while (offset < total) {
      const response = await businessFetch<StocksCollectionResponse>('/stocks', { query: { limit: STOCKS_PAGE_LIMIT, offset } })
      total = response.count
      if (!response.entries.length) break
      for (const entry of response.entries) {
        if (!LISTED_SYMBOL.test(entry.symbol)) continue
        listed += 1
        // isEmerging 帶上來但**不在這裡過濾**（2026-09-26「industry 請先不要顯示興櫃的公司」）：這份
        // directory 不只餵 /industry，在源頭砍掉會連帶改到沒被指名的頁面。哪一頁要不要顯示興櫃是那一頁
        // 自己的決定，資料在這裡備好就好。興櫃股的代號同樣是四碼（6744、6748…），所以 LISTED_SYMBOL
        // 那道正規表示式擋不掉它們——這個欄位是唯一可靠的判準。
        // name 可能是 null（業務中台 f750e92）：用代號頂上，產業頁表格與搜尋都假設它是字串
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
// 1,400–1,800 for the others）. Any page that includes stock.price is capped at 100 rows by 業務中台,
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
      const response = await businessFetch<ScreenerRunResponse>('/screener', {
        method: 'POST',
        body: {
          filters: [{ field: SECTOR_POPULATION_FIELD, min: null, max: null, exclude: false }],
          sectorCodes: [code],
          columns: SECTOR_COLUMNS,
          sortField: 'symbol',
          order: 'asc',
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
      businessFetch<SectorSummaryResponse>('/industries/sector-summary', { query: { fields: GROWTH_FIELDS.join(',') } }),
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

// 類股指標中位數逐期（產業頁三率走勢）。只收季報型指標，每股類上游回 400。個股指標頁的「跟同類股中位數比」2026-10-14 拿掉
//（指標頁一致性盤點，只有 5 頁有）。
export const getSectorMetricHistory = defineCachedFunction(
  (code: string, metricCode: string, timeframe: string, limit: number): Promise<SectorMetricHistory> =>
    businessFetch<SectorMetricHistory>(`/industries/${code}/metric-history`, { query: { metricCode, timeframe, limit } }),
  { name: 'hub-sector-metric-history', getKey: (code, metricCode, timeframe, limit) => `${code}:${metricCode}:${timeframe}:${limit}`, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 類股月營收（冷查詢 1～2 秒，上游建議快取）。抓到上游上限 132 個月（2026-10-10 業務中台與 analysis-ts 758a2b90 一起從
// 120 調上來）：使用者要的回補目標是 2016-01（國發會第 15 次循環起點 2016-02 之前），約 128 個月。回補到之前上游只有
// 60 個月（2021-09 起），多要的部分回空，hasMore:false。/industries/cycle 與類股頁的營收走勢都讀第一筆月份，沒寫死起點。
const SECTOR_REVENUE_MONTHS = 132
export const getSectorMonthlyRevenue = defineCachedFunction(
  (code: string): Promise<SectorMonthlyRevenue> =>
    businessFetch<SectorMonthlyRevenue>(`/industries/${code}/monthly-revenue-history`, { query: { limit: SECTOR_REVENUE_MONTHS } }),
  { name: 'hub-sector-monthly-revenue', getKey: code => code, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 國家發展委員會景氣指標的兩個去趨勢值（領先、同時），完整歷史（1982-01 起）。景氣時鐘頁與 /industries/cycle 共用。
// 放在 hub-data 而不是 macro-data：macro-data 載入時就要用這裡的 TTL 常數，反向引用會變成循環引用（2026-10-11 實測 500）。
// 不走 getMacroPage：那支只留頁面設定的 series 鍵，加鍵會讓景氣燈號頁多一條線。不用燈號分數：分數含股價指數，每年除息季會
// 機械性下滑（conductor 景氣對策信號文件 §2.2）——領先指標同樣含股價指數，景氣時鐘頁的注意事項有寫。
export const getBusinessCycleIndicators = defineCachedFunction(
  async (): Promise<BusinessCycleIndicatorPoint[]> => {
    const response = await businessFetch<{ entries: { period: string; leadingIndexDetrended: number | string | null; coincidentIndexDetrended: number | string | null }[] }>('/macro/business-cycle-indicator')
    const num = (value: number | string | null) => (value === null ? null : Number.isFinite(Number(value)) ? Number(value) : null)
    return response.entries.map(entry => ({ period: entry.period, leading: num(entry.leadingIndexDetrended), coincident: num(entry.coincidentIndexDetrended) }))
  },
  { name: 'hub-business-cycle-indicators', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 國家發展委員會景氣循環基準日期（業務中台 219abbc 轉發 analysis-ts，2026-10-18）。景氣時鐘頁的時段選單與循環表
export const getBusinessCycleReferenceDates = defineCachedFunction(
  async (): Promise<BusinessCycleReferenceCycle[]> => {
    const response = await businessFetch<{ entries: BusinessCycleReferenceCycle[] }>('/macro/business-cycle-reference-dates')
    return response.entries.map(({ cycleNo, troughStart, peak, troughEnd, expansionMonths, contractionMonths, totalMonths, supplementedFields }) =>
      ({ cycleNo, troughStart, peak, troughEnd, expansionMonths, contractionMonths, totalMonths, supplementedFields: supplementedFields ?? [] }))
  },
  { name: 'hub-business-cycle-reference-dates', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

const previousMonth = (yearMonth: string, back: number): string => {
  const [year, month] = yearMonth.split('-').map(Number) as [number, number]
  const index = year * 12 + month - 1 - back
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

// 國發會認定的景氣收縮期，只留跟 [first, last] 重疊的。從高峰的下一個月算到谷底：官方的收縮月數就是這樣數的（第 15 次循環
// 2022-02～2023-04，15 個月）；還沒到谷底的 to 是 null。/industries/cycle 的熱度圖與類股頁的營收圖共用（2026-10-21）。
// 擴張期同一天加過又拿掉（使用者：「原來是這樣認定 那還是把 擴張期拿掉吧」）：收縮期以外的月份都是擴張期，標出來只是多一層字
export function contractionPeriods(cycles: BusinessCycleReferenceCycle[], first: string, last: string): BusinessCyclePeriod[] {
  return cycles.flatMap(cycle => (cycle.peak ? [{ from: previousMonth(cycle.peak, -1), to: cycle.troughEnd }] : []))
    .filter(period => period.from <= last && (period.to ?? last) >= first)
}

// 近三個月累計營收年增率（%）：三個月營收加總 ÷ 去年同三個月加總 − 1。單月年增率會被農曆年落在一月或二月拉成暴衝，
// 三個月累計把它攤平。缺任一個月就不算。上游每月用「兩年都有申報的同一批公司」，三個月的家數可能差一兩家，誤差可忽略。
// /industries/cycle 的熱度圖與類股頁的月營收圖（2026-10-21）共用這一份算法
export function rollingThreeMonthYoy(entries: SectorMonthlyRevenue['entries']): { yearMonth: string; value: number }[] {
  const byMonth = new Map(entries.map(entry => [entry.yearMonth, entry]))
  return entries.flatMap(entry => {
    const window = [0, 1, 2].map(back => byMonth.get(previousMonth(entry.yearMonth, back)))
    if (window.some(month => !month)) return []
    const revenue = window.reduce((sum, month) => sum + Number(month!.currentMonthRevenue), 0)
    const lastYear = window.reduce((sum, month) => sum + Number(month!.lastYearSameMonthRevenue), 0)
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
    // 基準日期讀不到只是少了收縮期的標示，不讓整頁失敗
    const [sectors, indicators, cycles] = await Promise.all([getSectors(), getBusinessCycleIndicators(), settle(getBusinessCycleReferenceDates())])
    // 對照序列：景氣同時指標（去趨勢）。期別當鍵的普通物件（快取是 JSON，不能放 Map）
    const coincident: Record<string, number> = Object.fromEntries(indicators.flatMap(point => (point.coincident === null ? [] : [[point.period, point.coincident]])))
    const rows: SectorCycleRow[] = []
    // 熱度圖一列一個類股：逐月的年增率先按類股收起來，月份軸等全部類股讀完才知道
    const seriesByCode = new Map<string, Map<string, number>>()
    // 4 個一批，不一次 34 個並發（類股月營收冷查詢 1～2 秒）；讀不到的類股就不列
    for (let i = 0; i < sectors.length; i += 4) {
      const batch = await Promise.all(sectors.slice(i, i + 4).map(sector => getSectorMonthlyRevenue(sector.code).then(revenue => ({ sector, revenue }), () => null)))
      for (const item of batch) {
        if (!item) continue
        const { sector, revenue } = item
        const yoy = rollingThreeMonthYoy(revenue.entries)
        if (!yoy.length) continue
        seriesByCode.set(sector.code, new Map(yoy.map(p => [p.yearMonth, Math.round(p.value * 10) / 10])))
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
          highest: point(sorted.at(-1)!),
          yoy: []
        })
      }
    }
    const months = [...new Set([...seriesByCode.values()].flatMap(series => [...series.keys()]))].sort()
    for (const row of rows) row.yoy = months.map(month => seriesByCode.get(row.code)!.get(month) ?? null)
    const [first, last] = [months[0], months.at(-1)]
    return {
      sectors: rows,
      firstMonth: first ?? null,
      lastMonth: last ?? null,
      indicatorLastMonth: Object.keys(coincident).sort().at(-1) ?? null,
      months,
      coincident: months.map(month => (month in coincident ? round2(coincident[month]!) : null)),
      contractions: first && last ? contractionPeriods(cycles ?? [], first, last) : []
    }
  },
  { name: 'hub-sector-cycle-summary', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

interface RankingResponse {
  field: string
  order: 'asc' | 'desc'
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
    ...(spec.sortField ? { sortField: spec.sortField, order: definition.direction } : {}),
    pageSize: SCREENER_PAGE_SIZE
  }
  const first = await businessFetch<ScreenerRunResponse>('/screener', { method: 'POST', body: { ...body, page: 1 } })
  const results = [...first.results]
  // derivedMinus 的排序值算不出來在伺服器端，所以要全抓；sortField 的頁面第一頁就是答案。
  if (spec.derivedMinus) {
    const pages = Math.min(first.totalPages ?? 1, SCREENER_MAX_PAGES)
    for (let page = 2; page <= pages; page++) {
      const next = await businessFetch<ScreenerRunResponse>('/screener', { method: 'POST', body: { ...body, page } })
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

// ETF 的排行（2026-10-21）：ETF 篩選同一支 POST /etf-screener，依一個欄位排序，去掉沒有值的取前 50。
// 上游的 ETF 篩選結果不帶日期：基金月報的欄位用第一名的月報月份（每檔 ETF 頁同一支 /etfs/{代號}），其他欄位不寫日期。
// 基金類型的簡易篩選（同日，使用者：「總費用率 rank要給簡易篩選 因為債券明顯費用率比較低」；實測總費用率前 50 檔有 43 檔債券）：
// groups 是每一類自己的前 50 檔、名次從 1 起算，所以全部 ETF 都要拿（約 340 檔，上游每頁最多 200）。類型照上游 fundType（投信投顧公會
// 基金類型的第二層，analysis-ts 8dad5785、業務中台 6db5156，2026-10-21 上 DEV），跟 ETF 篩選的「基金類型」同一組。原本用 assetClass：
// 那是上市／上櫃的掛牌分類，上市的 9 檔債券 ETF 被歸在「國外成分證券」（使用者：「請業務中台提供真正的資產類型欄位」）；assetClass
// 上游 2026-11-04 移除
const ETF_PAGE_SIZE = 200
// 每份排行的選項順序都一樣，照上游型錄的列法；上游新增的類型排最後
const ETF_FUND_TYPE_ORDER = ['股票型', '債券型', '槓桿型／反向型', '平衡型', '不動產證券化／其他']

async function runEtfRanking(definition: RankPageDefinition): Promise<RankingPageData> {
  type EtfResult = { symbol: string; shortName: string; values: Record<string, string | number | boolean | null> }
  const results: EtfResult[] = []
  for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
    const response = await businessFetch<{ totalPages: number; results: EtfResult[] }>('/etf-screener', {
      method: 'POST',
      body: { columns: [{ field: definition.field }, { field: 'fundType' }], sortField: definition.field, order: definition.direction, page, pageSize: ETF_PAGE_SIZE }
    })
    results.push(...response.results)
    totalPages = response.totalPages
  }
  const ranked = results
    .map(result => ({ result, value: parseDecimal(result.values[definition.field] as string | number | null) }))
    .filter((entry): entry is { result: EtfResult; value: number } => entry.value !== null)
  const toRows = (entries: typeof ranked): RankingRow[] => entries.slice(0, RANKING_LIMIT)
    .map((entry, index) => ({ rank: index + 1, symbol: entry.result.symbol, name: entry.result.shortName, value: entry.value, knowledgeDate: null }))
  const rows = toRows(ranked)
  const typeOrder = (name: string) => (ETF_FUND_TYPE_ORDER.includes(name) ? ETF_FUND_TYPE_ORDER.indexOf(name) : ETF_FUND_TYPE_ORDER.length)
  const groups = [...new Set(ranked.map(entry => entry.result.values.fundType).filter((name): name is string => typeof name === 'string'))]
    .sort((a, b) => typeOrder(a) - typeOrder(b))
    .map(name => ({ name, rows: toRows(ranked.filter(entry => entry.result.values.fundType === name)) }))
  // 直接打 /etfs/{代號}，不用 screener-data.ts 的 cachedEtf：那個檔案讀這裡的 TTL_STATIC，互相 import 時模組初始化順序會撞
  //（Cannot access 'TTL_STATIC' before initialization，2026-10-21 量到）；整份排行本來就快取，多一次呼叫一天一次
  const leader = (definition.monthlyReport || definition.fullYear) && rows[0] ? await businessFetch<{ yearMonth?: string; values?: Record<string, unknown> }>(`/etfs/${rows[0].symbol}`) : null
  const reportMonth = definition.monthlyReport ? String(leader?.yearMonth ?? '') : ''
  // 全年數字（總費用率）：第一名有值的最近一年（上游：「expenseRatio 只用最新一個完整年度」），跟排行用的值對得上才標，不猜
  const leaderValues = leader?.values ?? {}
  const latestYear = Math.max(0, ...Object.keys(leaderValues)
    .filter(key => key.length === definition.field.length + 4 && key.startsWith(definition.field) && /\d{4}$/.test(key) && typeof leaderValues[key] === 'number')
    .map(key => Number(key.slice(-4))))
  const valueYear = definition.fullYear && latestYear && leaderValues[`${definition.field}${latestYear}`] === leaderValues[definition.field] ? latestYear : null
  return {
    slug: definition.slug,
    field: definition.field,
    direction: definition.direction,
    metricName: definition.label,
    fieldName: '',
    unit: definition.unit ?? null,
    rows,
    groups,
    valueYear,
    asOf: /^\d{6}$/.test(reportMonth) ? `${reportMonth.slice(0, 4)}-${reportMonth.slice(4)}` : null
  }
}

// GET /screener/ranking — the 50-row market-wide ordering behind one /rank/{slug} page.
export const getRanking = defineCachedFunction(
  async (slug: string): Promise<RankingPageData> => {
    const definition = findRankPage(slug)
    if (!definition) throw new Error(`unknown rank page "${slug}"`)
    if (definition.universe === 'etf') return runEtfRanking(definition)
    if (definition.screener) return runScreenerRanking(definition)
    const floor = definition.growthBaseFloor
    const response = await businessFetch<RankingResponse>('/screener/ranking', {
      // `columns` 讓同一次呼叫多帶一個欄位（實測 2026-10-01 可用），所以基期門檻不需要第二次往返。
      query: { field: definition.field, order: definition.direction, limit: RANKING_LIMIT, ...(floor ? { columns: floor.valueField } : {}) }
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

// GET /metrics — the whole catalog, passed through untyped: the app types it as MetricCatalog
// (useFilterSchema.ts) and the server never reads into it.
export const getMetricsCatalog = defineCachedFunction(
  () => businessFetch<{ categories: unknown[] }>('/metrics'),
  { name: 'hub-metrics-catalog', maxAge: TTL_CATALOG, staleMaxAge: TTL_STATIC, swr: true }
)

// useFilterSchema 讀的精簡目錄（2026-10-16，/api/hub/filter-schema）。整份目錄序列化進頁面 payload 有 271 KB（個股頁 payload 的 92%），
// 帶它的頁面卻只讀到其中一部分：limitations／misreadings 這類長文字只有 /learn、/rank 會畫，它們讀完整的（/api/hub/metrics）。
// 白名單不是黑名單：上游之後加的欄位不會悄悄把每一頁撐大；值是 null 的鍵也不帶（devalue 每個物件的每個鍵都寫一次）。
// 這裡留的每個欄位都有呼叫端在讀，要用新的欄位先加進這張清單。同一份上游資料：上游一小時只抓一次
type LooseRecord = Record<string, unknown>
const pickKeys = (source: LooseRecord, keys: readonly string[]) =>
  Object.fromEntries(keys.filter(key => source[key] != null).map(key => [key, source[key]]))

export const getFilterSchemaCatalog = defineCachedFunction(
  async () => {
    const catalog = await getMetricsCatalog()
    return {
      categories: (catalog.categories as LooseRecord[]).map(category => ({
        ...pickKeys(category, ['key', 'name', 'sort']),
        metrics: (category.metrics as LooseRecord[]).map((metric) => {
          const badge = metric.badge as LooseRecord | null | undefined
          return {
            // formulaLatex 不帶：公式改由 getFormulaHtml 在伺服器排好（/api/hub/formula/[key]），瀏覽器用不到原始 LaTeX
            ...pickKeys(metric, ['key', 'name', 'nameSuffix', 'nameEn', 'unit', 'sort', 'description', 'referenceUrl', 'sources', 'kind', 'options', 'conditionOnly', 'hasProvenance']),
            fields: (metric.fields as LooseRecord[]).map(field => pickKeys(field, ['key', 'name', 'period', 'description', 'aliases', 'unit', 'sort'])),
            ...(badge
              ? {
                  badge: {
                    ...pickKeys(badge, ['name', 'nameEn', 'nameSuffix', 'author', 'summary', 'timeframe', 'detail', 'sourceUrl']),
                    threshold: pickKeys(badge.threshold as LooseRecord, ['description', 'denominator', 'percentileRank', 'allPositiveFieldIds'])
                  }
                }
              : {})
          }
        })
      }))
    }
  },
  { name: 'hub-filter-schema', maxAge: TTL_CATALOG, staleMaxAge: TTL_STATIC, swr: true }
)

// 一個指標的公式，在伺服器用 KaTeX 排好的 HTML（2026-10-16，/api/hub/formula/[key]）：瀏覽器不必載入 KaTeX。顯示模式，
// 跟原本三個呼叫端（新手專區、兩種徽章對話框）一樣。呼叫端先驗過 metricKey 的字元，任意字串不會變成快取鍵
export const getFormulaHtml = defineCachedFunction(
  async (metricKey: string): Promise<string | null> => {
    const catalog = await getMetricsCatalog()
    for (const category of catalog.categories as LooseRecord[]) {
      const metric = (category.metrics as LooseRecord[]).find(item => item.key === metricKey)
      if (metric) return renderFormulaHtml(metric.formulaLatex as string | null, true)
    }
    return null
  },
  { name: 'hub-formula', getKey: (metricKey: string) => metricKey, maxAge: TTL_CATALOG, staleMaxAge: TTL_STATIC, swr: true }
)

// GET /screener/templates（public）with this app's URL slug attached by template NAME.
export const getScreenerTemplates = defineCachedFunction(
  async (): Promise<ScreenerTemplateWithSlug[]> => {
    const response = await businessFetch<{ templates: ScreenerTemplateSummary[] }>('/screener/templates')
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
    const response = await businessFetch<ScreenerRunResponse>('/screener', {
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
    businessFetch<SectorDividendSummaryPageData>('/industries/sector-dividend-summary'),
  { name: 'hub-sector-dividend-summary', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// ---- 除權息月覽（/calendar/months，2026-10-21）----

interface ExDividendCalendarEntry {
  symbol: string
  companyName: string | null
  securityType: string | null
  status: 'announced' | 'realized'
  exDate: string
  exType: ExDividendRow['exType']
  cashDividend: number | null
  distributionPerUnit: number | null
  stockDividendRatio: number | null
  subscriptionRatio: number | null
  paymentDate: string | null
}

// 上游的分類（analysis-ts 8b4c5f69）：特別股是 PREFERRED（含已收回的）；預告列裡不在 GET /securities 的（01007T 受益證券、020036 ETN）是 null
const EX_DIVIDEND_KINDS: Record<string, ExDividendKind> = { COMMON: 'common', PREFERRED: 'preferred', ETF: 'etf' }

// 一個月的全市場除權息（業務中台轉發 analysis-ts GET /stocks/ex-dividend-calendar；realized 是公開資訊觀測站的分派公告，announced 是證交所、
// 櫃買中心的預告）。依除權息日、代號排序
export const getExDividendMonth = defineCachedFunction(
  async (month: string): Promise<ExDividendRow[]> => {
    const response = await businessFetch<{ entries: ExDividendCalendarEntry[] }>('/stocks/ex-dividend-calendar', { query: { month } })
    return response.entries
      .map(entry => ({
        exDate: entry.exDate,
        symbol: entry.symbol,
        name: entry.companyName ?? entry.symbol,
        kind: EX_DIVIDEND_KINDS[entry.securityType ?? ''] ?? null,
        exType: entry.exType,
        cash: entry.distributionPerUnit ?? entry.cashDividend,
        stockPerShare: entry.stockDividendRatio,
        rightsOffering: !!entry.subscriptionRatio,
        paymentDate: entry.paymentDate,
        announced: entry.status === 'announced'
      }))
      .sort((a, b) => a.exDate.localeCompare(b.exDate) || a.symbol.localeCompare(b.symbol))
  },
  { name: 'hub-ex-dividend-month', getKey: (month: string) => month, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 每個月有幾檔除權息（業務中台 00329e4 轉發 analysis-ts GET /stocks/ex-dividend-calendar/monthly-counts，跟行事曆同一批列、同一個分類；
// 兩端都含，最多 24 個月）。unclassified ＝ securityType 是 null
const getExDividendMonthlyCounts = defineCachedFunction(
  async (from: string, to: string) =>
    (await businessFetch<{ months: { month: string; common: number; preferred: number; etf: number; unclassified: number }[] }>('/stocks/ex-dividend-calendar/monthly-counts', { query: { from, to } })).months,
  { name: 'hub-ex-dividend-monthly-counts', getKey: (from: string, to: string) => `${from}:${to}`, maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// 今年 12 個月各有幾檔除權息。還沒到的月份（current 之後）整個月用去年同月試算（使用者：「今年日期未到的才用去年模擬試算」）；這個月用今年的實際資料，
// 含已公告、還沒除息的。一次讀去年 1 月到今年 12 月
export async function getExDividendMonthCells(current: string): Promise<ExDividendMonthCell[]> {
  const year = Number(current.slice(0, 4))
  const byMonth = new Map((await getExDividendMonthlyCounts(`${year - 1}-01`, `${year}-12`)).map(entry => [entry.month, entry]))
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`
    const estimated = month > current
    const source = estimated ? `${year - 1}${month.slice(4)}` : month
    const { common = 0, preferred = 0, etf = 0, unclassified = 0 } = byMonth.get(source) ?? {}
    return { month, source, estimated, counts: { all: common + preferred + etf + unclassified, common, preferred, etf } }
  })
}
