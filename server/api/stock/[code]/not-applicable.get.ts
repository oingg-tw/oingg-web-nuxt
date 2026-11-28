// GET /api/stock/:code/not-applicable — 指標總覽不列的頁的 slug（cachedNotApplicable，server/utils/stock-data.ts）
export default defineEventHandler((event): Promise<string[]> => cachedNotApplicable(requireListedSymbol(event)))
