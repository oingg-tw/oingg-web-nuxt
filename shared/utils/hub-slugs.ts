// URL vocabulary of the hub pages (2026-09-19, the SEO build) — the ONE place the app pages, the
// Nitro data layer and the sitemap handler all read, so a slug can't drift between the three
// (same reason f-score-pilot.ts lives here). Rules (from the vault's URL guidance, adopted):
// lowercase hyphenated English slugs, no query state, depth ≤ 3.

// 證交所類股 — bff-ts's GET /industries/securities-sectors codes are the exchange's own stable
// two-digit codes and the names are the exchange's official labels, so both are written down
// here: the stock pages' breadcrumb (首頁 › 個股總表 › {類股} › …) then costs zero extra requests
// (a profile already carries the code). `07`/`91`/`98`/`XX` are not industries and are absent on
// purpose; codes 13 and 19 exist but have no screener rows (13 = the legacy electronics bucket,
// 19 = 綜合) — the industry page 404s on an empty sector rather than rendering a thin 200.
export const SECTORS: Record<string, { slug: string; name: string }> = {
  '01': { slug: 'cement', name: '水泥工業' },
  '02': { slug: 'food', name: '食品工業' },
  '03': { slug: 'plastics', name: '塑膠工業' },
  '04': { slug: 'textiles', name: '紡織纖維' },
  '05': { slug: 'electrical-machinery', name: '電機機械' },
  '06': { slug: 'appliances-cables', name: '電器電纜' },
  '08': { slug: 'glass-ceramics', name: '玻璃陶瓷' },
  '09': { slug: 'paper', name: '造紙工業' },
  '10': { slug: 'steel', name: '鋼鐵工業' },
  '11': { slug: 'rubber', name: '橡膠工業' },
  '12': { slug: 'automotive', name: '汽車工業' },
  '13': { slug: 'electronics-legacy', name: '電子工業（舊分類）' },
  '14': { slug: 'construction', name: '建材營造業' },
  '15': { slug: 'shipping', name: '航運業' },
  '16': { slug: 'tourism', name: '觀光事業' },
  '17': { slug: 'financial', name: '金融保險業' },
  '18': { slug: 'trading-retail', name: '貿易百貨' },
  '19': { slug: 'conglomerate', name: '綜合' },
  '20': { slug: 'others', name: '其他業' },
  '21': { slug: 'chemicals', name: '化學工業' },
  '22': { slug: 'biotech-medical', name: '生技醫療業' },
  '23': { slug: 'oil-gas-electricity', name: '油電燃氣業' },
  '24': { slug: 'semiconductor', name: '半導體業' },
  '25': { slug: 'computers-peripherals', name: '電腦及週邊設備業' },
  '26': { slug: 'optoelectronics', name: '光電業' },
  '27': { slug: 'communications-networking', name: '通信網路業' },
  '28': { slug: 'electronic-components', name: '電子零組件業' },
  '29': { slug: 'electronics-distribution', name: '電子通路業' },
  '30': { slug: 'it-services', name: '資訊服務業' },
  '31': { slug: 'other-electronics', name: '其他電子業' },
  '32': { slug: 'cultural-creative', name: '文化創意業' },
  '33': { slug: 'agritech', name: '農業科技業' },
  '35': { slug: 'green-energy', name: '綠能環保' },
  '36': { slug: 'digital-cloud', name: '數位雲端' },
  '37': { slug: 'sports-leisure', name: '運動休閒' },
  '38': { slug: 'home-living', name: '居家生活' }
}

export function sectorPath(code: string): string | null {
  const sector = SECTORS[code]
  return sector ? `/industry/${code}-${sector.slug}` : null
}

// `/industry/24-semiconductor` → { code: '24', slug: 'semiconductor' }; the page compares `slug`
// with SECTORS[code].slug and 301s to the canonical path when a valid code carries a wrong slug.
export function parseSectorParam(param: string): { code: string; slug: string } | null {
  const match = /^(\d{2})-([a-z0-9-]+)$/.exec(param)
  if (!match) return null
  return { code: match[1]!, slug: match[2]! }
}

// /rank/{slug} — one objective screener field each, ranked by GET /screener/ranking. The
// wording is deliberately statistical（由高到低／由低到高）; the pages carry the compliance
// disclaimer directly above the table. No sector-scoped variants: bff-ts rejects sectorCodes on
// the EOD fields by design (2026-09-19).
export interface RankPageDefinition {
  slug: string
  field: string
  direction: 'asc' | 'desc'
  // 「殖利率」— the metric noun used in title/h1（「台股殖利率排行：由高到低前 50 檔」）.
  label: string
  // The catalog metricCode behind the field (for the「{指標}是什麼？」link when a /metrics page exists).
  metricCode: string
}

