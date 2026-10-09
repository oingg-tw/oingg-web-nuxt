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
  // 興櫃。上游 GET /stocks 自己的欄位——興櫃股的代號同樣是四碼（6744、6748…），所以靠代號長度或
  // market 值都認不出來，這是唯一可靠的判準。過濾與否由各頁自己決定，directory 只負責帶上來。
  isEmerging: boolean
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
  // 成長率欄位裡最新的 knowledgeDate（各公司財報期別不一，這是最晚的那一家）
  fundamentalsDate: string | null
}

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

// 三個利率頁共用的頁面資料：事件型別各不相同（見 UsRateCycleEvent／EcbRateCycleEvent 的說明），指數序列是同一份月收盤
export interface RateCyclePageData<E = RateCycleEvent> {
  events: E[]
  taiex: TaiexPoint[]
}

// /macro/us-policy-rate（2026-09-29）— 聯準會的版本。**刻意不跟 RateCycleEvent 共用型別**：兩份
// 資料的形狀是真的不同，不只是欄位換名字。台灣是三個具名利率（重貼現率／擔保放款融通／短期
// 融通），美國是一個目標區間的上下限，而且 2008-12-16 之前是單一目標、之後才是區間。gov-ts 的
// 建議（2026-09-29）是不要硬套共同形狀，因為那會把資訊壓掉——ECB 之後接進來也是三個具名利率，
// 但那三個跟台灣那三個意義不對應。共通的只有「生效日 ＋ 一個代表性利率 ＋ 變動幅度」。
export interface UsRateCycleEvent {
  effectiveDate: string
  // 目標區間。2008-12-16 起上下限不同（實測 33 筆）；在那之前 FOMC 設的是單一目標，上下限相等
  //（153 筆，最晚 2008-10-29），所以頁面要判斷相等與否再決定印一個數字還是一段區間。
  targetUpper: number
  targetLower: number
  // 相對前一筆的變動，基點。null 只有整個序列的第一筆（1982-09-27，前面沒有東西可以相減）。
  //
  // 沒有任何一筆是 0：上游的 parser 是對 FRED 的每日持平值做 diff，只有值改變才產生一列。所以
  // 這份是**升降息紀錄，不是每次 FOMC 會議的紀錄**——維持不變的會議根本不在資料裡，gov-ts 手上
  // 也沒有會議日期，想標也標不出來。頁面必須講清楚這件事。
  changeBp: number | null
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
// /macro/equity-risk-premium（股票風險溢酬, 2026-09-29）— analysis-ts 轉達的需求，上游端點是
// GET /macro/equity-risk-premium。
//
// 這一頁的內容是**同一個問題的兩種算法擺在一起**，不是一個數字：歷史法（加權指數的年化報酬減同期
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
  taiexRange: { min: string; max: string } | null
}

// /macro/ecb-policy-rate（2026-09-30）— 歐洲央行。跟美國那支一樣**不共用型別**：ECB 公布的是三個
// 具名利率（存款機制／主要再融資／邊際貸款），美國是一個目標區間的上下限，台灣是另外三個具名
// 利率而且意義不對應。gov-ts 的建議是不要硬套共同形狀，共通的只有「生效日＋一個代表利率＋幅度」。
export interface EcbRateCycleEvent {
  effectiveDate: string
  // 三個具名利率。2014–2022 之間存款機制利率是負的（實測 69 列裡 5 列），所以顯示不能假設非負。
  depositFacilityRate: number | null
  mainRefinancingRate: number | null
  marginalLendingRate: number | null
  // 2000-06-28 ~ 2008-10-14 的主要再融資利率是「最低投標利率」（變動利率標售），不是固定標售
  // 利率——實測 69 列裡 21 列。數字連續可畫，但欄位標示不能一律寫成同一個名字。
  mainRefinancingIsMinimumBid: boolean
  // 三支各自的變動幅度，基點。**0 是有意義的**：69 列裡 MRO 有 7 列是 0——那幾次 ECB 只調利率
  // 走廊的上下緣（存款機制或邊際貸款），主要再融資沒動。用 `changeBp !== 0` 過濾會把那 7 次真的
  // 調整整個吃掉。2000-06-28 更特別：三支都是 0，變的只有標售機制（旗標從 false 翻成 true）。
  depositFacilityChangeBp: number | null
  mainRefinancingChangeBp: number | null
  marginalLendingChangeBp: number | null
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
  dividendYield: SectorStatPair
  dividendGrowthRate3y: SectorStatPair
}

export interface SectorDividendSummaryPageData {
  // 殖利率取自哪一天的收盤價——殖利率是 EOD 口徑，不標日期讀者無從判斷新舊。
  dividendYieldTradeDate: string
  sectors: SectorDividendSummary[]
}
