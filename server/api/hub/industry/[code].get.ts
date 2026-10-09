import type { IndustryPageData } from '#shared/types/hub'

// GET /api/hub/industry/:code — one sector's company table（screener rows with the daily
// valuation and two fundamentals）, its distribution stats, and the directory members that have
// no screener row yet, for /industry/{code}-{slug}. Unknown code → 404 here as well as on the
// page, so the route can't be used to enumerate anything the page wouldn't show.
export default defineEventHandler(async (event): Promise<IndustryPageData> => {
  const code = getRouterParam(event, 'code') ?? ''
  const known = SECTORS[code]
  if (!known) throw createError({ statusCode: 404, statusMessage: 'unknown sector' })

  let listed: Awaited<ReturnType<typeof getListedSectorCompanies>>
  try {
    listed = await getListedSectorCompanies(code)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'sector data unavailable' })
  }
  // 興櫃的排除與統計重算都在 getListedSectorCompanies（hub-data.ts）。
  const { companies, members } = listed
  const ranked = new Set(companies.rows.map(row => row.symbol))
  // A sector nobody is listed under（19 綜合 today）is a 404, not an empty 200. A sector with
  // members but no screener rows（13 電子工業（舊分類））still renders its member list; the page
  // itself decides indexability from the row count.
  if (!companies.rows.length && !members.length) throw createError({ statusCode: 404, statusMessage: 'empty sector' })
  const rows = companies.rows
  const unranked = members.filter(company => !ranked.has(company.symbol))
  // 家數就是「這一頁真的列出幾家」：表格的列數加上下面那份沒有 screener 列的成員，去重。
  //
  // 2026-10-01 改。原本借的是 getSectors() 那個數字，而這一頁的兩份名單是另外兩個母體的交集：
  // rows 來自 screener、members 來自 directory 且排除興櫃。所以標頭的數字不能從別的地方借，只能
  // 數自己列出來的。改完實測 34 個類股全部相符。
  //
  // 首頁與 /screener 的膠囊仍用 getSectors() 的 directory 家數——那是索引層的估計值，實測 34 個
  // 類股裡 33 個跟這一頁完全相同，只有「其他業」差 4（screener 有 4 檔 directory 沒歸在這一類）。
  // 要讓膠囊也精確得對 34 個類股各跑一次 screener，冷快取時首頁會等兩分鐘，不值得。
  // 改之前的差距是 26 個類股對不上、最大 93：生技醫療業膠囊寫 252、頁面只列出 159（差的全是興櫃，
  // 2026-09-26 起產業頁不顯示興櫃，而家數還是從型錄借的）。
  const companyCount = new Set([...rows.map(row => row.symbol), ...unranked.map(company => company.symbol)]).size
  return {
    sector: { code, name: known.name, slug: known.slug, companyCount },
    companies,
    unranked
  }
})
