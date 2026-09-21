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
  // Renamed 股利穩健→股利連續性 by analysis-ts 2026-09-20 (20d5ba4b), when they swept their own
  // copy for our compliance register's banned words and 穩健 was one of them. Keying on the name
  // means a rename silently drops the link: /screener went from 7 template links to 6 and
  // check-hub-pages caught it. The SLUG stays dividend-stability on purpose — it is a live,
  // sitemap-listed URL, and nothing about the page's subject changed.
  股利連續性: 'dividend-stability',
  // 財務韌性 → 安全韌性 2026-09-21, the LAST of the four surfaces that carried the old word
  //（「跟他們說要全面改為安全韌性」）. This key is bff-ts's own PresetTemplate NAME, which was a
  // same-name coincidence with analysis-ts's metric category rather than a downstream of it — so
  // it needed its own request to bff-ts and its own commit (a86c1b5) after analysis-ts had already
  // renamed theirs. Verified live before changing this line: GET /screener/templates now returns
  // 安全韌性.
  //
  // This is the key that MUST move in lockstep with that rename and can only be verified by
  // running scripts/check-hub-pages.mjs: nothing errors when it goes stale, /screener just quietly
  // renders one fewer template link — which is exactly how 股利穩健→股利連續性 was caught on
  // 2026-09-20. The SLUG stays financial-resilience（a live sitemap URL; the page's subject didn't
  // change with its label), same call as dividend-stability keeping its own.
  安全韌性: 'financial-resilience',
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
  // Which GET /stocks/:symbol/metrics-history basis the 目前值 card's own history chart uses
  // (2026-09-21, direct request「gross-margin 這邊的 el-card__body 也要用圖表，以後只要是諸如 EPS
  // 營收 ROA 這種指標，就要有圖表」— every future badge with a real historical series gets one).
  // Absent on `ownRoute` entries (that dedicated page wasn't part of this request) and on any
  // future badge whose only cadence is EOD (a snapshot value has no periods to bar-chart at all —
  // metrics-history rejects any basis but EOD for a metricCode like that, confirmed live for
  // liveGrahamNumber itself). Not necessarily the same value METRIC_PAGES' own `timeframe` would
  // pick for the same metricCode — a badge's headline cadence and a metric page's needn't agree.
  chartTimeframe?: 'TTM' | 'Q' | 'FY'
  // Render StockValuationRiverChart instead of the 目前值 bar chart（2026-09-21,「PSR 是不是也用
  // 河流圖比較適合?」）. Same field and same meaning as MetricPageDefinition's own, and the same
  // hard requirement: a 河流圖 needs a per-share base to build its bands from, so only a ratio of
  // 股價 ÷ (something per share) can carry one. `chartTimeframe` is then unused for this entry.
  riverKind?: 'pe' | 'pb' | 'ps'
}

