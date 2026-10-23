import type { EquityRiskPremiumComponents, EquityRiskPremiumPageData, EquityRiskPremiumWindow, MacroPageData, MacroSeriesPoint, MarketEventDay, MarketEventMonth, MarketEventsPageData, TaiexPoint } from '#shared/types/hub'

// 總經特區（/macro/*）的資料：股權風險溢酬、大事件年表、總經序列頁，2026-10-08 從 hub-data.ts 拆出（2026-10-11 精簡：
// 只留對台股有顯著解釋力的項目，三個利率頁與五個序列頁刪除）。
// 同一套 defineCachedFunction 規則（businessFetch 丟錯就不快取、具名、stale-while-revalidate），TTL 常數沿用 hub-data 的。
// 加權指數月收盤只抓一次（cachedTaiexMonthly）：利率頁與總經序列頁畫的都是同一條線。

// 三個利率頁的資料（央行 2026-09-21、聯準會 09-29、歐洲央行 09-30）：政策利率事件＋加權指數月收盤，同一支快取函式、以來源為鍵；
// 事件型別各不相同（見 shared/types/hub.ts），三個 export 各自縮回正確的型別。
// 指數用月收盤不用日線：幾十年的利率循環不需要日線解析度（2026-10-08 量到 1990-01 起 442 列；建頁時是 1999-01 起 333 列），三頁共用同一份快取（hub-taiex-monthly）、畫的是
// 同一條線。利率事件一律取完整歷史（2026-09-29 更正：原本帶 from=2000-01-01，連表一起砍掉了——美國 186 筆少 111 筆、台灣少
// 1989–1999 的 21 筆）：表給完整歷史，圖只畫指數有值的那一段，差幾筆在圖的答句裡說。
// 8000：上游上限 2026-09-22 起（analysis-ts 113dd818 → 業務中台 91f5aec），月線用不到、日線 1999 起約 6,900 列也裝得下。
const TAIEX_LIMIT = 8000

// close 是字串（業務中台 市場資料的 Decimal 慣例），在這裡轉一次；轉不成的丟掉而不是留 NaN
const cachedTaiexMonthly = defineCachedFunction(
  async (): Promise<TaiexPoint[]> => {
    const taiex = await businessFetch<{ entries: { tradeDate: string; close: string | number }[] }>(
      `/market/taiex-daily-price?interval=monthly&limit=${TAIEX_LIMIT}`
    )
    return taiex.entries
      .map(entry => ({ tradeDate: entry.tradeDate, close: Number(entry.close) }))
      .filter(point => Number.isFinite(point.close))
  },
  { name: 'hub-taiex-monthly', maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
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
  supplySide: (EquityRiskPremiumComponents & { erp: number | null }) | null
}

// 殖利率法：殖利率 −（無風險利率 − 預期通膨）＝殖利率 − 實質無風險利率。四捨五入到四位，跟上游其他數字同精度
function dividendYieldErp(side: ErpResponse['supplySide']): number | null {
  if (!side || side.dividendYield === null || side.riskFreeRate === null || side.expectedInflation === null) return null
  return Math.round((side.dividendYield - (side.riskFreeRate - side.expectedInflation)) * 10000) / 10000
}

export const getEquityRiskPremium = defineCachedFunction(
  async (): Promise<EquityRiskPremiumPageData> => {
    const full = await businessFetch<ErpResponse>('/macro/equity-risk-premium')
    const [endYear, endMonth] = full.windowEnd.split('-').map(Number) as [number, number]
    const rest = await Promise.all(
      ERP_WINDOW_YEARS.map(years =>
        businessFetch<ErpResponse>(
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
      supplySideErp: response.supplySide?.erp ?? null,
      dividendYieldErp: dividendYieldErp(response.supplySide)
    })
    const { erp: _erp, ...components } = full.supplySide ?? { erp: null }
    return {
      windows: [
        toWindow('完整', full),
        ...rest.map((response, index) => toWindow(`${ERP_WINDOW_YEARS[index]} 年`, response))
      ],
      components: full.supplySide ? (components as EquityRiskPremiumComponents) : null
    }
  },
  { name: 'hub-equity-risk-premium', maxAge: TTL_DAILY, staleMaxAge: TTL_STATIC, swr: true }
)

// /macro/market-events 的一份資料 — 央行月報的加權指數月平均，事件本身是前端靜態資料。
//
// 央行月報（gov-ts export.monthly_stock_market_summary → analysis-ts 26174084 → 業務中台 25541bc）
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
// The two series must NEVER be stitched — analysis-ts and 業務中台 both carry that warning in their
// own OpenAPI docs, and the seam would invent a jump that never happened.
export const getMarketEvents = defineCachedFunction(
  async (): Promise<MarketEventsPageData> => {
    const [summary, daily] = await Promise.all([
      businessFetch<{ entries: { period: string; avgTaiex: string | number | null }[] }>('/macro/stock-market-summary'),
      // Daily alongside the monthly average — a different series with a different sensitivity, and
      // the page keeps them in separate lists. Fetched here rather than by the page so both halves
      // come from one cached call, same as every other page in this zone.
      businessFetch<{ entries: { tradeDate: string; close: string | number }[] }>(`/market/taiex-daily-price?interval=daily&limit=${TAIEX_LIMIT}`)
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
// The index is the monthly close, keyed by 'YYYY-MM' so it joins the series by period（2026-10-11 起只剩月頻頁，
// 季頻分支隨經濟成長率頁一起刪除）.
//
// One cached entry per slug, so a page and the sitemap read the same source and the index window
// can't differ between two macro pages.
export const getMacroPage = defineCachedFunction(
  async (slug: string): Promise<MacroPageData> => {
    const page = findMacroPage(slug)
    if (!page) throw createError({ statusCode: 404, statusMessage: 'unknown macro page' })

    const [source, taiex] = await Promise.all([
      businessFetch<{ entries: Record<string, unknown>[] }>(page.endpoint),
      cachedTaiexMonthly()
    ])

    const keys = page.series.map(spec => spec.key)
    // 月序列帶 `period`（YYYY-MM），是請 analysis-ts 組好的：每個用戶端各自拿 (year, month) 重組，就是每個用戶端各有一份同樣的 bug
    const series: MacroSeriesPoint[] = source.entries.map(entry => ({
      period: typeof entry.period === 'string' ? entry.period : '',
      values: Object.fromEntries(keys.map(key => {
        const raw = entry[key]
        const value = typeof raw === 'string' ? Number(raw) : raw
        return [key, typeof value === 'number' && Number.isFinite(value) ? value : null]
      }))
    })).filter(point => point.period.length > 0)

    const byPeriod = new Map<string, number>()
    // Later rows overwrite earlier ones and 業務中台 returns oldest-first, so each month keeps its month-end close
    for (const point of taiex) byPeriod.set(point.tradeDate.slice(0, 7), point.close)

    return {
      slug,
      series,
      taiex: [...byPeriod.entries()].map(([period, close]) => ({ period, close })).sort((a, b) => a.period.localeCompare(b.period))
    }
  },
  { name: 'hub-macro-page', getKey: slug => slug, maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)
