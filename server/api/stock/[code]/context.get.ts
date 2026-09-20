import type { StockContextResponse } from '#shared/types/stock-context'

// GET /api/stock/:code/context — the company's market-wide rank on four objective fields, for
// the /stock/:code index page's「在全市場排第幾？」section（2026-09-19, the SEO build）. Each
// rank fails independently（null）so one upstream hiccup never blanks the whole page.
//
// The supply-chain peer table this route also used to serve（GET /companies/peer-group +
// POST /screener/values, the「同業有哪些？」section）was removed 2026-09-20: analysis-ts hard-
// deleted GET /companies/peer-group with no replacement (commit a7489d65, a compliance call on
// the underlying oingg-playwright-py classification, not a temporary outage). See
// StockContextResponse's own comment and industries.vue's comment for the same removal
// elsewhere.
//
// Rank fields: three "higher is more" and one "lower is more"（debtRatio）, none of them
// integer-valued — an integer metric such as consecutiveDividendYears ties by the hundreds
// (2330 ranks "1 of 1,776" with 7 years), which reads as a claim the data can't support.
//
// dividendYield.EOD gets excludeZero: true (2026-09-20, analysis-ts's own recommendation, same
// reasoning as server/utils/stock-data.ts's own dividend-page rank) — a company is ranked
// against payers only, not diluted by the ~16% of the market that pays no dividend at all.
const LISTED_SYMBOL = /^\d{4}$/
const RANK_FIELDS: { field: string; direction: 'asc' | 'desc'; excludeZero?: boolean }[] = [
  { field: 'roe.TTM', direction: 'desc' },
  { field: 'eps.TTM', direction: 'desc' },
  { field: 'dividendYield.EOD', direction: 'desc', excludeZero: true },
  { field: 'debtRatio.Q', direction: 'asc' }
]

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

export default defineEventHandler(async (event): Promise<StockContextResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  const ranks = await Promise.all(
    RANK_FIELDS.map(async ({ field, direction, excludeZero }) => ({ field, direction, rank: await settle(cachedCompanyRank(code, field, direction, excludeZero)) }))
  )
  return { symbol: code, ranks }
})
