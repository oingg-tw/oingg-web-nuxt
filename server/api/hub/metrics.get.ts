// GET /api/hub/metrics — bff-ts's GET /metrics catalog, cached for an hour. The same JSON the
// browser-side useFilterSchema reads; hub pages（/metrics, /rank, /screener/{slug}）read it
// through here so a crawl of every hub page costs bff-ts one catalog call an hour, not one per
// render.
export default defineEventHandler(async () => {
  try {
    return await getMetricsCatalog()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'metric catalog unavailable' })
  }
})
