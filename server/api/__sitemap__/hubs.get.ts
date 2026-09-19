// Dynamic sitemap source for the hub pages (2026-09-19, the SEO build) — the sibling of
// stocks.get.ts. Only the DYNAMIC routes are listed here; /stock, /rank, /metrics, /screener and
// /industries are static app pages that @nuxtjs/sitemap discovers on its own (includeAppSources).
// Same datasets as the pages (server/utils/hub-data.ts), so a URL is in the sitemap exactly when
// its page renders indexable:
// - /industry/{code}-{slug}: sectors with ≥ 5 ranked rows（fewer → the page is noindex）;
// - /rank/{slug}: every RANK_PAGES entry, lastmod = the ranking's own latest knowledgeDate;
// - /screener/{slug}: AVAILABLE templates that have a slug;
// - /metrics/{slug}: the METRIC_PAGE_SLUGS allow-list.
// No lastmod where none is truthful（industry pages, condition pages）.
const INDEXABLE_ROW_FLOOR = 5

export default defineEventHandler(async () => {
  const urls: { loc: string; lastmod?: string }[] = []

  const sectors = await getSectors().catch(() => [])
  const companies = await Promise.all(sectors.map(sector => getSectorCompanies(sector.code).catch(() => null)))
  sectors.forEach((sector, index) => {
    const path = sectorPath(sector.code)
    if (path && (companies[index]?.rows.length ?? 0) >= INDEXABLE_ROW_FLOOR) urls.push({ loc: path })
  })

  for (const page of RANK_PAGES) {
    const ranking = await getRanking(page.slug).catch(() => null)
    urls.push(ranking?.asOf ? { loc: rankPath(page.slug), lastmod: ranking.asOf } : { loc: rankPath(page.slug) })
  }

  const templates = await getScreenerTemplates().catch(() => [])
  for (const template of templates) {
    if (template.slug && template.status === 'AVAILABLE') urls.push({ loc: screenerTemplatePath(template.slug) })
  }

  for (const slug of METRIC_PAGE_SLUGS) urls.push({ loc: `/metrics/${slug}` })

  return urls
})
