// GET /api/stock/:code/series?page=index|company-health|dividend|metrics-history|
// financial-statements|f-score — the per-page bundle of cached bff-ts series（see
// server/utils/stock-data.ts for the plans and shared/types/stock-series.ts for the shape）.
// Called by useStockPageDigest on every /stock/:code render: in-process during SSR, one
// same-origin request from the browser on a client-side navigation. Never reaches bff-ts from
// the browser, so bff-ts's rate limit and missing CORS headers are both out of the picture.
const LISTED_SYMBOL = /^\d{4}$/

export default defineEventHandler(async event => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })
  const page = getQuery(event).page
  if (typeof page !== 'string' || !isStockSeriesPage(page)) throw createError({ statusCode: 400, statusMessage: 'unknown series page' })
  return runStockSeriesPlan(code, page)
})
