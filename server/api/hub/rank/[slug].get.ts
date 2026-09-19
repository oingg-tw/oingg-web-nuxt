// GET /api/hub/rank/:slug — the 50-row ordering behind one /rank/{slug} page（cached 6h）.
export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!findRankPage(slug)) throw createError({ statusCode: 404, statusMessage: 'unknown rank page' })
  try {
    return await getRanking(slug)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'ranking unavailable' })
  }
})
