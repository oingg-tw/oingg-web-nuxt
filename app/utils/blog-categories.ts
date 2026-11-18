// 部落格的主題（2026-11-19，使用者選「少數大主題」、一篇一類）。欄名 category 與四個值照詞彙表二之十一（數據中台 1faaa7c）。
// 鍵是網址 ?category= 的值，順序就是 /blog 主題 chip 的順序。被 content.config.ts 直接 import，所以零 import。
// shortcut: 名稱表寫在網站，文章搬到業務中台（CLAUDE.md「Waiting on data」）後改讀它回應裡的主題名稱，這份就刪掉
export const BLOG_CATEGORIES = {
  financials: '財報指標',
  dividends: '股利與存股',
  preferred_etf: '特別股與 ETF',
  retirement: '退休規劃'
} as const

export type BlogCategory = keyof typeof BLOG_CATEGORIES

// 網址上的值：認得才算，沒帶或拼錯都是「全部」
export const blogCategoryOf = (value: unknown): BlogCategory | null =>
  typeof value === 'string' && Object.hasOwn(BLOG_CATEGORIES, value) ? (value as BlogCategory) : null
