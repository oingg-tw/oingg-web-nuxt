// GET /api/hub/screener-templates — the official screener templates with this app's URL slug
// attached（cached 24h）, for the /screener/{slug} condition pages and their「其他篩選條件」links.
export default defineEventHandler(async () => {
  try {
    return await getScreenerTemplates()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'screener templates unavailable' })
  }
})