export const RANK_PAGES: RankPageDefinition[] = [
  { slug: 'dividend-yield', field: 'dividendYield.EOD', direction: 'desc', label: '殖利率', metricCode: 'dividendYield' },
  { slug: 'pe-ratio-low', field: 'exchangePeRatio.EOD', direction: 'asc', label: '本益比', metricCode: 'exchangePeRatio' },
  { slug: 'pb-ratio-low', field: 'exchangePbRatio.EOD', direction: 'asc', label: '股價淨值比', metricCode: 'exchangePbRatio' },
  { slug: 'roe', field: 'roe.TTM', direction: 'desc', label: 'ROE', metricCode: 'roe' },
  { slug: 'eps', field: 'eps.TTM', direction: 'desc', label: 'EPS', metricCode: 'eps' },
  { slug: 'consecutive-dividend-years', field: 'consecutiveDividendYears.FY', direction: 'desc', label: '連續配息年數', metricCode: 'consecutiveDividendYears' },
  { slug: 'market-cap', field: 'liveMarketCap.EOD', direction: 'desc', label: '市值', metricCode: 'liveMarketCap' },
  { slug: 'revenue-growth', field: 'revenueGrowthRate.Q', direction: 'desc', label: '營收成長年增率', metricCode: 'revenueGrowthRate' }
]

export function findRankPage(slug: string): RankPageDefinition | null {
  return RANK_PAGES.find(page => page.slug === slug) ?? null
}

export function rankPath(slug: string): string {
  return `/rank/${slug}`
}

// /screener/{slug} 條件說明頁 — keyed by the template's NAME because GET /screener/templates ids
// are seeded UUIDs (not URL material). A template whose name isn't listed here has no page.
export const SCREENER_TEMPLATE_SLUGS: Record<string, string> = {
  價值型: 'value',
  低波動: 'low-volatility',
  股利穩健: 'dividend-stability',
  財務韌性: 'financial-resilience',
  獲利品質: 'earnings-quality',
  轉機股: 'turnaround',
  成長動能: 'growth-momentum'
}

export function screenerTemplateSlug(name: string): string | null {
  return SCREENER_TEMPLATE_SLUGS[name] ?? null
}

export function screenerTemplateNameBySlug(slug: string): string | null {
  return Object.entries(SCREENER_TEMPLATE_SLUGS).find(([, candidate]) => candidate === slug)?.[0] ?? null
}

export function screenerTemplatePath(slug: string): string {
  return `/screener/${slug}`
}

