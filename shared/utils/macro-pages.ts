// 總經特區 的頁面註冊表（2026-09-22）— the macro counterpart of hub-slugs.ts's METRIC_PAGES.
//
// Every page in this zone answers the same question shape: one macro series（or two）read against
// 加權股價指數 over a shared time axis. That sameness is why they share one template and one
// registry rather than six near-identical route files — the same call METRIC_PAGES represents for
// the per-stock metric pages.
//
// 2026-10-11 精簡（使用者「macro 精簡項目 只保留對股市有顯著解釋力的」）：實測 1990～2026 年，景氣燈號、
// 貨幣供給、匯率、CPI、經濟成長率對加權指數的同期或次年解釋力都未達多重檢定校正後的門檻（t≈3.2），刪除；
// 10 年期公債殖利率的年變動對次年報酬 t=−3.0（n=30），也是股票風險溢酬的輸入，保留。舊網址直接 404。
// 有自己 route file 的總經頁：大事件年表、股票風險溢酬、景氣時鐘。
//
// 2026-11-23 加回來（使用者「那些總經相關的絕對算」、總經頁「不疊大盤」，2026-11-24 數據中台的端點上線）：政策利率、貨幣供給（含 M2 組成）、
// 匯率、CPI（含分項）、經濟成長率（含各需求項目）、失業率，當參考序列畫，不跟加權指數對照（10-11 刪掉的理由是對大盤沒有解釋力，這次不
// 宣稱有）。網址沿用刪掉前的。10 年期公債殖利率照舊對照大盤，另加長短天期利差
export interface MacroSeriesSpec {
  // Field on each entry of the upstream response.
  key: string
  name: string
  lineType: 'solid' | 'dashed' | 'dotted'
  symbol: 'circle' | 'triangle' | 'rect'
}

export interface MacroPageDefinition {
  slug: string
  // <h1> and the breadcrumb's last crumb.
  topic: string
  // <title> phrase. Budget is the same 32 CJK-equivalent characters check-hub-pages holds every
  // hub title to, minus「｜安盈選股」— verify per entry.
  titleKeywords: string
  // The 業務中台 path, including any fixed query this page always sends.
  endpoint: string
  // 一支或兩支序列（手機一張圖最多兩條線）
  series: MacroSeriesSpec[]
  unit: string
  // 對照加權指數：只有10 年期公債殖利率（2026-10-11 留下的理由）。其他頁是參考序列
  overlay?: true
  // 一季一點（經濟成長率）；其他是一月一點
  quarterly?: true
  // 定義段的幾句：數字是什麼、哪裡容易讀錯（落後多久、有沒有季節調整、會不會修正），不寫解讀
  guide?: string[]
  // 頁尾的出處
  source: string
}

