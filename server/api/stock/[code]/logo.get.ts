import { getCompanyLogo } from '~~/server/utils/company-logo'

// GET /api/stock/:code/logo — the one company logo a stock page's summary card draws（2026-09-23）.
//
// Its own route rather than a field folded into /api/bff/stocks/:code/profile, even though that
// would have cost no extra request: that file is a PASSTHROUGH and says so in its own header
// ("this is not an open proxy") — it forwards bff-ts responses and composes nothing. Mixing a
// second, locally-sourced upstream into one of its paths would quietly make it something else.
//
// The cost of keeping them apart is one more same-origin call per stock page. It is served from
// Nitro's cache after the first hit of the day（the manifest behind it is cached 24h and the
// per-symbol lookup is in-memory）, so it reaches mops's bucket at most once a day, not once a
// visitor.
const LISTED_SYMBOL = /^\d{4}$/

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // null is the normal answer for roughly a quarter of the market — 1,533 of 1,985 companies have
  // a logo, and the rest are mostly sites that block crawling or were unreachable. The card renders
  // nothing at all in that case; it never substitutes an initial or a placeholder mark, which would
  // assert we hold something we do not.
  return { symbol: code, logo: await getCompanyLogo(code) }
})
