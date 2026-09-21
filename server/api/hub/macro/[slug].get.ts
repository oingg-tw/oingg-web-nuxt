import type { MacroPageData } from '#shared/types/hub'

// GET /api/hub/macro/:slug — one 總經特區 page's data. Thin over the cached function, same as every
// other /api/hub/* route; an unknown slug 404s there rather than here so the registry stays the
// single place that decides which pages exist.
export default defineEventHandler(async (event): Promise<MacroPageData> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  return getMacroPage(slug)
})