export const BADGE_PAGES: BadgePageDefinition[] = [
  // Rendered by app/pages/stock/[code]/f-score.vue, which reads its own topic/titleKeywords from
  // this entry so the two can't drift.
  { slug: 'f-score', metricCode: 'piotroskiFScore', topic: 'Piotroski F-Score', titleKeywords: 'Piotroski F-Score 9 項訊號', ownRoute: true },
  // chartTimeframe: TTM, not the raw metricCode's own basis — liveGrahamNumber itself is
  // EOD-only (a live price × static book-value computation, not a filed quarterly figure) and
  // metrics-history rejects any other basis for it, confirmed live. grahamNumber (already this
  // entry's provenanceMetricCode, reused here for the exact same "no EOD equivalent" reason) only
  // offers TTM — its own Q request 400s, also confirmed live.
  // topic is 葛拉漢倍數, NOT「Graham Number」/「葛拉漢數字」— corrected 2026-09-21. Both
  // liveGrahamNumber and grahamNumber carry `formulaLatex: PER_TTM × PBR` with `unit: 倍`, and the
  // badge tests that product against 22.5（Graham's own PER 15 × PBR 1.5 ceiling）. That is the
  // Graham MULTIPLE.
  //
  // The textbook Graham Number, √(22.5 × EPS × BVPS), is deliberately NOT what this site computes,
  // and the reason is regulatory rather than technical（stated directly:「Graham Number 不能用元為
  // 單位價格 避免觸法 所以是改用葛拉漢倍數」）: that formula outputs a price in 元 that a reader
  // compares a share price against, which is a 目標價 — one of the compliance register's own banned
  // words（shared/utils/compliance-words.ts）. The multiple carries the same idea as a dimensionless
  // ratio with nothing to read as a price. Do not "fix" this metric toward the textbook form.
  //
  // The page was printing「台積電目前的Graham Number為 266倍」beside「門檻 < 22.5」, two incompatible
  // scales on one line, purely because this entry's `topic` still said Graham Number.
  //
  // The SLUG stays `graham-number`: it is a live, sitemap-listed URL and the subject of the page
  // did not change, only its name — same call as 股利穩健→股利連續性 keeping dividend-stability.
  // GET /metrics' own `name` for these two still says 葛拉漢數字 while its `badge.name` says
  // 葛拉漢倍數; this entry follows the badge name, the one that matches both the formula and the
  // reason above. Reported to analysis-ts.
  { slug: 'graham-number', metricCode: 'liveGrahamNumber', provenanceMetricCode: 'grahamNumber', topic: '葛拉漢倍數', titleKeywords: '葛拉漢倍數 本益比×淨值比', chartTimeframe: 'TTM' },
  // TTM — and deliberately NOT switched to Q with every METRIC page on 2026-09-21（「請讓指標預設只
  // 用單季數字」）. It was switched, measured, and switched back the same hour, because on a BADGE
  // page this value is not ours to choose: GET /stocks/:symbol/badges returns its own `timeframe`
  // per badge（TTM for grossMargin/netProfitMargin/roe, Q for piotroskiFScore, EOD for
  // liveGrahamNumber — read live, not assumed）, and that is the basis the published THRESHOLD is
  // evaluated at. With a Q chart the page stated two different current 毛利率 for 2330 at once:
  // 64.23%（TTM, the badge's own number, beside「門檻 ≥ 40% 本期符合」）and 67.72%（Q, the chart's
  // newest bar）. The instruction's reason was search behaviour, which a self-contradicting page
  // does not serve. These follow the badge's own basis instead, and move to Q if and when
  // analysis-ts evaluates these thresholds at Q. The METRIC pages below carry the change in full —
  // they have no backend-pinned basis to disagree with.
  { slug: 'roe', metricCode: 'roe', provenanceMetricCode: 'roe', topic: '股東權益報酬率', titleKeywords: 'ROE 股東權益報酬率與門檻', chartTimeframe: 'TTM' },
  { slug: 'gross-margin', metricCode: 'grossMargin', provenanceMetricCode: 'grossMargin', topic: '毛利率', titleKeywords: '毛利率與護城河門檻', chartTimeframe: 'TTM' },
  // 稅後淨利率 2026-09-21（「sidebar 獲利能力 加上 財報三率」）— the 三率's third rate, and the only
  // one of the three that belongs in THIS registry: checked live rather than assumed, it has a real
  // per-company badge in GET /stocks/:symbol/badges（巴菲特淨利率, Mary Buffett & Clark 2008 — the
  // same book grossMargin's own badge above cites）, hasProvenance: true, full catalog
  // description/limitations/misreadings, and TTM+Q history (20 periods on 2330, 10 on 1101). Same
  // TTM chart cadence as its two siblings so the 三率 read consistently against each other.
  // 營業利益率, the middle rate, is in METRIC_PAGES instead — it has no badge at all.
  { slug: 'net-profit-margin', metricCode: 'netProfitMargin', provenanceMetricCode: 'netProfitMargin', topic: '稅後淨利率', titleKeywords: '稅後淨利率與獲利門檻', chartTimeframe: 'TTM' },
  // 市場估值 2026-09-21（「Sidbear 下面 加開 市場估值，裡面就放 PER PBR PSR等等」）— the two of that
  // group's members that have real badges. `topic` is the ACRONYM rather than the Chinese name on
  // all four of the group's pages: PER/PBR/PSR/PEG are what this market actually calls these
  // ratios and what a searcher types, and `topic` is what both the <h1> and（for the metric pages）
  // the generated title lead with. The Chinese name rides along in titleKeywords.
  //
  // psr: full catalog copy and a real per-company badge, verified live（20/20 TTM periods on 2330）.
  // It reads 0 periods for a financial（2891）, which is correct — a bank has no 營業收入 to divide
  // the price by — and those pages noindex on their own.
  { slug: 'psr', metricCode: 'psr', provenanceMetricCode: 'psr', topic: 'PSR', titleKeywords: 'PSR 股價營收比與門檻', riverKind: 'ps' },
  // peg: the exact liveGrahamNumber shape above — an EOD-only badge metric（livePegRatio, a live
  // price × static growth computation）with a quarterly-basis twin for the chart and the
  // calculation audit. Its series is genuinely SPARSE（7/20 periods on 2330, 0 on 1101 and 2891):
  // PEG needs a growth rate to exist at all, so a company without one has no value in that period.
  // Kept anyway because the badge value, its threshold and the provenance table all still render —
  // the chart is the only part that thins out, and that is honest rather than misleading.
  { slug: 'peg', metricCode: 'livePegRatio', provenanceMetricCode: 'pegRatio', topic: 'PEG', titleKeywords: 'PEG 本益成長比與門檻', chartTimeframe: 'TTM' },
  // 安全韌性 2026-09-21（「sidebar 底下增加此 分類 底下要放入 流速動比 長債比例 等等的 指標」）—
  // the two members of that group that have real badges. chartTimeframe follows each badge's OWN
  // timeframe, read live rather than assumed（currentRatio evaluates at Q, interestCoverage at
  // TTM）: the 2026-09-21 basis round-trip established that a badge page whose chart disagrees with
  // the basis its threshold was evaluated at prints two different "current" values on one page.
  { slug: 'current-ratio', metricCode: 'currentRatio', provenanceMetricCode: 'currentRatio', topic: '流動比率', titleKeywords: '流動比率短期償債能力', chartTimeframe: 'Q' },
  { slug: 'interest-coverage', metricCode: 'interestCoverage', provenanceMetricCode: 'interestCoverage', topic: '利息保障倍數', titleKeywords: '利息保障倍數與償債門檻', chartTimeframe: 'TTM' },
  // 獲利品質 2026-09-21 — the one member of that group with a badge. chartTimeframe follows the
  // badge's own timeframe（TTM, read live）for the reason the 2026-09-21 basis round-trip
  // established: a badge page whose chart disagrees with the basis its threshold was evaluated at
  // prints two different "current" values on one page.
  { slug: 'accruals-ratio', metricCode: 'accrualsRatio', provenanceMetricCode: 'accrualsRatio', topic: '應計項目比率', titleKeywords: '應計項目比率與盈餘品質', chartTimeframe: 'TTM' },
  // 盈餘創新高比率 — the first percentileRank badge to get a page（2026-09-21）. Its threshold is
  // RELATIVE（顧廣平等 2025 的五分位排名, 前 20%）rather than an absolute number, so the page states
  // the symbol's own rank alongside the verdict; see StockBadgeEntry.rank's own note for why that
  // is load-bearing rather than decoration, and for the compliance wording it has to stay inside.
  //
  // It could not be a page at all a few hours earlier: hasProvenance was false, and a badge page's
  // 計算依據 table is its only SSR table（every sub-page needs one）. I wrote that off as a wall
  // and was corrected —「為什麼不能驗證？可以跟analysis提需求啊」— so it was requested instead, and
  // analysis-ts shipped it the same day（fd8d276e）. The chain turned out to be better than a
  // typical one: its second entry names WHICH quarter the record high was（2330: 2026 Q1,
  // 572,479,752）, which is the question a reader actually has about a "record high" metric.
  { slug: 'earnings-to-record-high', metricCode: 'earningsToRecordHigh', provenanceMetricCode: 'earningsToRecordHigh', topic: '盈餘創新高比率', titleKeywords: '盈餘創新高比率與前 20% 門檻', chartTimeframe: 'Q' }
]

