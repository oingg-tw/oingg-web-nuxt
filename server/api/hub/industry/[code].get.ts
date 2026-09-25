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
  // 興櫃不顯示（2026-09-26「industry 請先不要顯示興櫃的公司」）。興櫃股的代號同樣是四碼，所以
  // getMarketDirectory 的 LISTED_SYMBOL 擋不掉它們，isEmerging 是唯一可靠的判準。
  //
  // 兩份名單都要過濾，而且 rows 那份只能靠 join：companies.rows 來自 screener，上面沒有任何市場別
  // 資訊。所以先從 directory 建一個興櫃代號的集合，兩邊共用——只濾 members 會讓興櫃公司從下面的
  // 名單消失、卻仍然留在上面的表格裡，那比不濾更難解釋。
  const allMembers = directory.sectors.find(sector => sector.code === code)?.companies ?? []
  const emerging = new Set(allMembers.filter(company => company.isEmerging).map(company => company.symbol))
  const members = allMembers.filter(company => !company.isEmerging)
  // A sector nobody is listed under（19 綜合 today）is a 404, not an empty 200. A sector with
  // members but no screener rows（13 電子工業（舊分類））still renders its member list; the page
  // itself decides indexability from the row count.
  if (!companies.rows.length && !members.length) throw createError({ statusCode: 404, statusMessage: 'empty sector' })
  return {
    sector: { code, name: known.name, slug: known.slug, companyCount: catalogCount },
    companies: { ...companies, rows: companies.rows.filter(row => !emerging.has(row.symbol)) },
    unranked: members.filter(company => !ranked.has(company.symbol))
  }
})
