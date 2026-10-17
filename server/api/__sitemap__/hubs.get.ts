// Dynamic sitemap source for the hub pages (2026-09-19, the SEO build) — the sibling of
// stocks.get.ts. Only the DYNAMIC routes are listed here; /stock, /rank, /learn, /screener and
// /industries are static app pages that @nuxtjs/sitemap discovers on its own (includeAppSources).
// Same datasets as the pages (server/utils/hub-data.ts), so a URL is in the sitemap exactly when
// its page renders indexable:
// - /industry/{code}-{slug}: sectors with ≥ 5 ranked rows（fewer → the page is noindex）;
// - /rank/{slug}: every RANK_PAGES entry, lastmod = the ranking's own latest knowledgeDate;
// - /screener/{slug}: AVAILABLE templates that have a slug;
// - /learn/{slug}: the METRIC_PAGE_SLUGS allow-list plus the LEARN_TOPICS pages（新手專區，2026-10-12）;
// - /preferred/{code}（2026-10-18 moved from /screener/preferred）and /screener/etf/{code}: every preferred stock and ETF（2026-10-15, the per-symbol
//   pages of the screener zone）.
// No lastmod where none is truthful（industry pages, condition pages）.
const INDEXABLE_ROW_FLOOR = 5

export default defineEventHandler(async () => {
  const urls: { loc: string; lastmod?: string }[] = []

  const sectors = (await settle(getSectors())) ?? []
  const companies = await Promise.all(sectors.map(sector => settle(getSectorCompanies(sector.code))))
  sectors.forEach((sector, index) => {
    const path = sectorPath(sector.code)
    if (path && (companies[index]?.rows.length ?? 0) >= INDEXABLE_ROW_FLOOR) urls.push({ loc: path })
  })

  for (const page of RANK_PAGES) {
    const ranking = await settle(getRanking(page.slug))
    urls.push(ranking?.asOf ? { loc: rankPath(page.slug), lastmod: ranking.asOf } : { loc: rankPath(page.slug) })
  }

  const templates = (await settle(getScreenerTemplates())) ?? []
  for (const template of templates) {
    if (template.slug && template.status === 'AVAILABLE') urls.push({ loc: screenerTemplatePath(template.slug) })
  }

  for (const slug of METRIC_PAGE_SLUGS) urls.push({ loc: `/learn/${slug}` })
  for (const topic of LEARN_TOPICS) urls.push({ loc: learnTopicPath(topic.slug) })
  for (const group of LEARN_GROUPS) urls.push({ loc: learnTopicPath(group.slug) })

  // 總經特區（2026-09-22）— /macro/{slug} is a dynamic route, so @nuxtjs/sitemap cannot discover
  // it the way it discovers the zone's static route files. No lastmod: the upstream schedule is not
  // something this route knows, and guessing one would be a guess dressed as a fact.
  for (const page of MACRO_PAGES) urls.push({ loc: macroPagePath(page.slug) })

  for (const stock of (await settle(cachedPreferredStocks())) ?? []) urls.push({ loc: preferredStockPath(stock.symbol) })
  for (const symbol of (await settle(cachedEtfSymbols())) ?? []) urls.push({ loc: etfPath(symbol) })

  return urls
})
