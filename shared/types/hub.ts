// Response shapes of the /api/hub/* routes (server/api/hub/*.get.ts) and the datasets behind
// them (server/utils/hub-data.ts) — the market-wide pages added in the 2026-09-19 SEO build
// (個股總表 /stock, 類股頁 /industry/…, 排行 /rank/…, 條件說明 /screener/…, 指標說明 /metrics/…).

export interface HubSector {
  code: string
  name: string
  slug: string
  // 業務中台's own catalog count for the sector (GET /industries/securities-sectors).
  companyCount: number
}

export interface DirectoryCompany {
  symbol: string
  name: string
  // 興櫃。上游 GET /stocks 自己的欄位——興櫃股的代號同樣是四碼（6744、6748…），所以靠代號長度或
  // 市場別都認不出來，這是唯一可靠的判準。過濾與否由各頁自己決定，directory 只負責帶上來。
  isEmerging: boolean
}

export interface DirectorySector extends HubSector {
  companies: DirectoryCompany[]
}

// /api/hub/directory — every four-digit listed symbol grouped by 證交所類股 from GET /stocks'
// sectorCode (2026-09-19); `others` are the ~51 symbols 業務中台 lists under a non-industry code.
export interface MarketDirectory {
  sectors: DirectorySector[]
  others: DirectoryCompany[]
}

// One row of a sector's company table — POST /screener columns parsed to numbers on the server
// (業務中台 sends every value as a string), null when the value or the whole cell is missing.
export interface SectorCompanyRow {
  symbol: string
  name: string
  price: number | null
  peRatio: number | null
  pbRatio: number | null
  // 自算的近 12 個月現金股利殖利率（2026-10-24 起）；dividendYieldDate 是那一筆的資料日（最後成交日），類股統計用它判斷是不是現況
  dividendYield: number | null
  dividendYieldDate: string | null
  roe: number | null
  debtRatio: number | null
  // 股利 3 年成長率（2026-10-01）。加這一欄是為了讓產業頁畫得出公司版的散佈圖——軸跟
  // /industries/dividend 的類股版一樣（X 成長率、Y 殖利率），所以讀者從總覽點進來看到的是同一張
  // 圖換一個層級，不是另一種圖。走的是既有那一次 screener POST 多帶一個 column，沒有多一次請求。
  //
  // 全市場約 57% 的公司有值（需要連續三年的股利紀錄），所以 null 很常見、不是錯誤。
  dividendGrowthRate3y: number | null
  // 營收與淨利的近四季年增率（2026-10-09，產業成長座標圖）：同一次 screener POST 多帶兩欄，沒有多一次請求。
  revenueGrowthRate: number | null
  netIncomeGrowthRate: number | null
}

export interface SectorStat {
  // Number of rows with a value.
  count: number
  median: number | null
  q1: number | null
  q3: number | null
  // 箱型圖的鬚（2026-10-09）：取 10／90 百分位，不取最小最大——一家本益比 900 倍的公司會把整條軸壓扁。
  p10: number | null
  p90: number | null
}

// 類股頁的四個分布統計。**只算上市櫃**：2026-10-09 之前是在排除興櫃之前算的，跟表格的母體不一樣。
export interface SectorStats {
  peRatio: SectorStat
  pbRatio: SectorStat
  dividendYield: SectorStat
  roe: SectorStat
}

export interface SectorCompanies {
  code: string
  rows: SectorCompanyRow[]
  stats: SectorStats
  // Latest knowledgeDate among the daily (EOD/price) cells — the "as of" date of the table.
  quoteDate: string | null
  // Latest knowledgeDate among the fundamental (TTM/Q) cells.
  fundamentalsDate: string | null
}

// /api/hub/industry/:code — the sector's table plus the directory members that have no
// screener row yet (listed, but no financial metrics on this site).
// /industries/growth（2026-10-09）：每個類股的營收與淨利近四季年增率中位數，母體是上市櫃（不含興櫃）。
export interface SectorGrowthRow {
  code: string
  name: string
  slug: string
  revenueGrowthRate: SectorStat
  netIncomeGrowthRate: SectorStat
}

export interface SectorGrowthSummary {
  sectors: SectorGrowthRow[]
}