export function findBadgePage(slug: string): BadgePageDefinition | null {
  return BADGE_PAGES.find(page => page.slug === slug) ?? null
}

// The metricCode the 目前值 chart should actually query — provenanceMetricCode when the badge has
// one (same substitution the calculation-audit table already makes, and for the same reason: the
// badge's own metricCode may have no regular historical series of its own), else metricCode
// itself. One function rather than repeating `provenanceMetricCode ?? metricCode` at each of the
// two call sites (badge.get.ts's own fetch, StockBadgeDetailPage.vue's own chart prop).
export function badgePageChartMetricCode(page: BadgePageDefinition): string {
  return page.provenanceMetricCode ?? page.metricCode
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

// 指標專頁 — /stock/{code}/{slug} for a metric that has NO badge (2026-09-20, direct request:
// 「stock/2330/eps 這樣的，我希望造訪的人除了看到 2330 EPS 多少，也可以知道甚麼是 EPS」, with
// 「未來月營收等等的指標也可以比照這個模板去做」as the explicit goal).
//
// A SEPARATE registry and a separate template component from BADGE_PAGES above, per direct
// decision（「我認為把徽章與指標頁面區分成兩個模板會比較容易些」）. They genuinely need different
// pages: a badge page's spine is its threshold（符合/未符合）and its calculation-audit table, and
// EPS has neither — it has a value, a history, and a definition. Sharing one template would mean
// a body of `v-if="isBadge"` in every section.
//
// Both registries feed the SAME catch-all route, app/pages/stock/[code]/[slug].vue, because Nuxt
// allows only one dynamic segment per directory. That file is a thin dispatcher: it resolves the
// slug against both registries and mounts the matching template. The two slug spaces must
// therefore stay disjoint — assertMetricPagesDisjoint() below is the runnable check for that.
export interface MetricPageDefinition {
  // URL segment, hand-written like BADGE_PAGES' own (same reasoning), and never colliding with a
  // badge slug or with one of the named sibling routes (dividend, balance-sheet, …) — Nuxt
  // resolves those static files first, so a collision would silently shadow this page.
  slug: string
  // GET /metrics' key, also what GET /stocks/:symbol/metrics-history takes.
  metricCode: string
  // Which period basis this page's DATA is read at — the history table, the chart's default, and
  // the 近四季 figure in its lead sentence. Not the same question as which basis the page's COPY
  // leads with: 2026-09-21 went round both（first「請讓指標預設只用單季數字」, then, once the
  // consequences were measured,「那就照樣使用TTM，但是文案上單季優先。而且要連動網頁title」）and the
  // settled answer is TTM here, 單季 first in the prose and in the <title>. StockMetricDetailPage
  // fetches its own Q figure alongside this for that sentence; see its own comment.
  //
  // Must be one the metric actually offers — asking for a basis a metric has no data for yields an
  // empty series, not an error. Measured live per metricCode rather than read off the catalog's
  // `fields`: dividendPayoutRatio / dividendCoverageRatio / shareholderYield have no Q basis at all
  //（TTM alone in `fields`, and a Q request returns zero periods）, so those three pages have no
  // 單季 sentence to lead with and fall back to the TTM one. Same measurement is why grahamNumber
  // keeps TTM in BADGE_PAGES above.
  timeframe: 'TTM' | 'Q' | 'FY'
  // <h1> third span and the breadcrumb's last crumb.
  topic: string
  // <title> long-tail phrase — same ≤32 CJK-equivalent budget as BadgePageDefinition.titleKeywords.
  titleKeywords: string
  // The metricCode for "how much did THIS QUARTER change vs. the same quarter last year" — always
  // queried at Q basis regardless of `timeframe` above, since a growth-rate figure only means
  // anything against a single quarter, never a rolling four-quarter sum. Optional: most metrics
  // won't have a real 年增率 sibling in the catalog at all yet, and this stays unset until one is
  // confirmed to exist (checked live via GET /metrics, not assumed from the metricCode's own name).
  quarterlyGrowthMetricCode?: string
  // Render StockValuationRiverChart instead of the default bar chart（2026-09-21,「我希望 PER PBR
  // 都改用河流圖 而非長條圖」）. Only these two pages set it: a 河流圖 needs a ratio AND the per-share
  // base it divides by（EPS for PE, 每股淨值 for PB）AND the price, so it is not something any
  // metric page can opt into — the component itself only knows those two shapes.
  riverKind?: 'pe' | 'pb' | 'ps'
}

export const METRIC_PAGES: MetricPageDefinition[] = [
  // quarterlyGrowthMetricCode: epsGrowthRate (2026-09-21, direct request「eps 要可以呈現單季與
  // YOY」, citing 財報狗's own「XX 2026年第2季EPS為0.28元，季增-24.32%，近四季EPS為1.51元」sentence
  // shape as the target). That example's own 季增 (QoQ) has no equivalent metricCode in this
  // catalog at all — only epsCagr3/5/8y (multi-YEAR) and epsGrowthRate (單季 vs. 去年同季, i.e.
  // YoY) exist, confirmed live — so this follows the request's own header wording (YOY) rather
  // than the quote's literal QoQ, substituting 年增 for 季增 in the built sentence.
  { slug: 'eps', metricCode: 'eps', timeframe: 'TTM', topic: 'EPS', titleKeywords: 'EPS 每股盈餘逐季數據', quarterlyGrowthMetricCode: 'epsGrowthRate' },
  // Three added 2026-09-21（「sidebar 配股配息底下要拆子項目，就像是獲利能力底下拆 EPS 出來一樣」）—
  // picked from a real data-completeness check, not the first three that came to mind. The most
  // intuitive candidate, 殖利率 (dividendYield), was checked and rejected: its only cadence is EOD
  // (a live-price snapshot, not a filed periodic figure), the same technical wall liveGrahamNumber
  // already hit — metrics-history rejects any TTM/Q/FY request for it. Request sent to
  // analysis-ts; 殖利率 is not one of these three and stays a leaf-page section on 配股配息 itself
  // until that's resolved. All three below verified live: real TTM history AND complete catalog
  // description/limitations/misreadings, the same two-part bar this app held EPS to.
  { slug: 'dividend-payout-ratio', metricCode: 'dividendPayoutRatio', timeframe: 'TTM', topic: '盈餘發放率', titleKeywords: '盈餘發放率配息保守或激進' },
  { slug: 'dividend-coverage-ratio', metricCode: 'dividendCoverageRatio', timeframe: 'TTM', topic: '股利保障倍數', titleKeywords: '股利保障倍數自由現金流支撐' },
  // shareholderYield's own TTM history is only 8 periods (2 years) as of this date — short of the
  // ~10-year bar this app otherwise holds fundamentals to, kept in anyway per direct decision
  // rather than held back the way 月營收 was for a much larger gap (1 symbol vs. the whole
  // market). Revisit if the depth doesn't grow.
  { slug: 'shareholder-yield', metricCode: 'shareholderYield', timeframe: 'TTM', topic: '股東總回饋率', titleKeywords: '股東總回饋率配息加買回庫藏股' },
  // 營業利益率 2026-09-21（「sidebar 獲利能力 加上 財報三率」）— the middle rate of 毛利率/營業利益率/
  // 稅後淨利率. It lands HERE rather than in BADGE_PAGES because it has no badge definition at all
  // in GET /metrics (its two siblings both do, and both are badge pages) — which is precisely the
  // split the two registries exist for.
  //
  // It shipped as the one entry here that did NOT clear the two-part bar the three above were held
  // to — its catalog description/limitations/misreadings were all null at the time (its DATA was
  // always fine: hasProvenance: true, TTM+Q, 20 periods on 2330), so StockMetricDetailPage's own
  // `noindex` computed fired on it and its「看營業利益率要注意什麼？」section didn't render. Shipped
  // anyway, unlike 月營收/殖利率 which stayed out: those two are blocked on DATA and would render an
  // empty page, while this one rendered a complete value/history/definition page for a visitor
  // arriving from the nav and simply stayed out of the index meanwhile.
  //
  // RESOLVED the same day: analysis-ts wrote the copy (face95d8) and bff-ts re-synced; verified
  // live that all four question sections render and the page-level noindex lifted. Worth keeping
  // the history because nothing in this file had to change for that — the sitemap handler filters
  // on the live catalog's own description (see server/api/__sitemap__/stocks.get.ts), so the page
  // rejoined the sitemap by itself（0 → 176 URLs, measured）with no flag here to remember to flip.
  // That is the pattern to reuse the next time a page is ready before its copy is.
  { slug: 'operating-margin', metricCode: 'operatingMargin', timeframe: 'TTM', topic: '營業利益率', titleKeywords: '營業利益率本業獲利占比' },
  // 市場估值 2026-09-21（「Sidbear 下面 加開 市場估值，裡面就放 PER PBR PSR等等」）— the two members
  // with no badge; PSR and PEG are in BADGE_PAGES above.
  //
  // The metricCode matters more here than on any other entry in this file: the catalog carries TWO
  // metrics for each of these ratios, and only one of each pair is usable. `exchangePeRatio` /
  // `exchangePbRatio` are the exchange's own published figures and are EOD-ONLY（no provenance
  // either）, so metrics-history has nothing to return for them — the same wall 殖利率 and
  // liveGrahamNumber already hit. `peRatio` / `pbRatio` are the computed ones and both carry a real
  // series（20/20 periods on 2330, measured）plus hasProvenance: true, so the calculation-audit
  // chain works. Do not "simplify" these to the exchange codes because the names look more
  // official.
  { slug: 'pe-ratio', metricCode: 'peRatio', timeframe: 'TTM', topic: 'PER', titleKeywords: 'PER 本益比與歷年區間', riverKind: 'pe' },
  // The FIRST Q-only metric page（pbRatio's `fields` is Q alone, not a choice made here）. That
  // made it the first one where `latest` and the page's own 單季 figure are the same period, which
  // StockMetricDetailPage's hasTrailingFigure now guards — see its own comment.
  { slug: 'pb-ratio', metricCode: 'pbRatio', timeframe: 'Q', topic: 'PBR', titleKeywords: 'PBR 股價淨值比逐季數據', riverKind: 'pb' },
  // 安全韌性 2026-09-21 — the three members with no badge; 流動比率 and 利息保障倍數 are in
  // BADGE_PAGES above. All three are Q-only（`fields` is Q alone for each）, which is why they carry
  // no 近四季 clause: StockMetricDetailPage's hasTrailingFigure guards that, first needed for
  // pb-ratio above.
  //
  // What is NOT here, and why — the request asked for「流速動比 長債比例 等等」and 長債比例 has no
  // usable metric behind it. Measured across 2330/1101/1216/2891: longTermDebtToNetCurrentAssets
  // returns a series 8 periods deep on 2330 and ONE period elsewhere, and totalDebtToCapital /
  // equityRatio / debtToFcf are the same one-period shape. A page whose history table has a single
  // row is the thin content this page family exists to avoid. debtRatio（總負債÷總資產）and
  // deRatio（總負債÷股東權益）are the leverage ratios that do carry real depth everywhere, so they
  // stand in for that part of the request; revisit if the long-term-specific series is backfilled.
  //
  // Also deliberately excluded although they sit in the same catalog category: altmanZScore,
  // altmanZDoublePrimeScore, ohlsonOScore and zmijewskiScore. Those are multi-variable regression
  // SCORES — the same「複合運算 徽章性質遠勝於指標性質」test that took 葛拉漢倍數 and PEG out of the
  // nav the same day. The five bank-only ratios（bankCarRatio, bankCet1Ratio, …）are out for a
  // different reason: they read 不適用 on ~95% of symbols.
  { slug: 'quick-ratio', metricCode: 'quickRatio', timeframe: 'Q', topic: '速動比率', titleKeywords: '速動比率扣除存貨的償債力' },
  { slug: 'debt-ratio', metricCode: 'debtRatio', timeframe: 'Q', topic: '負債比率', titleKeywords: '負債比率總負債佔總資產' },
  // 有息負債權益比 — written, PULLED before shipping, and re-added the same hour once analysis-ts
  // fixed the defect it was pulled for (commit 8f7b4ddd). The entry printed「2330 負債權益比為
  // 13.4倍」for a figure that is 13.44%: its `formulaLatex` multiplies by 100 while its `unit` said
  // 倍, a hundredfold misstatement. Caught by sanity-checking it against debtRatio（30.94%）and
  // equityRatio（69.06%）— a real total-liability D/E would be ~0.45, so 13.4 could not be 倍.
  // analysis-ts confirmed the stored values were always percentages and only the unit label was
  // wrong; no value changed, so re-adding needed nothing but this line back.
  //
  // `topic` and the slug both follow the RENAMED metric: they also took the second half of that
  // report and renamed it 負債權益比 → 有息負債權益比, because the numerator is deliberately only
  // 有息負債 while the conventional D/E is 總負債 ÷ 權益. The slug is spelled out for the same
  // reason — `debt-to-equity` would have promised the conventional ratio. Nothing was published
  // under the old slug (it 404'd the whole time it was pulled), so there is no URL to preserve.
  { slug: 'interest-bearing-debt-to-equity', metricCode: 'deRatio', timeframe: 'Q', topic: '有息負債權益比', titleKeywords: '有息負債權益比槓桿水準' },
  // 長期負債對淨流動資產比 — the「長債比例」the 安全韌性 request named, added once analysis-ts
  // backfilled it（2026-09-21, same day）. It was left out at first on measurement, not on
  // principle: the series was 8 periods on 2330 and ONE everywhere else, and a history table with
  // a single row is the thin content this page family exists to avoid. Re-measured after the
  // backfill: 10/10 on 2330, 1101 and 2454.
  //
  // 1216 still reads 1 of 10 and that is CORRECT rather than a remaining gap — a food company
  // carrying no long-term debt has no ratio to report for most quarters. The page shows 尚無資料
  // per period, which is the honest rendering of "this company doesn't have this".
  { slug: 'long-term-debt-to-net-current-assets', metricCode: 'longTermDebtToNetCurrentAssets', timeframe: 'Q', topic: '長期負債對淨流動資產比', titleKeywords: '長期負債對淨流動資產比' },
  // 成長動能 2026-09-21（「sidebar 加一個成長動能，裡面放 淨值成長 投資支出 等等」）. None of the
  // five has a badge, so all five are metric pages. Every one is Q-only（`fields` is Q alone）,
  // measured live at full depth for non-financials（20 periods on 2330, 10 on 1101/1216）and unit
  // '%' with hasProvenance: true throughout.
  //
  // The first three are one-step YoY growth of a filed figure — 本季 vs 去年同季 of 營收 / 淨利 /
  // 淨值, one per statement. Excluded from that category by the same「更忠於財報」test as the two
  // groups before it: ruleOf40（a SaaS heuristic summing two rates）, sue（a statistical surprise
  // measure）, sgr（永續成長率, ROE × retention, badge-backed）, priceToResearchRatio（price-based
  // AND composite）and threeMarginsRising（already answered on /margins）. The six CAGR variants
  //（epsCagr3/5/8y, revenueCagr3/5/8y）are statement-faithful but would be six near-duplicate nav
  // rows at FY depth, so they stay out for length rather than for principle.
  //
  // capexToRevenue is the one entry whose CATALOG CATEGORY is not 成長動能 — GET /metrics files it
  // under 營運效率. It is here because the request named 投資支出, and capital spending as a share
  // of revenue is what that means on a filed statement. A deliberate exception to the「nav group
  // name matches the catalog category」rule the other groups follow, recorded rather than hidden:
  // the rule exists so membership is derivable from the catalog, and this one row isn't.
  { slug: 'revenue-growth', metricCode: 'revenueGrowthRate', timeframe: 'Q', topic: '營收成長年增率', titleKeywords: '營收成長年增率逐季變化' },
  { slug: 'net-income-growth', metricCode: 'netIncomeGrowthRate', timeframe: 'Q', topic: '淨利成長年增率', titleKeywords: '淨利成長年增率逐季變化' },
  { slug: 'equity-growth', metricCode: 'equityGrowthRate', timeframe: 'Q', topic: '淨值成長年增率', titleKeywords: '淨值成長年增率逐季變化' },
  { slug: 'capex-to-revenue', metricCode: 'capexToRevenue', timeframe: 'Q', topic: '資本支出佔營收比', titleKeywords: '資本支出佔營收比投資強度' },
  { slug: 'rd-intensity', metricCode: 'rdIntensity', timeframe: 'Q', topic: '研發費用率', titleKeywords: '研發費用率佔營收比重' },
  // 獲利品質 2026-09-21（「獲利品質需要跟獲利能力分開做嗎？」— yes, and these are the four members
  // with no badge; 應計項目比率 is in BADGE_PAGES above）. A separate group from 獲利能力 because it
  // answers a different question: 獲利能力 is how MUCH profit, 獲利品質 is whether that profit is
  // backed by cash rather than by accruals.
  //
  // All four measured live at full depth on the symbols sampled（20 periods on 2330, 10 on
  // 1101/1216）, with hasProvenance: true throughout. Excluded from the same 15-metric category by
  // the standing「更忠於財報，避免複合運算」test: beneishMScore and its two sub-indices
  //（beneishAqi / beneishDsri）, piotroskiFScore（no provenance, and it has its own dedicated page
  // already）, and abnormalCapexRatio（a modelled deviation, not a filed ratio）. fcfMargin is out
  // for depth alone — 1 period on everything but 2330, one of the "added after the historical
  // backfill" batch, so revisit if that one is filled too.
  //
  // consecutiveProfitYears is the only FY-basis entry in this registry. The template handles it
  //（periodLabel drops the quarter for FY）and its unit is 年 rather than a percentage, which is
  // also why it carries no 單季 sentence: there is no Q basis to lead with.
  { slug: 'ocf-to-net-income', metricCode: 'ocfToNetIncome', timeframe: 'TTM', topic: '營業現金流對淨利比', titleKeywords: '營業現金流對淨利比' },
  { slug: 'fcf-conversion-rate', metricCode: 'fcfConversionRate', timeframe: 'TTM', topic: 'FCF 轉換率', titleKeywords: 'FCF 轉換率現金含金量' },
  { slug: 'ocf-margin', metricCode: 'ocfMargin', timeframe: 'TTM', topic: 'OCF 利潤率', titleKeywords: 'OCF 利潤率營收轉現金比率' },
  { slug: 'consecutive-profit-years', metricCode: 'consecutiveProfitYears', timeframe: 'FY', topic: '連續獲利年數', titleKeywords: '連續獲利年數不中斷紀錄' }
]

export function findMetricPage(slug: string): MetricPageDefinition | null {
  return METRIC_PAGES.find(page => page.slug === slug) ?? null
}

// Runnable check for the one invariant that silently breaks pages rather than erroring: a slug
// claimed by both registries would render whichever template the dispatcher happens to test
// first, and the other page would be unreachable with no error anywhere. Called from the
// dispatcher itself in dev.
export function assertMetricPagesDisjoint(): void {
  const collision = METRIC_PAGES.find(page => BADGE_PAGES.some(badge => badge.slug === page.slug))
  if (collision) throw new Error(`[hub-slugs] slug "${collision.slug}" is in both METRIC_PAGES and BADGE_PAGES`)
}
