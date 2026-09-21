// 總經特區 的頁面註冊表（2026-09-22）— the macro counterpart of hub-slugs.ts's METRIC_PAGES.
//
// Every page in this zone answers the same question shape: one macro series（or two）read against
// 加權股價指數 over a shared time axis. That sameness is why they share one template and one
// registry rather than six near-identical route files — the same call METRIC_PAGES represents for
// the per-stock metric pages.
//
// /macro/policy-rate is NOT here. It is a different shape: discrete decision EVENTS drawn as a
// step line, not a continuous series, and its table has five columns of its own. It keeps its own
// route file, exactly as dividend.vue and margins.vue do among the stock pages.
export type MacroCadence = 'monthly' | 'quarterly'

export interface MacroSeriesSpec {
  // Field on each entry of the upstream response.
  key: string
  name: string
  lineType: 'solid' | 'dashed' | 'dotted'
  symbol: 'circle' | 'triangle' | 'rect'
  // Decimal places for this series' own numbers, default 2. 景氣對策信號分數 is an integer count of
  // signal points, and printing it as「41.00 分」invents a precision the NDC never published.
  decimals?: number
}

export interface MacroPageDefinition {
  slug: string
  // <h1> and the breadcrumb's last crumb.
  topic: string
  // <title> phrase. Budget is the same 32 CJK-equivalent characters check-hub-pages holds every
  // hub title to, minus「｜安盈選股」— verify per entry.
  titleKeywords: string
  // The bff path, including any fixed query this page always sends.
  endpoint: string
  cadence: MacroCadence
  // One or two series. Two is the 貨幣供給 case（M1B vs M2）, where the comparison BETWEEN them is
  // the content; everything else is a single line read against the index.
  series: MacroSeriesSpec[]
  unit: string
  // One sentence of page-specific caveat, rendered under the chart. Only where the DATA has a
  // property a reader would otherwise misread — not a place for commentary.
  caveat?: string
}

export const MACRO_PAGES: MacroPageDefinition[] = [
  // gov-ts's own ranking by explanatory power against the index, kept as the order here.
  {
    slug: 'business-cycle',
    topic: '景氣燈號',
    titleKeywords: '景氣對策信號分數與大盤',
    endpoint: '/macro/business-cycle-indicator',
    cadence: 'monthly',
    series: [{ key: 'signalScore', name: '景氣對策信號分數', lineType: 'solid', symbol: 'circle', decimals: 0 }],
    unit: '分',
    // The band boundaries are the National Development Council's own published thresholds, not
    // this app's: 9–16 藍, 17–22 黃藍, 23–31 綠, 32–37 黃紅, 38–45 紅. Stated because a bare score
    // of 41 means nothing without them.
    caveat: '分數區間由國家發展委員會定義：9～16 藍燈、17～22 黃藍燈、23～31 綠燈、32～37 黃紅燈、38～45 紅燈。'
  },
  {
    slug: 'money-supply',
    topic: '貨幣供給',
    titleKeywords: 'M1B 與 M2 年增率與大盤',
    endpoint: '/macro/monetary-aggregate',
    cadence: 'monthly',
    series: [
      { key: 'm1bYoyPercent', name: 'M1B 年增率', lineType: 'solid', symbol: 'circle' },
      { key: 'm2YoyPercent', name: 'M2 年增率', lineType: 'dashed', symbol: 'triangle' }
    ],
    unit: '%',
    caveat: '兩者皆為中央銀行以日平均餘額計算的年增率；1987 年的前 12 個月沒有年增率可算。'
  },
  {
    slug: 'bond-yield',
    topic: '10 年期公債殖利率',
    titleKeywords: '10 年期公債殖利率與大盤',
    endpoint: '/macro/gov-bond-yield-10y-history',
    cadence: 'monthly',
    series: [{ key: 'yieldPct', name: '10 年期公債殖利率', lineType: 'solid', symbol: 'circle' }],
    unit: '%'
  },
  {
    // interval=monthly is not a default this page could rely on: the endpoint shares
    // /market/taiex-daily-price's own contract（limit 250 / interval daily）, and daily caps at
    // 2000 rows which reaches only ~2018. Monthly returns all 415 rows back to 1992.
    slug: 'exchange-rate',
    topic: '新台幣兌美元匯率',
    titleKeywords: '新台幣兌美元匯率與大盤',
    endpoint: '/macro/usd-twd-rate?interval=monthly&limit=2000',
    cadence: 'monthly',
    series: [{ key: 'interbankClosingRate', name: '新台幣兌美元（收盤）', lineType: 'solid', symbol: 'circle' }],
    unit: '元',
    // Two things a reader gets wrong here if nobody says them, both flagged by gov-ts: the axis
    // direction, and the lag. Neither is commentary — they are properties of the number.
    caveat: '數字是 1 美元可兌換的新台幣元數，因此數字越小代表新台幣越強。此序列由中央銀行隨月報批次補登，約落後一個月，不是即時匯率。'
  },
  {
    slug: 'inflation',
    topic: '消費者物價年增率',
    titleKeywords: '消費者物價指數年增率與大盤',
    endpoint: '/macro/cpi?category=total',
    cadence: 'monthly',
    series: [{ key: 'yoyChangePercent', name: 'CPI 年增率', lineType: 'solid', symbol: 'circle' }],
    unit: '%',
    caveat: '此處為總指數（total）的年增率；消費者物價另有食物、衣著、居住等七大類，本頁未分拆。'
  },
  {
    // contributionPoints, NOT yoyChangePercent — and that is not a naming quirk to route around.
    // gov-ts checked the 主計總處 source table: on the growth_rate row contributionPoints IS the
    // growth rate in %（2026Q1 15.43 = 國內需求 4.84 + 國外淨需求 10.59）, while the old
    // yoyChangePercent was 主計總處 computing a year-on-year change OF a percentage-point figure,
    // meaningless on every category. analysis-ts removed that field at the source（7e4b4358）;
    // this entry was written against contributionPoints from the start either way.
    slug: 'gdp-growth',
    topic: '經濟成長率',
    titleKeywords: '經濟成長率與大盤',
    endpoint: '/macro/gdp?category=growth_rate',
    cadence: 'quarterly',
    series: [{ key: 'contributionPoints', name: '經濟成長率', lineType: 'solid', symbol: 'circle' }],
    unit: '%',
    caveat: '主計總處的經濟成長率為各需求項目貢獻百分點的加總，本頁顯示加總後的成長率本身。'
  }
]

export function findMacroPage(slug: string): MacroPageDefinition | null {
  return MACRO_PAGES.find(page => page.slug === slug) ?? null
}

export function macroPagePath(slug: string): string {
  return `/macro/${slug}`
}
