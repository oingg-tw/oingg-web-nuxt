// GET /api/stock/:code/series?page=index|company-health|dividend|metrics-history|
// financial-statements — the per-page bundle of cached 業務中台 series（see
// server/utils/stock-data.ts for the plans and shared/types/stock-series.ts for the shape）.
// Called by useStockPageDigest on every /stock/:code render: in-process during SSR, one
// same-origin request from the browser on a client-side navigation. Never reaches 業務中台 from
// the browser, so 業務中台's rate limit and missing CORS headers are both out of the picture.

export default defineEventHandler(async event => {
  const code = requireListedSymbol(event)
  const page = getQuery(event).page
  if (typeof page !== 'string' || !isStockSeriesPage(page)) throw createError({ statusCode: 400, statusMessage: 'unknown series page' })
  return runStockSeriesPlan(code, page)
})
