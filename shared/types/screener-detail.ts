// 篩選區兩種個別頁的資料形狀（2026-10-15 三組篩選重新設計）：ETF（/screener/etf/{代號}）與特別股（/screener/preferred/{代號}）。
// 伺服器端的 /api/etf/:code、/api/preferred/:code 回這個，頁面在 SSR 就有內容。

export type EtfValue = string | number | boolean | null

// GET /etfs/:symbol（業務中台 045159d）。values 是 /etf-screener/filters 的全部欄位；trackingIndex 主動式是 null
export interface EtfDetail {
  symbol: string
  fundName: string
  shortName: string
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
}

// GET /stocks/preferred-stocks 的一列（28 檔）
export interface PreferredStockEntry {
  symbol: string
  name: string
  isinCode: string | null
  listedDate: string | null
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
}

export interface PreferredPageResponse {
  stock: PreferredStockEntry
  quote: LatestClose | null
  // 實際配發的現金股息，依除息日的年份加總（投資人問的是「哪一年領到多少」）；null ＝ 讀不到這一檔的配息紀錄
  dividendsByYear: Record<string, number> | null
}
