// 全站每一種頁面模板的代表網址（2026-10-18 從 check-layout-shift.mjs 抽出，lighthouse-check.mjs 的「全站」組也用這一份）。
// 動態頁各挑一個有資料的代號；個股頁的固定子頁全列、ETF、特別股與類股的每個面向全列。新增頁面模板時加在這裡，兩支檢查一起涵蓋。
import { INDUSTRY_FACETS } from '../shared/utils/hub-slugs.ts'

const STOCK_FIXED = ['/profile', '/holders', '/insider-transfers', '/investments', '/guarantees', '/news', '/announcements', '/margin-trading', '/institutional-trades', '/dividend', '/dividend-fill', '/margins', '/solvency', '/dupont', '/cash-cycle', '/receivables-aging', '/non-operating-composition', '/equity-source', '/equity-composition',
  '/cash-flow-composition', '/operating-expense-composition', '/shareholder-yield-composition', '/current-asset-composition',
  '/non-current-asset-composition', '/intangible-assets', '/debt-composition', '/monthly-revenue', '/monthly-revenue-growth', '/metrics', '/financial-statements', '/balance-sheet',
  '/income-statement', '/cash-flow-statement']
const ETF_FACETS = ['', '/distributions', '/distribution-composition', '/distribution-fill', '/expenses', '/returns', '/size', '/premium-discount', '/liquidity', '/holders', '/profile']
export const ALL_ROUTES = [
  '/', '/stock/2330', '/stock/2330/roe', '/stock/2330/pe-ratio', '/stock/2330/eps', '/stock/7711/shareholder-yield',
  // 銀行與金控的版本（2026-11-20）：財報三率只畫純益率，淨收益組成只有它們有
  '/stock/2881/margins', '/stock/2881/net-revenue-composition', '/stock/2881/asset-composition', '/stock/2881/debt-composition',
  ...STOCK_FIXED.map(path => `/stock/2330${path}`),
  ...ETF_FACETS.map(path => `/etf/0050${path}`), '/etf/00400a',
  '/preferred/2881a', '/preferred/2881a/redemption', '/preferred/2881a/dividends', '/preferred/2881a/terms',
  '/reit/01001t', '/reit/01001t/nav', '/reit/01001t/liquidity', '/reit/01001t/holders', '/reit/01001t/distributions', '/reit/01001t/properties', '/reit/01001t/profile',
  '/screener/common', '/screener/common?template=value', '/screener/etf', '/screener/preferred', '/screener/reits',
  '/macro', '/macro?cycle=15', '/macro/equity-risk-premium', '/macro/market-events', '/macro/bond-yield',
  '/industries', '/industries/cycle', '/industries/dividend', '/industries/growth', ...INDUSTRY_FACETS.map(facet => `/industry/24-semiconductor${facet.suffix}`),
  '/rank', '/rank/dividend-yield', '/learn', '/learn/dupont', '/learn/dividend-source/2330', '/blog', '/blog/low-pe-ratio-trap-cyclical-stocks',
  // /holdings/columns 2026-11-01 先隱藏（導回 /holdings），恢復時加回來；/industries/sensitivity 2026-11-04 同（導到 /industries/cycle）
  '/calendar', '/calendar/months', '/watchlist', '/watchlist/lists', '/holdings', '/holdings/dividends', '/holdings/accounts', '/guru-indicators', '/sitemap', '/appearance', '/accessibility', '/changelog', '/account', '/account/plan', '/account/newsletter', '/account/notices',
  // 退訂頁用信件標頭那種網址：伺服器就畫好確認頁。內文的 #t= 要瀏覽器查過才知道是哪一頁，假的 token 一定是「連結失效」
  '/newsletter/opt-out?t=example'
]
