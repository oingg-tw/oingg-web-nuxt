import type { DividendFillEvent } from './dividend-history'

// 兩種個別頁的資料形狀（2026-10-15 三組篩選重新設計；2026-10-18 搬到 /etf/{代號}、/preferred/{代號}）。
// 伺服器端的 /api/etf/:code、/api/preferred/:code 回這個，頁面在 SSR 就有內容。

export type EtfValue = string | number | boolean | null

// GET /etfs/:symbol（業務中台 045159d）。values 是 /etf-screener/filters 的全部欄位；trackingIndex 主動式是 null
export interface EtfDetail {
  symbol: string
  fundName: string
  // 簡稱（發行投信是 issuerName）
  companyName: string
  issuerName: string
  category: string
  trackingIndex: string | null
  // 月報年月 YYYYMM
  yearMonth: string
  values: Record<string, EtfValue>
}

export interface EtfDistributionComposition {
  dividendIncomePct: number | null
  interestIncomePct: number | null
  incomeEqualizationPct: number | null
  realizedCapitalGainPct: number | null
  otherIncomePct: number | null
}

export interface EtfDistributionEvent {
  exDividendDate: string
  recordDate: string | null
  paymentDate: string | null
  distributionPerUnit: number | null
  status: string
  composition: EtfDistributionComposition | null
  distributionWarning: string | null
}

// GET /market/etf-distributions?symbol=
export interface EtfDistributions {
  symbol: string
  found: boolean
  trailing12MonthDistributionPerUnit: number | null
  trailing12MonthWindow: { start: string; end: string } | null
  events: EtfDistributionEvent[]
}

// 最新收盤價與漲跌（GET /stocks/:symbol/daily-price-history 的最後兩個有成交的交易日；報價端點不收 ETF 與特別股）
export interface LatestClose {
  tradeDate: string
  price: number
  change: number | null
  changePercent: number | null
}

export interface EtfPageResponse {
  etf: EtfDetail
  quote: LatestClose | null
  distributions: EtfDistributions | null
  // 2026-10-18 ETF 面向頁：每次配息的填息（同個股的 computeDividendFills）與每月成交。日線讀不到時兩者都是 null
  fills: DividendFillEvent[] | null
  liquidity: EtfLiquidityMonth[] | null
  // 第二批（2026-10-18）：每月快照歷史、每月折溢價、集保股權分散。讀不到是 null
  monthly: EtfMonthlyPoint[] | null
  premium: EtfPremiumMonth[] | null
  holders: EtfHolders | null
}

// GET /etfs/{代號}/monthly-history 的一列（定義同 /etfs/{代號}；2024-01 起）
export interface EtfMonthlyPoint {
  yearMonth: string
  aum: number | null
  holders: number | null
  netFlow: number | null
  dcaAmount: number | null
  marketShareRate: number | null
  nav: number | null
  statutoryAumThreshold: number | null
  belowStatutoryThreshold: boolean | null
}

// 每日折溢價（%）彙總成一個月
export interface EtfPremiumMonth {
  month: string
  tradingDays: number
  average: number
  highest: number
  lowest: number
}

// 集保股權分散：每週併成 5 組（畫圖），最新一週的 15 級原樣（表格）
export interface EtfHolders {
  weeks: { dataDate: string; groups: { name: string; holders: number; custodyPct: number }[] }[]
  latestLevels: { level: number; minShares: number | null; maxShares: number | null; holders: number; shares: number; custodyPct: number }[]
}

// 每個月的日均成交（舊到新）。成交金額不受分割影響（0050 2025-06 一拆四之後張數變四倍、金額不變），所以圖畫金額、表兩個都列
export interface EtfLiquidityMonth {
  month: string
  tradingDays: number
  averageDailyValue: number
  averageDailyLots: number
}