// /industries/cycle（2026-10-10，「讓用戶看出哪些產業屬於景氣循環股」）：每個類股兩個數字，都從類股月營收算——
// 近三個月累計年增率的標準差（起伏幅度，百分點）、與景氣同時指標（去趨勢）的相關係數。不貼標籤、不排序。
// 2026-10-21 起另帶逐月的年增率（熱度圖一列一個類股，使用者：「歷史變化是重要的」）
export interface SectorCycleRow {
  code: string
  name: string
  slug: string
  // 最新一個月有申報營收的家數
  companyCount: number
  amplitude: number | null
  correlation: number | null
  // 相關係數用到的月數（兩邊都有值的月份）
  months: number
  lowest: { yearMonth: string; value: number } | null
  highest: { yearMonth: string; value: number } | null
  // 近三個月累計營收年增率（%，小數一位），跟 SectorCycleSummary.months 一一對應，沒有值的月份是 null
  yoy: (number | null)[]
}

// 國家發展委員會認定的景氣收縮期：高峰的下一個月到谷底那個月（官方的收縮月數就是這樣數的）；to 是 null 代表還沒到谷底
export interface BusinessCyclePeriod {
  from: string
  to: string | null
}

// 國家發展委員會景氣指標的兩個去趨勢值（100＝長期趨勢），逐月，舊的在前。景氣時鐘（/macro）與
// /industries/cycle（只用同時指標）共用一份快取。
export interface BusinessCycleIndicatorPoint {
  period: string
  leading: number | null
  coincident: number | null
}

// 國家發展委員會認定的景氣循環基準日期（業務中台 GET /macro/business-cycle-reference-dates，2026-10-18 起；欄位照上游）。
// 年月是 "YYYY-MM"；尚未認定的階段是 null。supplementedFields 是 gov-ts 依國發會新聞稿補上的欄位名
export interface BusinessCycleReferenceCycle {
  cycleNo: number
  troughStart: string
  peak: string | null
  troughEnd: string | null
  expansionMonths: number | null
  contractionMonths: number | null
  totalMonths: number | null
  supplementedFields: string[]
}

// /api/hub/macro-business-cycle-clock：指標完整歷史＋循環表（讀不到循環表時是空陣列，時鐘照樣能看最近 24 個月）
export interface BusinessCycleClockData {
  points: BusinessCycleIndicatorPoint[]
  cycles: BusinessCycleReferenceCycle[]
}

export interface SectorCycleSummary {
  sectors: SectorCycleRow[]
  // 三個月累計年增率的第一個與最後一個月（頁面的「只涵蓋 N 年以來」讀這裡，不寫死）
  firstMonth: string | null
  lastMonth: string | null
  // 景氣同時指標的最新月份（通常比營收晚一個月）
  indicatorLastMonth: string | null
  // 熱度圖的月份軸（舊的在前）、對齊的景氣同時指標（去趨勢）、落在這段期間的景氣收縮期
  months: string[]
  coincident: (number | null)[]
  contractions: BusinessCyclePeriod[]
}

// /industries/sensitivity（2026-10-24，analysis-ts 806cd493、業務中台 413cf22 轉發）：景氣敏感度（詞彙表 businessCycleSensitivity，不叫 beta）
// ＝類股內各公司股價 12 個月報酬，對國發會景氣同時指標年增率（股價錯開 leadMonths 個月）做迴歸的斜率，每家至少 minMonths 個月；只給類股的
// 中位數與四分位（個股的解釋力太低）。sectors 依 rank 排好；從未算過時 computedAt 是 null、sectors 是空的；代碼不在代碼表上時 sectorName 是 null
export interface BusinessCycleSensitivity {
  computedAt: string | null
  coincidentIndexMonth: string | null
  window: { from: string; to: string } | null
  leadMonths: number
  minMonths: number
  taiex: number | null
  companyCount: number
  sectors: { sectorCode: string; sectorName: string | null; rank: number; count: number; median: number; q1: number; q3: number }[]
}

// 類股層的時間序列（2026-10-10，analysis-ts ae14be5e／業務中台 0e9a28a）。每一期只用那一期的值、排除興櫃；count 0 時 median
// 為 null 並帶 nullReason。類股成員是「今天的分類」，早期各期是現存公司的歷史。
export interface SectorMetricHistoryEntry {
  fiscalYear: number
  fiscalQuarter: number
  count: number
  median: number | null
  q1: number | null
  q3: number | null
  nullReason: string | null
}

export interface SectorMetricHistory {
  sectorCode: string
  sectorName: string
  metricCode: string
  timeframe: string
  entries: SectorMetricHistoryEntry[]
}

