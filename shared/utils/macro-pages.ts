// 總經特區 的頁面註冊表（2026-09-22）— the macro counterpart of hub-slugs.ts's METRIC_PAGES.
//
// Every page in this zone answers the same question shape: one macro series（or two）read against
// 加權股價指數 over a shared time axis. That sameness is why they share one template and one
// registry rather than six near-identical route files — the same call METRIC_PAGES represents for
// the per-stock metric pages.
//
// 2026-10-11 精簡（使用者「macro 精簡項目 只保留對股市有顯著解釋力的」）：實測 1990～2026 年，景氣燈號、
// 貨幣供給、匯率、CPI、經濟成長率對加權指數的同期或次年解釋力都未達多重檢定校正後的門檻（t≈3.2），刪除；
// 十年期公債殖利率的年變動對次年報酬 t=−3.0（n=30），也是股票風險溢酬的輸入，保留。舊網址直接 404。
// 有自己 route file 的總經頁：大事件年表、股票風險溢酬、景氣時鐘。
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
  // 一支序列對照加權指數（模板也能畫兩支，2026-10-11 貨幣供給頁刪除後目前沒有兩支的頁）。
  series: MacroSeriesSpec[]
  unit: string
}

export const MACRO_PAGES: MacroPageDefinition[] = [
  // gov-ts's own ranking by explanatory power against the index, kept as the order here.
  {
    slug: 'bond-yield',
    topic: '10 年期公債殖利率',
    titleKeywords: '10 年期公債殖利率與大盤',
    endpoint: '/macro/gov-bond-yield-10y-history',
    series: [{ key: 'yieldPct', name: '10 年期公債殖利率', lineType: 'solid', symbol: 'circle' }],
    unit: '%'
  },
]

export function findMacroPage(slug: string): MacroPageDefinition | null {
  return MACRO_PAGES.find(page => page.slug === slug) ?? null
}

export function macroPagePath(slug: string): string {
  return `/macro/${slug}`
}
