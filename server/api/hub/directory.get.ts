// GET /api/hub/directory — every listed four-digit symbol grouped by sector, for /stock（個股總表）.
// A cold-cache failure is a 503, never a 200 with an empty directory: an empty hub page indexed
// once is worse than a temporarily unavailable one.
export default defineEventHandler(async () => {
  try {
    return await getMarketDirectory()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'stock directory unavailable' })
  }
})
