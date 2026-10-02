import type { H3Event } from 'h3'

// Every /api/stock/[code]/… route starts the same way: read the route param, and 400 if it is not
// a four-digit symbol. Eleven files each declared the regex and the guard — 2026-10-02, one call.
//
// 400 and not 404 on purpose, and this is the one place the distinction is now stated: a code that
// cannot be a symbol at all means the CALLER built a bad URL, which is our bug, not a missing
// company. 404 is reserved for a well-formed symbol that upstream does not know (only
// /stocks/{symbol} and /profile answer that way). Flattening the two would make our own routing
// mistakes look like absent data, which is the same confusion settle() already costs us.
//
// `\d{4}` is the route scope, not an assumption about symbol shape — see
// server/api/bff/[...path].get.ts's own comment for the measurement behind it and for why it stays
// now that the six-digit 存託憑證 have been removed upstream.
//
// Two other files hold the same regex and keep it: __sitemap__/stocks.get.ts filters a list
// (`continue`, not `throw`) and hub-data.ts filters the directory, where its own comment records
// that 興櫃 codes are four digits too. Same pattern, different question — not copies of this.
export function requireListedSymbol(event: H3Event): string {
  const code = getRouterParam(event, 'code') ?? ''
  if (!/^\d{4}$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })
  return code
}
