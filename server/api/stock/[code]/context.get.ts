import type { StockContextResponse } from '#shared/types/stock-context'

// GET /api/stock/:code/context — supply-chain peers with a side-by-side metric table and the
// company's market-wide rank on four objective fields, for the /stock/:code index page's
// 「同業有哪些？」and「在全市場排第幾？」sections（2026-09-19, the SEO build）. Each part fails
// independently（null）so one upstream hiccup never blanks the whole page.
//
// Rank fields: three "higher is more" and one "lower is more"（debtRatio）, none of them
// integer-valued — an integer metric such as consecutiveDividendYears ties by the hundreds
// (2330 ranks "1 of 1,776" with 7 years), which reads as a claim the data can't support.
const LISTED_SYMBOL = /^\d{4}$/
const PEER_TABLE_FIELDS = ['roe.TTM', 'eps.TTM', 'grossMargin.TTM', 'exchangePeRatio.EOD', 'dividendYield.EOD']
const RANK_FIELDS: { field: string; direction: 'asc' | 'desc' }[] = [
  { field: 'roe.TTM', direction: 'desc' },
  { field: 'eps.TTM', direction: 'desc' },
  { field: 'dividendYield.EOD', direction: 'desc' },
  { field: 'debtRatio.Q', direction: 'asc' }
]
const MAX_PEERS = 12

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

  const peerGroup = await settle(cachedPeerGroup(code))
  const peers = peerGroup?.found ? peerGroup.peers.map(peer => peer.symbol).filter(symbol => symbol !== code).slice(0, MAX_PEERS) : []
  const [peerValues, ...ranks] = await Promise.all([
    peers.length ? settle(cachedPeerValues([code, ...peers], PEER_TABLE_FIELDS)) : Promise.resolve(null),
    ...RANK_FIELDS.map(async ({ field, direction }) => ({ field, direction, rank: await settle(cachedCompanyRank(code, field, direction)) }))
  ])
  return { symbol: code, peerGroup, peerValues, ranks }
})
