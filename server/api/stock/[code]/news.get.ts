import type { StockNewsResponse } from '#shared/types/stock-news'

// GET /api/stock/:code/news — 近期新聞（2026-11-12，設計頁 https://claude.ai/artifact/3n25Tvhai5n8ZzkdCqkRhu）：業務中台原樣轉的
// 數據中台新聞。新聞一天會進來好幾次，快取 10 分鐘，最多再用舊的 1 小時。上游查無（404）回空的，頁面說沒有新聞；其他失敗照樣丟，交給讀取失敗彈窗
const cachedStockNews = defineCachedFunction(
  (symbol: string) => businessFetch<StockNewsResponse>(`/stocks/${symbol}/news`),
  { name: 'stock-news', getKey: (symbol: string) => symbol, ...swrCache(10 * 60, HOUR) }
)

export default defineEventHandler(async (event): Promise<StockNewsResponse> => {
  const code = requireListedSymbol(event)
  return cachedStockNews(code).catch((error: { statusCode?: number }) => {
    if (error?.statusCode === 404) return { symbol: code, isNameSearchable: true, articles: [] }
    throw error
  })
})
