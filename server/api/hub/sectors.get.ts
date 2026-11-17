// GET /api/hub/sectors — the 36 exchange sectors with counts（cached 24h）. Feeds the home
// page's 類股 tile counts, the /screener and /industries link lists and the industry pages'
// 「其他類股」nav.
export default defineEventHandler(() => getSectors().catch(() => {
  throw createError({ statusCode: 503, statusMessage: 'sector catalog unavailable' })
}))
