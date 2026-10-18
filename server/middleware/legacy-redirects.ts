// 搬過家的舊網址一律 301（只比對舊網址的確切形狀，不用 routeRules 的 /**——那會連同層的其他頁一起轉走）：
//   - 特別股個別頁（2026-10-18）：/screener/preferred/{代號} → /preferred/{代號}。代號是四碼數字＋一個字母（2887Z1 再多一個字元），
//     /screener/preferred 篩選頁本身照舊
//   - 指標速覽（2026-10-18）：/stock/{代號}/quick-view → /stock/{代號}，速覽成為個股首頁
//   - ETF 個別頁（2026-10-18）：/screener/etf/{代號} → /etf/{代號}，個別頁拆成六個面向；/screener/etf 篩選頁本身照舊
//   - 特別股專區（2026-10-18 同日拆掉，使用者：「我要的不是專區」）：/preferred 與五個比較頁 → /screener/preferred（28 檔的清單在那裡）
const REDIRECTS: [RegExp, (match: RegExpExecArray) => string][] = [
  [/^\/screener\/preferred\/(\d{4}[a-z][a-z0-9]?)\/?$/i, match => `/preferred/${match[1]!.toLowerCase()}`],
  [/^\/stock\/([^/]+)\/quick-view\/?$/, match => `/stock/${match[1]}`],
  [/^\/screener\/etf\/(\d{4,6}[a-z]?)\/?$/i, match => `/etf/${match[1]!.toLowerCase()}`],
  [/^\/preferred(\/(yields|call-schedule|dividends|liquidity|terms))?\/?$/, () => '/screener/preferred']
]

export default defineEventHandler((event) => {
  const { pathname, search } = getRequestURL(event)
  for (const [pattern, target] of REDIRECTS) {
    const match = pattern.exec(pathname)
    if (match) return sendRedirect(event, `${target(match)}${search}`, 301)
  }
})
