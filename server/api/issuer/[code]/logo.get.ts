import { getCompanyLogo } from '~~/server/utils/company-logo'

// GET /api/issuer/:code/logo：ETF 摘要卡畫的發行投信 logo（2026-11-24，使用者選「請公開觀測站抓投信 logo」）。鍵是 MOPS 投信代號
// （A＋5 碼），跟 GET /etfs/{symbol} 的 issuerCode 同一個值；夠方、夠清楚的規則同公司 logo，23 家有 17 家畫得出來
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!/^A\d{5}$/.test(code)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return { symbol: code, logo: await getCompanyLogo(code, 'issuerLogos') }
})