// GET /stocks/preferred-stocks 的一列（28 檔）
export interface PreferredStockEntry {
  symbol: string
  // 特別股簡稱（例「富邦特」）
  companyName: string
  isinCode: string | null
  listingDate: string | null
  marketType: string
  issueDate: string | null
  issuePrice: number | null
  // 每年股息（元）
  dividendRate: number | null
  nominalDividendRatePct: number | null
  currentYieldPct: number | null
  latestClosePrice: number | null
  latestPriceDate: string | null
  cumulativeDividend: boolean | null
  participatingExcessDividend: boolean | null
  liquidationPreference: boolean | null
  votingRights: boolean | null
  convertible: boolean | null
  conversionStartDate: string | null
  redeemable: boolean | null
  // 最早可以收回的日子（不是已經收回：上游提醒永遠不要寫「已贖回」）；收回條件是發行條件的原文
  redemptionDate: string | null
  redemptionConditions: string | null
  // 收回殖利率與它假設的收回時點（2026-10-18 特別股專區起用）：
  //   past_redemption_date_assumed_next_period 已過最早可收回日、還沒收回，假設下一期收回
  //   scheduled_redemption_date 最早可收回日還沒到
  //   no_scheduled_redemption_date_assumed_next_period 條款沒有寫收回日，假設下一期
  ytcPct: number | null
  ytcAssumption: string | null
  ytwPct: number | null
  premiumRatePct: number | null
  // 配息年數（數據中台 79ff406＋49dea86，2026-10-31）：完整年度從 max(上市隔年, 2020) 到去年，依除息日的年份、現金 > 0 就算有配。
  // 2020 起是因為 mops 的分派表那年才完整收集。還沒有完整年度的：觀察年數 0、起算年 null、沒配的年份空陣列
  cashDividendObservedYears: number
  cashDividendPaidYears: number
  cashDividendObservedFromYear: number | null
  cashDividendMissedYears: number[]
  // 發行公司的信用評等（數據中台 2f7b6f9，MOPS t191sb01）：每家機構最新公布的一筆，依機構名稱排序；沒有申報是空陣列。是發行公司的，不是這檔特別股的
  issuerCreditRatings: IssuerCreditRating[]
}

// 值都是 MOPS 原文：機構名稱不正規化（中英文、國際與台灣尺度並存）、沒有短期評等是 null 或「無」、展望中英文都有
export interface IssuerCreditRating {
  ratingAgency: string
  longTermRating: string | null
  shortTermRating: string | null
  outlook: string | null
  announcementDate: string
}

export interface PreferredPageResponse {
  stock: PreferredStockEntry
  quote: LatestClose | null
  // 實際配發的現金股息，依除息日的年份加總（投資人問的是「哪一年領到多少」）；null ＝ 讀不到這一檔的配息紀錄
  dividendsByYear: Record<string, number> | null
}

// ---- REITs 個別頁（2026-10-30，/reit/{代號}；資料是數據中台的 GET /reits/{symbol}、/daily-nav、/distributions，業務中台照轉）----

// GET /reits/{symbol}：基本資料、收益分配政策原文，加上總覽那幾個數字（同 GET /reits 的一列）
export interface ReitDetail {
  symbol: string
  // 簡稱；fundName 是全名
  companyName: string
  fundName: string | null
  trusteeName: string | null
  listingDate: string | null
  maturityDate: string | null
  totalIssueAmountNtd: number | null
  creditRating: string | null
  // 基本資料頁「收益分配」與它的「說明」原文
  distributionPolicy: string | null
  distributionNote: string | null
  close: number | null
  tradeDate: string | null
  nav: number | null
  navDate: string | null
  premiumDiscountPct: number | null
  trailing12MonthDistributionPerUnit: number | null
  trailing12MonthDistributionYieldPct: number | null
  trailing12MonthDistributionCount: number | null
  // 標的不動產（2026-10-30 數據中台 3a8fd18）
  properties: ReitProperty[]
}

// 標的不動產一筆：值都是公開資訊觀測站的原文（面積帶單位、估價金額含估價機構，note 可能是空字串）
export interface ReitProperty {
  name: string | null
  address: string | null
  propertyType: string | null
  floors: string | null
  area: string | null
  appraisalValue: string | null
  note: string | null
}

// /reits/{symbol}/daily-nav 每日一列，伺服器端併成每月一列（shared/utils/reit-nav.ts）
export type { ReitNavMonthRow as ReitNavMonth } from '../utils/reit-nav'

// /reits/{symbol}/distributions 一次分配（由新到舊）。yieldOnPreviousClose＝每單位分配 ÷ 除息前一個交易日的收盤（%，數據中台算好，同個股配息表的同名欄位）；
// distributionPerUnit 是公告原值、小數很長，顯示時自己取位
export interface ReitDistribution {
  exDividendDate: string
  recordDate: string | null
  paymentDate: string | null
  announcementDate: string | null
  distributionPerUnit: number | null
  yieldOnPreviousClose: number | null
}

export interface ReitPageResponse {
  reit: ReitDetail
  // 摘要卡的收盤價與漲跌（日線最後兩個有成交的交易日，同特別股）；讀不到用 reit.close、沒有漲跌
  quote: LatestClose | null
  // 讀不到是 null，不讓整頁失敗
  navMonths: import('../utils/reit-nav').ReitNavMonthRow[] | null
  distributions: ReitDistribution[] | null
}
