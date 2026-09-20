import type { StockBadgePageResponse } from '#shared/types/stock-badge-page'
import type { StockBadgeEntry } from '#shared/types/stock-badges'

// GET /api/stock/:code/badge?slug=graham-number — everything one badge page needs (2026-09-20,
// the badge-page family). `slug` is checked against the single BADGE_PAGES registry
// (shared/utils/hub-slugs.ts) that the page component and the sitemap handler also read, so an
// unknown slug here means the same thing it means everywhere else: a real 404, not a page that
// happens to render empty.
//
// `entry` and `provenance` each fail independently (settle()) — a badge that's been withdrawn
// from the catalog (see analysis-ts's ongoing badge-takedown rounds) or a provenance-endpoint
// hiccup must degrade the page, never 500 it. The page itself decides what "degrade" means
// (noindex, a "尚無資料" line) — this route just reports what it found.
const LISTED_SYMBOL = /^\d{4}$/

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

export default defineEventHandler(async (event): Promise<StockBadgePageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // `ownRoute` entries (f-score) 404 here too — they're in BADGE_PAGES for the sitemap and the
  // badge table's links, but they render from their own page file and never call this route.
  const slug = getQuery(event).slug
  const badgePage = typeof slug === 'string' ? findBadgePage(slug) : null
  if (!badgePage || badgePage.ownRoute) throw createError({ statusCode: 404, statusMessage: 'unknown badge page' })

  const [badges, provenance] = await Promise.all([
    settle(cachedBadges(code)),
    badgePage.provenanceMetricCode ? settle(cachedMetricProvenance(code, badgePage.provenanceMetricCode)) : Promise.resolve(null)
  ])

  let entry: StockBadgeEntry | null = null
  if (badges) {
    for (const category of badges.categories) {
      const found = category.badges.find(badge => badge.metricCode === badgePage.metricCode)
      if (found) {
        entry = found
        break
      }
    }
  }

  return { symbol: code, slug: badgePage.slug, entry, provenance }
})
