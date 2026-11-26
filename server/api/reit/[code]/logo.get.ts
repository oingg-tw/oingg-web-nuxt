import { getCompanyLogo } from '~~/server/utils/company-logo'

// GET /api/reit/:code/logo：REIT 摘要卡畫的 logo（2026-11-26，使用者「LOGO案照建議」）。公開觀測站 manifest 的 reitLogos，鍵是大寫代號
//（01001T）；圖是管理機構或所屬集團的（富邦一號是富邦金、國泰一號是國泰建經），夠方、夠清楚的規則同公司 logo，上市中 6 檔有 5 檔畫得出來
export default defineEventHandler(async (event) => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!/^\d{5}T$/.test(code)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return { symbol: code, logo: await getCompanyLogo(code, 'reitLogos') }
})