// /metrics/{kebab-code} — GET /metrics codes are camelCase; the URL form is kebab-case. Two
// split points: lower/digit → upper（ocfToNetIncome → ocf-to-net-income）and upper → upper+lower
//（piotroskiFScore → piotroski-f-score, altmanZDoublePrimeScore → altman-z-double-prime-score;
// without the second rule "FScore" stayed one word and the allow-listed slug 404'd, found live
// 2026-09-19）. Round-trips losslessly for every current code (144 unique slugs, digits never
// split a word) — metricCodeFromSlug re-capitalises after each hyphen.
export function metricSlug(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

export function metricCodeFromSlug(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

export function metricPath(code: string): string {
  return `/metrics/${metricSlug(code)}`
}

// Indexable /metrics/{code} pages. Grew from just Piotroski F-Score (2026-09-19,「先來 f score 徽
// 章作為示範就足夠，看著狀況好再擴大」) to two of the badge-page family's three metrics 2026-09-20 —
// roe → roe, gross-margin → grossMargin, each verified to carry full description/limitations/
// misreadings text AND a meta description that clears the 60-CJK-char floor
// (scripts/check-hub-pages.mjs) once app/pages/metrics/[code].vue's own clampDescription(text, 90)
// runs on it. liveGrahamNumber (→ live-graham-number) is NOT here despite having full text — its
// raw catalog description mixes enough ASCII (units, a formula fragment) that the shared 90-RAW-
// CHARACTER clamp truncates it down to 56 CJK-equivalent chars, under that floor. That's a gap in
// the shared /metrics page template affecting this one metric, not something to route around here
// silently; leave it out of the indexable set until it's fixed at the source. Every other metric
// renders the same template with `noindex, follow` and stays out of the sitemap until this list
// grows further. NOT the same vocabulary as BADGE_PAGES's own `slug` (a metric-explainer page vs.
// a per-stock badge page are different page kinds) — 'gross-margin' and 'roe' happen to be
// identical strings in both because metricSlug()'s mechanical camelCase→kebab-case transform and
// this app's own hand-picked badge slugs landed on the same spelling for these two, not because
// the two vocabularies are meant to be interchangeable.
export const METRIC_PAGE_SLUGS: string[] = ['piotroski-f-score', 'roe', 'gross-margin']

export function isIndexableMetricSlug(slug: string): boolean {
  return METRIC_PAGE_SLUGS.includes(slug)
}

// 個股 × 徽章專頁（app/pages/stock/[code]/[slug].vue, 2026-09-20）— f-score.vue's 1:9 checklist
// proved the format works, so this generalizes it to single-value badges.
//
// EVERY per-stock badge page is listed here, f-score included (added 2026-09-20 when the stock
// index page's separate list of badge-page links was removed as duplicate internal linking — see
// that page's own comment). f-score is still RENDERED by its own hand-built route file, not by
// the catch-all（`ownRoute` below）; what it joins this registry for is the two things that must
// cover all four pages uniformly — the sitemap's enumeration and the badge table's per-row link.
// Before this, f-score's link lived somewhere different from the other three's purely because it
// wasn't in the registry, which is the kind of split this file exists to prevent.
export interface BadgePageDefinition {
  // URL segment. Hand-written rather than metricSlug(metricCode) on purpose: metricSlug would
  // turn liveGrahamNumber into the meaningless "live-graham-number" — this app's own EOD/TTM
  // "live" prefix convention isn't something a URL reader needs to know about. Deliberately NOT
  // the same slug space as /metrics/{slug} (metricPath()) — those are independent vocabularies
  // for two different page kinds; do not cross-reference one from the other.
  slug: string
  // GET /metrics' key — the badge definition (threshold/summary/limitations/misreadings) and
  // GET /stocks/:symbol/badges' per-company pass/fail both key on this.
  metricCode: string
  // GET /stocks/:symbol/metric-provenance's own metricCode for the calculation-audit table.
  // Usually equal to metricCode; differs for liveGrahamNumber (hasProvenance: false — its EOD
  // price-based twin has no provenance breakdown) which uses grahamNumber's quarterly-basis
  // provenance instead. The page's own comment on this fallback explains the resulting number
  // mismatch (today's close vs. the last knowledge-date close) and why it may not be papered over.
  // Absent on `ownRoute` entries — only the catch-all template renders that table.
  provenanceMetricCode?: string
  // <h1> third span and the breadcrumb's last crumb.
  topic: string
  // <title> long-tail phrase, sized so `{短名} {代碼} {titleKeywords}` + brand suffix stays
  // ≤ 32 CJK-equivalent chars (scripts/check-stock-pages.mjs's cjkLength) — verify per entry.
  titleKeywords: string
  // This badge has its own hand-built page file instead of being served by [slug].vue's generic
  // template (f-score: its 9-signal checklist has no equivalent for single-value badges). Nuxt
  // resolves the static route first so the catch-all never sees the slug anyway, but [slug].vue
  // also rejects these explicitly rather than relying on that — an entry here must never be
  // rendered with the generic template, which would silently drop the page's real content.
  ownRoute?: true
}

export const BADGE_PAGES: BadgePageDefinition[] = [
  // Rendered by app/pages/stock/[code]/f-score.vue, which reads its own topic/titleKeywords from
  // this entry so the two can't drift.
  { slug: 'f-score', metricCode: 'piotroskiFScore', topic: 'Piotroski F-Score', titleKeywords: 'Piotroski F-Score 9 項訊號', ownRoute: true },
  { slug: 'graham-number', metricCode: 'liveGrahamNumber', provenanceMetricCode: 'grahamNumber', topic: 'Graham Number', titleKeywords: 'Graham Number 本益比×淨值比' },
  { slug: 'roe', metricCode: 'roe', provenanceMetricCode: 'roe', topic: '股東權益報酬率', titleKeywords: 'ROE 股東權益報酬率與門檻' },
  { slug: 'gross-margin', metricCode: 'grossMargin', provenanceMetricCode: 'grossMargin', topic: '毛利率', titleKeywords: '毛利率與護城河門檻' }
]

export function findBadgePage(slug: string): BadgePageDefinition | null {
  return BADGE_PAGES.find(page => page.slug === slug) ?? null
}

// Reverse lookup for StockFinancialHighlightsRisksCard.vue's entry-point links — given a badge's
// GET /metrics key (GuruBadge.id), find the page that covers it, or null for the other ~32
// badges that only have the shared dialog.
export function findBadgePageByMetric(metricCode: string): BadgePageDefinition | null {
  return BADGE_PAGES.find(page => page.metricCode === metricCode) ?? null
}

export function badgePagePath(code: string, slug: string): string {
  return `/stock/${code}/${slug}`
}
