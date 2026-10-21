// 搬過家的舊網址一律 301（只比對舊網址的確切形狀，不用 routeRules 的 /**——那會連同層的其他頁一起轉走）：
//   - 特別股個別頁（2026-10-18）：/screener/preferred/{代號} → /preferred/{代號}。代號是四碼數字＋一個字母（2887Z1 再多一個字元），
//     /screener/preferred 篩選頁本身照舊
//   - 指標速覽（2026-10-18）：/stock/{代號}/quick-view → /stock/{代號}，速覽成為個股首頁
//   - ETF 個別頁（2026-10-18）：/screener/etf/{代號} → /etf/{代號}，個別頁拆成六個面向；/screener/etf 篩選頁本身照舊
//   - 個股總表（2026-10-21 拿掉，跟產業索引重複）：/stock → /industries。只比對 /stock 本身，/stock/{代號} 個股頁照舊
//   - ETF 與特別股走錯到個股頁（2026-10-21「從配息月曆 點選 00931B 會跑出 找不到這檔股票」）：/stock/{ETF 或特別股代號}（含底下的子頁）
//     → 它自己的頁（securityPath）。子頁不帶過去：ETF／特別股的面向跟個股的指標頁不是同一組
//   - 特別股專區（2026-10-18 同日拆掉，使用者：「我要的不是專區」）：/preferred 與五個比較頁 → /screener/preferred（28 檔的清單在那裡）
const REDIRECTS: [RegExp, (match: RegExpExecArray) => string][] = [
  [/^\/screener\/preferred\/(\d{4}[a-z][a-z0-9]?)\/?$/i, match => `/preferred/${match[1]!.toLowerCase()}`],
  [/^\/stock\/([^/]+)\/quick-view\/?$/, match => `/stock/${match[1]}`],
  [/^\/screener\/etf\/(\d{4,6}[a-z]?)\/?$/i, match => `/etf/${match[1]!.toLowerCase()}`],
  [/^\/stock\/?$/, () => '/industries'],
  [/^\/stock\/(00[^/]+|[^/]*[a-z][^/]*)(?:\/.*)?$/i, match => securityPath(match[1]!.toUpperCase())],
  [/^\/preferred(\/(yields|call-schedule|dividends|liquidity|terms))?\/?$/, () => '/screener/preferred']
]

export default defineEventHandler((event) => {
  const { pathname, search } = getRequestURL(event)
  for (const [pattern, target] of REDIRECTS) {
    const match = pattern.exec(pathname)
    if (match) return sendRedirect(event, `${target(match)}${search}`, 301)
  }
})
