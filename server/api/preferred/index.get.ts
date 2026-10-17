import type { PreferredStockEntry } from '#shared/types/screener-detail'

// GET /api/preferred — 特別股專區（/preferred）的清單：28 檔一次，跟個別頁、sitemap 同一份快取（cachedPreferredStocks，一小時）
export default defineEventHandler(async (): Promise<{ entries: PreferredStockEntry[] }> => ({ entries: await cachedPreferredStocks() }))
