// GET /api/hub/screener-template-count/:slug — how many companies match one official template
// right now（cached 6h）. The condition pages show this number and nothing else about the
// result set: a count is a statistic, a list would be a recommendation.
export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!screenerTemplateNameBySlug(slug)) throw createError({ statusCode: 404, statusMessage: 'unknown template' })
  try {
    return { slug, count: await getTemplateMatchCount(slug) }
  } catch {
    return { slug, count: null }
  }
})