export const MACRO_PAGES: MacroPageDefinition[] = [
  // gov-ts's own ranking by explanatory power against the index, kept as the order here.
  {
    slug: 'bond-yield',
    topic: '10 年期公債殖利率',
    titleKeywords: '10 年期公債殖利率與大盤',
    endpoint: '/macro/gov-bond-yield-10y-history',
    series: [{ key: 'yieldPct', name: '10 年期公債殖利率', lineType: 'solid', symbol: 'circle' }],
    unit: '%',
    overlay: true,
    source: '中央銀行（10 年期公債次級市場殖利率、商業本票 31～90 天次級市場利率）、臺灣證券交易所（加權股價指數）'
  },
  // 重貼現率是央行公告調整的日期（伺服器換成每月月底那天適用的利率），隔夜拆款利率是每月平均（數據中台 /macro/money-market-rates）
  {
    slug: 'policy-rate',
    topic: '政策利率',
    titleKeywords: '央行重貼現率與隔夜拆款利率',
    endpoint: '/macro/cbc-policy-rate',
    series: [
      { key: 'discountRate', name: '重貼現率', lineType: 'solid', symbol: 'circle' },
      { key: 'callLoanRate', name: '隔夜拆款利率', lineType: 'dashed', symbol: 'triangle' }
    ],
    unit: '%',
    guide: [
      '重貼現率是中央銀行對銀行融通資金的利率，央行理監事會決定調整，是台灣的政策利率；圖上每個月取月底那天適用的利率。',
      '金融業隔夜拆款利率是銀行之間互相借一天的利率，每月平均。央行調整政策利率之後，拆款利率通常跟著動，但兩者不會相等。'
    ],
    source: '中央銀行（重貼現率、金融業隔夜拆款加權平均利率）'
  },
  {
    slug: 'money-supply',
    topic: '貨幣供給',
    titleKeywords: 'M1B 與 M2 年增率、M2 組成',
    endpoint: '/macro/monetary-aggregate',
    series: [
      { key: 'm1bYoyPct', name: 'M1B 年增率', lineType: 'solid', symbol: 'circle' },
      { key: 'm2YoyPct', name: 'M2 年增率', lineType: 'dashed', symbol: 'triangle' }
    ],
    unit: '%',
    guide: [
      'M1B 是通貨淨額加上支票存款、活期存款與活期儲蓄存款；M2 是 M1B 再加上準貨幣（定期存款、外匯存款、郵政儲金等）。年增率是跟去年同月相比，由中央銀行以日平均餘額計算。',
      '1987 年的前 12 個月沒有去年同月可比，沒有年增率。'
    ],
    source: '中央銀行（貨幣總計數）'
  },
  // interval=monthly：每日匯率最多 2000 筆只到 2018 年左右，月資料 2000 筆涵蓋全部
  {
    slug: 'exchange-rate',
    topic: '新台幣兌美元匯率',
    titleKeywords: '新台幣兌美元匯率',
    endpoint: '/macro/usd-twd-rate?interval=monthly&limit=2000',
    series: [{ key: 'interbankClosingRate', name: '新台幣兌美元（收盤）', lineType: 'solid', symbol: 'circle' }],
    unit: '元',
    guide: [
      '數字是 1 美元可以換多少新台幣，所以數字越小代表新台幣越強。每月取最後一個營業日的銀行間收盤匯率。',
      '這份資料由中央銀行隨月報補登，約落後一個月，不是即時匯率。'
    ],
    source: '中央銀行（新台幣對美元銀行間收盤匯率）'
  },
  {
    slug: 'inflation',
    topic: '消費者物價年增率',
    titleKeywords: '消費者物價指數（CPI）年增率與分項',
    endpoint: '/macro/cpi?category=total',
    series: [{ key: 'yoyChangePct', name: 'CPI 年增率', lineType: 'solid', symbol: 'circle' }],
    unit: '%',
    guide: [
      '消費者物價指數（CPI）衡量一般家庭買的商品與服務的價格，年增率是跟去年同月相比。總指數下分食物、衣著、居住、交通及通訊、醫藥保健、教養娛樂、雜項七大類，各類再往下分項。',
      '主計總處每月上旬公布上個月的數字；這裡是未經季節調整的年增率。'
    ],
    source: '行政院主計總處（消費者物價指數）'
  },
  // 一季一點：GDP 那一類的實質年增率（數據中台 /macro/gdp-expenditures 的 realYoyChangePct）
  {
    slug: 'gdp-growth',
    topic: '經濟成長率',
    titleKeywords: '經濟成長率與各需求項目年增率',
    endpoint: '/macro/gdp-expenditures',
    series: [{ key: 'realYoyChangePct', name: '經濟成長率', lineType: 'solid', symbol: 'circle' }],
    unit: '%',
    quarterly: true,
    guide: [
      '經濟成長率是實質國內生產毛額（GDP）跟去年同季相比的成長率，已經扣掉物價變動。各需求項目（民間消費、政府消費、資本形成、輸出、輸入）的實質年增率也是跟去年同季相比。',
      '主計總處每一季先發布概估，之後會修正，所以最近幾季的數字可能還會變。'
    ],
    source: '行政院主計總處（國民所得統計：按支出分）'
  },
  {
    slug: 'unemployment',
    topic: '失業率',
    titleKeywords: '失業率（未經季節調整）',
    endpoint: '/macro/unemployment-rate',
    series: [{ key: 'ratePct', name: '失業率', lineType: 'solid', symbol: 'circle' }],
    unit: '%',
    guide: [
      '失業率是失業人口占勞動力（15 歲以上、有工作或正在找工作的人）的比率，每月一點。',
      '這裡是未經季節調整的數字：每年畢業季（6 到 8 月）通常會升高，跟前後月份比之前先看去年同月。'
    ],
    source: '行政院主計總處（人力資源調查）'
  }
]

export function findMacroPage(slug: string): MacroPageDefinition | null {
  return MACRO_PAGES.find(page => page.slug === slug) ?? null
}

export function macroPagePath(slug: string): string {
  return `/macro/${slug}`
}
