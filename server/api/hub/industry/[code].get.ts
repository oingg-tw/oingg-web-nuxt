import type { IndustryPageData } from '#shared/types/hub'

// GET /api/hub/industry/:code — one sector's company table（screener rows with the daily
// valuation and two fundamentals）, its distribution stats, and the directory members that have
// no screener row yet, for /industry/{code}-{slug}. Unknown code → 404 here as well as on the
// page, so the route can't be used to enumerate anything the page wouldn't show.
export default defineEventHandler(async (event): Promise<IndustryPageData> => {
  const code = getRouterParam(event, 'code') ?? ''
  const known = SECTORS[code]
  if (!known) throw createError({ statusCode: 404, statusMessage: 'unknown sector' })

  let companies: Awaited<ReturnType<typeof getSectorCompanies>>
  let directory: Awaited<ReturnType<typeof getMarketDirectory>>
  let sectors: Awaited<ReturnType<typeof getSectors>>
  try {
    ;[companies, directory, sectors] = await Promise.all([getSectorCompanies(code), getMarketDirectory(), getSectors()])
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'sector data unavailable' })
  }

  const catalogCount = sectors.find(sector => sector.code === code)?.companyCount ?? 0
  const ranked = new Set(companies.rows.map(row => row.symbol))
  const members = directory.sectors.find(sector => sector.code === code)?.companies ?? []
  // A sector nobody is listed under（19 綜合 today）is a 404, not an empty 200. A sector with
  // members but no screener rows（13 電子工業（舊分類））still renders its member list; the page
  // itself decides indexability from the row count.
  if (!companies.rows.length && !members.length) throw createError({ statusCode: 404, statusMessage: 'empty sector' })
  return {
    sector: { code, name: known.name, slug: known.slug, companyCount: catalogCount },
    companies,
    unranked: members.filter(company => !ranked.has(company.symbol))
  }
})
