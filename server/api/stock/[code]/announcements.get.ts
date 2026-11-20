import type { MaterialAnnouncementsResponse } from '#shared/types/material-announcements'

// GET /api/stock/:code/announcements — 個股重大訊息（2026-11-21；使用者 11-12 定的頁面，見 pages/stock/[code]/announcements.vue）。
// 最近 30 則：全文有的上千字，一次拿太多會拖慢弱的手機（同近期新聞的 30 則）。上市一天更新一次（早上）、上櫃一次（下午），快取 10 分鐘、
// 最多再用舊的 1 小時。上游查無（404，不在目錄）回空的；其他失敗照樣丟，交給讀取失敗彈窗
const LIMIT = 30
const cachedAnnouncements = defineCachedFunction(
  (symbol: string) => businessFetch<MaterialAnnouncementsResponse>(`/stocks/${symbol}/material-announcements`, { query: { limit: LIMIT } }),
  { name: 'stock-material-announcements', getKey: (symbol: string) => symbol, ...swrCache(10 * 60, HOUR) }
)

export default defineEventHandler(async (event): Promise<MaterialAnnouncementsResponse> => {
  const code = requireListedSymbol(event)
  return cachedAnnouncements(code).catch((error: { statusCode?: number }) => {
    if (error?.statusCode === 404) return { symbol: code, market: 'rotc', dataSince: null, count: 0, limit: LIMIT, offset: 0, entries: [] }
    throw error
  })
})
