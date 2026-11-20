// 部落格的主題（2026-11-19，使用者選「少數大主題」、一篇一類）。欄名 category 與四個值照詞彙表二之十一（數據中台 1faaa7c）。
// 鍵是網址 ?category= 的值，也是業務中台回應裡的 category，順序就是 /blog 主題 chip 的順序。
// shortcut: 業務中台的 /blog-posts 只回鍵、不回中文名稱（2026-11-20），名稱表先寫在網站；它回名稱以後改讀它，這份就刪掉
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