// 類股月營收：年增率只用「當月與去年同月都有營收」的同一批公司，兩個營收是千元字串。欄位名 2026-10-10 改成生態系統一詞彙
// （analysis-ts 40058581／業務中台 dcda99b；舊名 revenue／lastYearRevenue／yoyChangePercent 已棄用）。
export interface SectorMonthlyRevenueEntry {
  yearMonth: string
  currentMonthRevenue: string
  lastYearSameMonthRevenue: string
  yoyChangePct: number | null
  companyCount: number
}

export interface SectorMonthlyRevenue {
  sectorCode: string
  sectorName: string
  total: number
  hasMore: boolean
  entries: SectorMonthlyRevenueEntry[]
}

export const SECTOR_MARGIN_CODES = ['grossMargin', 'operatingMargin', 'netProfitMargin'] as const
export type SectorMarginCode = (typeof SECTOR_MARGIN_CODES)[number]

export interface IndustryPageData {
  sector: HubSector
  companies: SectorCompanies
  unranked: DirectoryCompany[]
  // 讀不到時是 null，頁面那兩段就不顯示（settle）
  revenueTrend: SectorMonthlyRevenue | null
  marginTrend: Record<SectorMarginCode, SectorMetricHistory | null>
  // 近三個月累計營收年增率（%，小數一位），鍵是月份（月營收圖畫這個；算法同 /industries/cycle）
  revenueYoy3m: Record<string, number>
  // 景氣同時指標（去趨勢，鍵是月份，只留營收有資料的區間；月營收表的一欄）與景氣收縮期（圖的灰底）（2026-10-21）；讀不到是 null
  businessCycle: { coincident: Record<string, number>; contractions: BusinessCyclePeriod[] } | null
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
  direction: 'asc' | 'desc'
  unit: string | null
  rows: RankingRow[]
  // ETF 排行才有：基金類型（上游 fundType）各自的前 50 檔，名次從 1 起算（排行頁的簡易篩選）
  groups?: { name: string; rows: RankingRow[] }[]
  // 全年數字的排行（RANK_PAGES 的 fullYear，例如總費用率）：值是哪一年的，表頭寫「2025 年總費用率」
  valueYear?: number | null
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

export interface TaiexPoint {
  // NOT guaranteed to be a weekday: Taiwan had Saturday trading sessions in 1999–2000, so the
  // monthly series opens on 1999-01-30, a Saturday（flagged by analysis-ts, verified in the live
  // response）. Nothing here may assume a Mon–Fri date.
  tradeDate: string
  // 業務中台 serialises every market-domain price as a STRING（their Decimal convention, documented
  // on TaiexDailyPriceEntry）— parsed once in the server route so no page has to remember.
  close: number
}

// /macro/market-events（大事件年表）— the index alone, monthly and daily. The EVENTS it joins against are
// static frontend data (shared/utils/market-events.ts), unlike every other page in this zone where
// both halves come from upstream; that asymmetry is the whole reason that file carries a written
// inclusion rule.
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
  // Daily closes, 1999-01 onwards（the endpoint's cap was lifted to 8000 rows on 2026-09-22 for
  // exactly this; it had held daily to 2018-07）. Carried for the 市場階段 page's second list: a
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
  // Keyed by the series' own field name（signalScore, m1bYoyPct, …）, since a page may draw one
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
// /macro/equity-risk-premium（股票風險溢酬, 2026-09-29）— analysis-ts 轉達的需求，上游端點是
// GET /macro/equity-risk-premium。
//
// 這一頁的內容是**同一個問題的幾種算法擺在一起**（2026-10-11 加了殖利率法，見 dividendYieldErp），不是一個數字：歷史法（加權指數的年化報酬減同期
// 公債殖利率）回頭看實際發生了什麼，供給面模型（Ibbotson & Chen 2003：通膨＋實質成長＋股利殖利率
// －無風險利率）從基本面推算。兩者在長窗口接近、短窗口差很多，而那個差異本身就是頁面要給的東西。
//
// 因此我們一次取四個窗口（完整／20／10／5 年）而不是給讀者一個切換器：現象要靠「四個並排」才看得
// 出來，一次只看一個窗口的讀者不會發現自己看到的是哪一種。四次上游呼叫、一個快取鍵。
export interface EquityRiskPremiumWindow {
  // 我們自己給的標籤（「完整」「20 年」…），不是上游欄位。
  label: string
  windowStart: string
  windowEnd: string
  months: number
  erpGeometric: number | null
  erpArithmetic: number | null
  // supplySide 整塊可以是 null（完全沒有重疊月份），erp 本身也可以是 null（上市公司有市值的不到
  // 90% 時上游不算）。兩種都要當作「沒有數字」處理，不能當 0。
  supplySideErp: number | null
  // 殖利率法（2026-10-11 使用者貼的定義「台股現金股利殖利率減去實質無風險利率」）：殖利率 −（無風險利率 − 預期通膨）。
  // 由同一個窗口的 supplySide 算，任一項 null 就是 null；等於供給面模型拿掉實質盈餘成長那一項。
  dividendYieldErp: number | null
}

export interface EquityRiskPremiumComponents {
  expectedInflation: number | null
  realEarningsGrowth: number | null
  // 固定為 0：估值擴張不是公司「供給」出來的報酬，所以 Ibbotson & Chen 的做法把它設成 0。
  peGrowth: number | null
  dividendYield: number | null
  riskFreeRate: number | null
  dividendYieldTradeDate: string | null
  dividendYieldCompanyCount: number | null
  dividendYieldMarketCapCoverage: number | null
}

export interface EquityRiskPremiumPageData {
  windows: EquityRiskPremiumWindow[]
  // 預設（完整）窗口的供給面組成。短窗口的組成不列——四組數字並排會把頁面變成一張比較表，而
  // 這一段要回答的是「這四個數字怎麼來的」，不是「它們在不同窗口差多少」。
  components: EquityRiskPremiumComponents | null
}

// /industries 的散佈圖（2026-09-30）— 每個證交所類股一個點：Y 軸是配息公司的平均殖利率、X 軸是
// 股利 3 年成長率的中位數。
//
// **兩軸各自有自己的 count，而且常常差很多**，因為它們是對不同子母體算的：綠能環保 46 家，殖利率
// 有值 38 家、成長率只有 5 家。兩軸都有值的涵蓋率中位數 60%、最低 10.9%。所以 count 一定要進畫面
// （點大小＋門檻），不能把 n=2 的點畫得跟 n=161 一樣。
//
// companyCount **不是** mean/median 的分母，各軸自己的 count 才是。拿它反推總額會算錯。
export interface SectorStatPair {
  count: number
  mean: number | null
  median: number | null
}

export interface SectorDividendSummary {
  sectorCode: string
  sectorName: string
  companyCount: number
  // 殖利率讀自算的那一軸（2026-10-25，analysis-ts 3abf17c0 新增；使用者選「全站改自算、沒配息算 0%」）：近 12 個月沒有配息紀錄的算 0，
  // 14 天內沒成交的不算。同一支端點還有交易所值的 dividendYield（詞彙表裡 dividendYield 專指交易所），這裡不讀
  liveCashDividendYield: SectorStatPair
  dividendGrowthRate3y: SectorStatPair
}

export interface SectorDividendSummaryPageData {
  // 殖利率取自哪一天的收盤價——殖利率是 EOD 口徑，不標日期讀者無從判斷新舊。
  liveCashDividendYieldTradeDate: string | null
  sectors: SectorDividendSummary[]
}

// 除權息月覽（/calendar/months，2026-10-21）。kind 是 null：不在 GET /securities 的三種裡（受益證券、ETN），不連結、只算進「全部」
export type ExDividendKind = 'common' | 'preferred' | 'etf'

export interface ExDividendRow {
  exDate: string
  symbol: string
  name: string
  kind: ExDividendKind | null
  exType: '息' | '權' | '權息'
  // 個股是每股現金股利、ETF 是每單位分配金額
  cash: number | null
  // 每股配幾股
  stockPerShare: number | null
  rightsOffering: boolean
  paymentDate: string | null
  announced: boolean
}

export interface ExDividendMonthCell {
  month: string
  // 還沒到的月份是去年同月（estimated）
  source: string
  estimated: boolean
  // 那個月有除權息的不重複代號數
  counts: Record<'all' | ExDividendKind, number>
}

export interface ExDividendMonthsPageData {
  year: number
  current: string
  cells: ExDividendMonthCell[]
  // 選定的月份與它的清單（試算月份是去年同月的清單）
  month: string
  rows: ExDividendRow[]
}
