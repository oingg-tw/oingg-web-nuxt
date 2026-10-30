// 全站每一種頁面模板的代表網址（2026-10-18 從 check-layout-shift.mjs 抽出，lighthouse-check.mjs 的「全站」組也用這一份）。
// 動態頁各挑一個有資料的代號；個股頁的固定子頁全列、ETF、特別股與類股的每個面向全列。新增頁面模板時加在這裡，兩支檢查一起涵蓋。
import { INDUSTRY_FACETS } from '../shared/utils/hub-slugs.ts'

const STOCK_FIXED = ['/dividend', '/dividend-fill', '/margins', '/solvency', '/dupont', '/cash-cycle', '/equity-source', '/equity-composition',
  '/cash-flow-composition', '/operating-expense-composition', '/shareholder-yield-composition', '/current-asset-composition',
  '/non-current-asset-composition', '/intangible-assets', '/debt-composition', '/monthly-revenue', '/monthly-revenue-growth', '/metrics', '/financial-statements', '/balance-sheet',
  '/income-statement', '/cash-flow-statement']
const ETF_FACETS = ['', '/distributions', '/distribution-composition', '/distribution-fill', '/expenses', '/returns', '/size', '/premium-discount', '/liquidity', '/holders']
export const ALL_ROUTES = [
  '/', '/stock/2330', '/stock/2330/roe', '/stock/2330/pe-ratio', '/stock/2330/eps', '/stock/7711/shareholder-yield',
  ...STOCK_FIXED.map(path => `/stock/2330${path}`),
  ...ETF_FACETS.map(path => `/etf/0050${path}`), '/etf/00400a',
  '/preferred/2881a', '/preferred/2881a/redemption', '/preferred/2881a/dividends', '/preferred/2881a/terms',
  '/reit/01001t', '/reit/01001t/nav', '/reit/01001t/distributions', '/reit/01001t/properties', '/reit/01001t/profile',
  '/screener/common', '/screener/common?template=value', '/screener/etf', '/screener/preferred', '/screener/reits',
  '/macro', '/macro?cycle=15', '/macro/equity-risk-premium', '/macro/market-events', '/macro/bond-yield',
  '/industries', '/industries/cycle', '/industries/dividend', '/industries/growth', '/industries/sensitivity', ...INDUSTRY_FACETS.map(facet => `/industry/24-semiconductor${facet.suffix}`),
  '/rank', '/rank/dividend-yield', '/learn', '/learn/dupont', '/learn/dividend-source/2330', '/blog', '/blog/low-pe-ratio-trap-cyclical-stocks',
  '/calendar', '/calendar/months', '/watchlist', '/watchlist/lists', '/holdings', '/holdings/dividends', '/holdings/columns', '/holdings/accounts', '/guru-indicators', '/sitemap', '/appearance', '/accessibility', '/changelog', '/profile'
]
