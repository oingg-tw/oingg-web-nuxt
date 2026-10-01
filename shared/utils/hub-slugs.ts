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

// 13 與 19 在 SECTORS 裡是為了讓代號對照完整，但產業頁打不開——**而「打不開」有兩個不同的原因，
// 兩個都成立**：
//
//   19（綜合）：交易所有這個代號，`/industries/securities-sectors` 也回 companyCount 0，真的沒成員。
//   13（電子工業（舊分類））：`/industries/securities-sectors` 說它有 **33 家**，而 `GET /stocks`
//     全部 2,349 筆裡 sectorCode 是 '13' 的是 **0 筆**（2026-10-01 全查）。兩支上游端點互相矛盾，
//     已回報。產業頁的公司表是從 /stocks 建的，所以不管哪一邊對，那一頁現在都是空的。
//
// 這個集合在 `sectorPath()` 裡擋，不是在呼叫端：有 10 處會把類股代號變成連結（首頁、/screener、
// /industries、/stock、產業頁的「其他類股」、個股麵包屑、sitemap），其中大多數是直接相信代號在
// SECTORS 裡就連過去。實測症狀是 /screener 的膠囊寫著「電子工業（舊分類）（33）」而點進去 404
// ——check-click-depth 抓到的就是這一條。一個共用函式裡的守衛比十個呼叫端各加一個判斷小。
//
// 靜態清單而不是打 /api/hub/directory：類股的增減是交易所幾年一次的事，跟著 SECTORS 一起手動
// 維護就夠；真的漏了，check-hub-pages 會在那一頁抓到 404。
const EMPTY_SECTOR_CODES = new Set(['13', '19'])

export function sectorPath(code: string): string | null {
  const sector = SECTORS[code]
  if (!sector || EMPTY_SECTOR_CODES.has(code)) return null
  return `/industry/${code}-${sector.slug}`
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
  // 年增率排行專用的基期門檻（2026-10-01）。**只對成長率欄位有意義**，因為它靠
  // `基期 = 現值 ÷ (1 + 年增率/100)` 反推，那個關係只在「年增率是用同一個欄位前後期算出來的」時成立。
  //
  // 為什麼需要它：/rank/revenue-growth 的前 50 名**全部 ≥100%**、中位數 541%、榜首 24852%，而前三名
  // 的基期每股營收是 0.0016、0.0425、0.0060 元——它排的不是成長，是「去年同期幾乎沒有營收」。建設業
  // （完工入帳）與證券商因此長期佔據榜單。這跟 2026-09-22 撤掉 /rank/consecutive-dividend-years
  // 的理由同一類：榜單沒有在排序它宣稱的那件事。使用者 2026-10-01 選擇加門檻而不是撤頁。
  //
  // `minBase` 用誤差預算推導、不是挑觀測值：`revenuePerShare` 只報到小數兩位，基期的四捨五入誤差是
  // ±0.005，而年增率對基期的相對誤差就是 0.005/基期。要把那個誤差壓到 1% 以內，基期必須 ≥ 0.5。
  // 實測（2026-10-01，50 列）：0.5 保留 29 列、榜首換成 7740 熙特爾-創 1938%，而它的基期是 3.86 元
  // ——78.62 ÷ 3.86 是真的二十倍成長，不是除以零的假象。
  growthBaseFloor?: { valueField: string; minBase: number }
}

export const RANK_PAGES: RankPageDefinition[] = [
  { slug: 'dividend-yield', field: 'dividendYield.EOD', direction: 'desc', label: '殖利率', metricCode: 'dividendYield' },
  { slug: 'pe-ratio-low', field: 'exchangePeRatio.EOD', direction: 'asc', label: '本益比', metricCode: 'exchangePeRatio' },
  { slug: 'pb-ratio-low', field: 'exchangePbRatio.EOD', direction: 'asc', label: '股價淨值比', metricCode: 'exchangePbRatio' },
  { slug: 'roe', field: 'roe.TTM', direction: 'desc', label: 'ROE', metricCode: 'roe' },
  // 每股盈餘 HAD A PAGE HERE（/rank/eps）—— 2026-10-01 使用者直接指示撤掉：
  //「eps 由高到低前 50 檔 這個沒有意義，可以拿掉。如果是EPS成長排行就有意義。」
  //
  // 理由不是資料壞掉（跟連續配息年數那次不同），是這個排序本身不帶資訊：每股盈餘的高低幾乎只反映
  // 股本大小與面額，而不是賺錢的能力。一家把股本維持得很小的公司 EPS 自然高，跟一家配股配到股本
  // 很大的公司放在同一個榜上比大小，比出來的是股本結構。讀者會把它讀成「最會賺錢的 50 家」。
  //
  // **要還原的條件不是日期，是換成成長率**。而換成 epsGrowthRate 之前必須先量兩件事，因為它會踩到
  // 跟 /rank/revenue-growth 同一個坑、而且多一個更糟的：
  //   1. 基期接近零 → 年增率被放大（revenue-growth 的 growthBaseFloor 處理的就是這個）。
  //   2. **基期是負的** → 從虧損轉盈的公司年增率是負數或正負號翻轉，而「成長率最高」會變成
  //      數學假象。EPS 可以是負的，營收不會，所以 growthBaseFloor 那一招直接搬過來不夠。
  // 2026-10-01 當下 analysis-ts 正在部署、`/screener/ranking` 回 502，量不到分佈，所以先不開頁。
  // epsGrowthRate 只有單季（Q）一個期別，這一點已經確認。
  // 連續配息年數 HAD A PAGE HERE and will again — removed 2026-09-22 because the field cannot
  // currently rank anything, not because the ranking is a bad idea.
  //
  // Measured on the live market the day it was pulled: >=1 是 1,490 家、>=3 是 1,024、>=5 是 890、
  // >=6 只有 1 家、>=8 是 0。889 家的值剛好都是 5, and the single exception is 2330 at 7. A top-50
  // page built on that is 台積電 followed by the 49 LOWEST STOCK CODES among 889 tied companies —
  // an arbitrary subset of the market presented as a ranking, which is the one thing this zone
  // must not publish.
  //
  // The cause is upstream and structural（analysis-ts, same day）: the metric reads 現金流量表 to
  // decide whether a year paid a dividend, and mops's XBRL only opens up at 109Q3, so 110–114 is
  // the deepest run of complete years most companies have. The number is therefore CENSORED —「5」
  // means「至少 5」— which is also why 1101 台泥 reads 5 while our own 股利分派公告 data
  //（/stocks/1101/dividend-history）shows 2018–2025 unbroken. Two sources, different depths.
  //
  // RESTORE THIS LINE when FY115 closes（~2027 Q1）: the ceiling becomes 6 and the tie starts to
  // break up. Re-measure the distribution first — restore it only once the top 50 spans more than
  // one value. Nothing else needs changing; the metric itself still renders on the stock pages and
  // in the screener, where「至少 N 年」is a fact about the company rather than a rank order.
  { slug: 'market-cap', field: 'liveMarketCap.EOD', direction: 'desc', label: '市值', metricCode: 'liveMarketCap' },
  { slug: 'revenue-growth', field: 'revenueGrowthRate.Q', direction: 'desc', label: '單季營收成長年增率', metricCode: 'revenueGrowthRate', growthBaseFloor: { valueField: 'revenuePerShare.Q', minBase: 0.5 } }
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
// EVERY per-stock badge page is listed here — the sitemap's enumeration and the badge table's
// per-row link both read this one list, so a page that is not here has no link and no URL. That
// is what makes deleting a page a one-line change (2026-09-28 removed three; see the list's own
// comment below).
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
  provenanceMetricCode?: string
  // <h1> third span and the breadcrumb's last crumb.
  topic: string
  // <title> long-tail phrase, sized so `{短名} {代碼} {titleKeywords}` + brand suffix stays
  // ≤ 32 CJK-equivalent chars (scripts/check-stock-pages.mjs's cjkLength) — verify per entry.
  titleKeywords: string
  // Which GET /stocks/:symbol/metrics-history basis the 目前值 card's own history chart uses
  // (2026-09-21, direct request「gross-margin 這邊的 el-card__body 也要用圖表，以後只要是諸如 EPS
  // 營收 ROA 這種指標，就要有圖表」— every future badge with a real historical series gets one).
  // Absent on any
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
  // 一起畫在圖上的第二支指標，同 MetricPageDefinition 的同名欄位。**配對由我們決定，讀者沒有選單**
  // （2026-09-29 做過讓讀者自選的版本，使用者判斷「很混淆難用」）。只有在「這一支單獨看會被誤讀、
  // 而某一支剛好能說明誤讀的來源」時才設，不是每頁都配一個。
  compareMetricCode?: string
  // Other /stock/{code}/… pages worth reading next — same field and same rule as
  // MetricPageDefinition's own, whose comment carries the reasoning.
  related?: string[]
}

export const BADGE_PAGES: BadgePageDefinition[] = [
  // 三頁刪除 2026-09-28（「徽章不要歷史，有歷史的只有指標」）。f-score、graham-number、peg 是當時唯一
  // **只有徽章那一列連得到**的三頁——量過：其餘七頁（roe／gross-margin／net-profit-margin／psr／
  // current-ratio／interest-coverage／accruals-ratio）同時是 STOCK_METRIC_INDEX 的目的地，也就是站上
  // 自己把它們當指標，所以它們留著、歷史也留著。刪掉的那三支回到型錄裡另外 23 支有徽章卻沒有頁的處理
  // 方式：徽章表格那一列改開對話框（StockFinancialHighlightsRisksCard 的 badgePageFor 找不到就渲染
  // 按鈕，不必另外改）。Piotroski 的九項訊號沒有消失——StockGuruBadgeDialog 本來就會渲染 breakdown。
  //
  // 刪除連帶拿掉的東西記在這裡，因為它們單看各自的檔案會像沒有理由的殘骸：`ownRoute` 欄位（只有
  // f-score 用過）、[slug].vue 對它的 404 防線、SERIES_PLANS 的 'f-score' 計畫與 cachedPiotroskiBreakdown
  // （只有那個計畫在用；對話框走自己的 composable 直打 bff）、check-stock-pages 對 /f-score 的
  // ssrTables 豁免。
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
  // 杜邦分析 is the page that answers what this badge only states: ROE is the product of five
  // things, and knowing which one moved is the whole reason to look at ROE at all.
  // 預設對照 ROA（2026-09-29,「roe 這一頁 要怎麼跟 借錢多 搭在一起看?」）。ROE 與 ROA 的分子相同、
  // 分母一個是自有資本一個是全部資產，所以兩者的差就是「資產裡有多少不是股東出的」——借錢多寡是
  // 算術結果，不是判斷。抽 60 檔最新一期實測：負債比率最低 1/3（平均 27%）的 ROE−ROA 平均 1.9pp，
  // 最高 1/3（平均 64%）平均 10.3pp，78% 的公司 ROE ≥ ROA。選 ROA 而不是負債比率本身，是因為
  // debtRatio 只有單季、跟這一頁徽章釘住的 TTM 共不了軸；讀者切到單季後仍可自己選它。
  { slug: 'roe', metricCode: 'roe', provenanceMetricCode: 'roe', compareMetricCode: 'roa', topic: '股東權益報酬率', titleKeywords: 'ROE 股東權益報酬率與門檻', chartTimeframe: 'TTM', related: ['dupont', 'roa', 'eps'] },
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
  { slug: 'psr', metricCode: 'psr', provenanceMetricCode: 'psr', topic: '股價營收比', titleKeywords: 'PSR 股價營收比與門檻', riverKind: 'ps' },
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
  // 盈餘創新高比率 — PULLED 2026-09-22, one day after shipping. analysis-ts retired the badge
  // itself（354f590d）, and a badge page with no badge has nothing left to be: this template's
  // whole subject is「這檔股票過了這個門檻嗎」, and the threshold, the citation and the verdict all
  // came from that badge object. The metric still exists in the catalog, so this could return as a
  // METRIC page（METRIC_PAGES below）if it earns one — but not on its own: its own series is Q-only
  // percentile data, which is the thin-history shape that keeps other entries out of that list too.
  //
  // Kept as a comment because of how it got here: hasProvenance was false, I wrote it off as
  // impossible, and was corrected —「為什麼不能驗證？可以跟analysis提需求啊」— so it was requested
  // and shipped the same day（fd8d276e）. That lesson stands even though the page didn't; the entry
  // is gone for a reason that has nothing to do with the one I originally gave.
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
  // Other /stock/{code}/… pages worth reading next, as slugs from EITHER registry.
  //
  // Added 2026-09-22 from「我在想該不該把EPS、淨利與淨利成長合成一頁面，分開總覺得哪裡怪怪的，資訊
  // 散落」. The scatter is real and was measured: EPS sits in the nav's 獲利能力 group while EPS 成長
  // 年增率 and 淨利成長年增率 sit in 成長動能 — a reader who finishes the EPS page has no route to the
  // growth figure for the same thing.
  //
  // MERGING those pages was the obvious fix and is the wrong one, for two reasons worth recording
  // so it doesn't get proposed again:
  //
  //   * /eps is one of this family's highest-value pages（「2330 EPS」is a real query with real
  //     volume）and the family exists for exactly those long-tail searches. Folding it into a
  //     combined page throws that away.
  //   * A combined page would have to be a RELATIONSHIP page（the /margins, /solvency, /dupont
  //     shape）, and those earn their place on an arithmetic identity that actually holds. This one
  //     does not:（1+EPS成長）=（1+淨利成長）÷（1+股數成長）measured only 17/25 within ±0.5pp, and
  //     it fails on 台泥, not on some edge-case micro-cap.
  //
  // So the fix is links, not architecture. Only set this where the connection is one a reader
  // actually needs — a page linking to everything adjacent is a page linking to nothing.
  related?: string[]
  // 組成成分（2026-09-28「現在就把費用組成頁做起來，希望這個組成拆解頁面也可以做成一個模板重用」）。
  // 有這一欄的指標頁會多一段「由哪些項目組成」——一張堆疊柱狀圖加一張表，成分由這裡列出，名稱與單位
  // 從型錄讀，前端不放第二份中文。
  //
  // 加一支新的組成頁＝在這裡多寫一行，不必新增路由、登記表或模板：metric.get.ts 把母項與成分在
  // **同一次** metrics-history 呼叫裡取回（上限 10 支），所以 SSR 就有值、也沒有多一次 HTTP。
  //
  // 前提是那條恆等式在上游真的成立。營業費用實測（2026-09-28 抽 8 檔 TTM，不做 null→0 轉換）：
  // 2330 14.23＝14.23、2317 17.32＝17.32、2454 115.88＝115.88，最大差 0.01（1216／6505），就是各項
  // 四捨五入到小數第二位的進位差。金融業四項全 null——那時整段不渲染，而不是畫一根加不起來的柱子。
  //
  // 營業成本沒有這一欄，而且不是漏掉：型錄只有 operatingCostsPerShare 一支，原始損益表也只有
  // `operating_costs` 一個數字（`cost_of_sales` 是 null），原料／直接人工／製造費用在附註的銷貨成本表，
  // XBRL 損益表這一層沒有。要做得先請 mops 抓附註。
  //
  // **成分與母項必須來自同一支端點**（2026-09-30，bff-ts 的警告）。這個型別只吃 metricCode，所以
  // 全部走 metrics-history、基準一致——要混進 financial-statement 的申報欄位得先改型別，而那會讓
  // 恆等式在任何有股數變動的公司身上失效：metrics-history 的每股值換算到今天的股數基準，財報欄位
  // 是申報原值（實測 3041 2025Q2 是 −0.67 vs −0.70，該公司 2025-05 增資 +19.77%）。
  //
  // 連帶把恆等式閉合的意義講窄一點：它證明這幾個成分與母項**在同一個基準下**加得起來，不證明它們
  // 跟財報上的申報數字一致。兩邊股數基準不同時，本來就不該相等。
  partMetricCodes?: string[]
  // 「跟某個指標一起看」的**策展預設**（2026-09-29「希望模板頁都建立類似機制，可以選擇跟某個指標
  // 一起看，這可能不是個案」）。讀者可以在圖上自己換一支，這裡給的是打開頁面時就已經選好的那一支。
  //
  // 不是個案：同單位同基準的候選數量實測 ROIC（%、TTM）有 33 支，型錄裡 % 有 67 支、元 34 支、倍 31 支。
  // 所以機制本身值得做，逐頁硬綁反而是錯的形狀。
  //
  // 先有的三個：roic→roe（文案本來就叫讀者「跟 ROE 一起看」，而那一頁上沒有 ROE）、
  // equity-growth→bvpsGrowthRate 與 net-income-growth→epsGrowthRate（總額成長率與每股成長率的差
  // 就是股數稀釋，實測 21.5% 的期別差超過 1pp，最大 117.5pp）。
  //
  // 頁面上只陳述算術差（「相差 N 個百分點」），不做解釋——解釋留在 METRIC_COPY 的 compare 裡，那是
  // 策展文字。這條線來自本 repo 既有的規則：只是相關的配對會暗示一個關於公司的主張
  // （見 shared/types/stock-solvency-page.ts，月營收 × 股價是唯一例外）。
  compareMetricCode?: string
  // 拆不出來的時候寫這裡（2026-09-28）。有 `partMetricCodes` 就畫組成，只有這一欄就用一段話回答
  // 「為什麼只有一個數字」——兩者都落在同一個位置、同一個問句形式，因為讀者的問題是同一個。
  //
  // 存在的理由是營業成本：它在多數公司比營業費用大一個量級（6505 是 53.8 倍、2317 是 36 倍），而站上
  // 剛好只拆得出小的那一邊。
  //
  // 措辭是「看不到，而且不是暫時的」。證據分兩層，第二層是 2026-09-28 稍晚才到的，比第一層強：
  //   抽樣層：mops 掃 55 份 115Q2 文件，0/55 標記過那些元素
  //   科目層：官方 TIFRS taxonomy 的 presentation/calculation 裡，**一般業（ci）與保險（ins）根本
  //           沒有「員工福利費用」「折舊攤銷」這兩個科目**——不是發布公司沒標，是欄位不存在
  // 所以「還沒有提供」那種措辭會暗示以後會有，那不是事實；重爬也無效。
  // 銀行（bd）／金控（fh）／證券期貨（basi）有這兩個科目，但母項各不相同（純銀行是「支出及費用合計」
  // 且含利息費用，金控與券商是「營業費用」），所以那 30 家也套不進這個組成模板，見下一段。
  //
  // 2026-09-29 接上了：三支銀行指標上線（analysis-ts），母項**沿用既有的 operatingExpensePerShare**，
  // 沒有新的母項。四支的最終形狀：
  //   operatingExpensePerShare（母項）
  //   bankEmployeeBenefitsExpensePerShare／bankDepreciationAmortisationExpensePerShare／
  //   bankGeneralAdministrativeExpensePerShare
  //
  // **七支成分放在同一個陣列裡，不分業態。** 一般業那四支對銀行是 null、銀行那三支對一般業是 null，
  // 而 compositionRow 只拿**有值的**成分去驗恆等式、全期為 0 的層又會被丟掉——所以兩邊各自閉合、
  // 各自只畫自己那幾層，不需要「這家是不是銀行」這種判斷，也就不需要一份會腐爛的業態名單。
  // 實測恆等式：彰銀 1.21 + 0.15 + 0.52 = 1.88 對上 1.88；2330 仍然是推銷＋管理＋研發三層。
  //
  // 第三支的命名 analysis-ts 採納了建議（對齊元素名 GeneralAndAdministrativeExpense，避開
  // bankOther 開頭）——型錄裡既有的 bankOtherOperatingExpensePerShare 是**差額推算的殘差**，
  // 兩者只差一個詞的話接線只能靠中文名猜，而猜錯時恆等式還是會過、畫出來的那一塊卻是推算值。
  //
  // 銀行與金控**可以**做，我先前寫的「金融業套不上」是錯的（2026-09-28 稍晚由 mops-ts 更正）：
  //
  //   營業費用 = 員工福利費用 + 折舊及攤銷費用 + 其他業務及管理費用
  //   彰銀 7,296,332 + 914,970 + 3,014,029 = 11,225,331，20 家（7 純銀行＋13 金控）全部差額 0
  //
  // 少的是第三項。官方科目表裡這個母項就只有這 3 個子科目，所以是完整拆解不是部分揭露，
  // 110Q3~115Q2 每季都有、缺值是 null 從不是 0。等 analysis-ts 產出每股指標之後，這裡加一行就好。
  //
  // **接的時候有兩個同名陷阱，靠中文名一定會挑錯：**
  //   1. 型錄既有的 `bankOtherOperatingExpensePerShare`「每股其他營業費用」是**差額推算的殘差**
  //      （利息淨收益＋非利息淨收益－呆帳費用－稅前淨利），不是申報科目。填進 partMetricCodes 的話
  //      恆等式大概還是會過（殘差本來就是湊出來的），但第三塊會是推算值而讀者無法分辨。
  //   2. 銀行科目表裡 zh =「其他業務及管理費用」對應**四個元素**，要的是
  //      `ifrs-full:GeneralAndAdministrativeExpense`（母項 OperatingExpense）；
  //      另一個 `tifrs-bsci-basi:OtherOperatingAndAdministrativeExpenses` 是它的**子科目**，
  //      彰銀 115Q2 兩者只差 8%（3,014,029 vs 2,776,454），其餘 9 家子科目是 null。
  //      挑錯的話守衛會正確擋圖，但症狀看起來像「上游資料不全」而不是「接線挑錯欄位」。
  //   3. 純銀行與金控的第三項來自**不同的表、不同的元素**，要 coalesce；只接銀行那張的話
  //      13 家金控會缺第三塊。
  //
  // 券商期貨 10 家母項是「支出及費用合計」（含利息費用、15 個子科目），保險業沒有這些科目——
  // 兩者都不必特別處理，成分加不到母項或全 null，守衛自己會讓整段不渲染。
  //
  // 金控的數字是**全集團合併**（富邦金的員工福利含富邦人壽），跟純銀行並排看員工成本不是同類比較。
  // 那不影響拆解正確性（母項同一個合併口徑），但要寫在頁面上，因為讀者會誤用。
  //
  // 最後一條，mops-ts 自己補的界線：差額 0 只證明**四個元素互相自洽**，不證明申報者的數字對
  // ——6776 就是母項與成分一起壞而恆等式照樣通過。守衛驗的是自洽，不是正確性。
  //
  // 以下是更正前的舊判斷，保留是因為它解釋了為什麼曾經寫「金融業套不上」：
  // 金融業有那兩個科目但仍然不做組成圖：有值的是 30 家（純銀行 7、金控 13、券商期貨 10，保險 0），
  // 而母項有兩種；金控的數字還是全集團合併（富邦金的員工福利含富邦人壽）。更重要的是員福＋折舊攤銷
  // **永遠加不到任何一個母項**（材料、利息費用都不在裡面），所以就算硬填 partMetricCodes，
  // StockMetricCompositionSection 的恆等式守衛本來就會讓整段不渲染——這是那個守衛第二次擋對東西。
  //
  // 一個查了會撞到、但不能接的元素：`tifrs-notes:ShortTermEmployeeBenefits` 看起來像「短期員工福利」，
  // 實際上是**主要管理階層薪酬**（2330 115Q2 50.8 億，跟全體員工福利差兩個數量級）。
  //
  // 之後真的拿到成分，就把這一欄換成 partMetricCodes，位置與問句都不用動。
  compositionNote?: string
}

// 2026-09-26：指標名稱改用中文全稱（EPS→每股盈餘、PER→本益比…），跟 GET /metrics 的 `name` 對齊。
// analysis-ts 同日把型錄裡 31 支的 name 從英文縮寫換成中文，而我們的篩選器與指標歷史表是直接讀即時
// 型錄的——不跟的話同一個東西在站內會有兩個名字：篩選器說「本益比」、側邊欄說「PER」。
//
// 只改 `topic`（h1／麵包屑／選單標籤），`titleKeywords` 不動：它本來就同時寫了縮寫與中文
//（'PER 本益比與歷年區間'），兩種搜尋字都涵蓋得到，改了反而會少掉一邊。
export const METRIC_PAGES: MetricPageDefinition[] = [
  // quarterlyGrowthMetricCode: epsGrowthRate (2026-09-21, direct request「eps 要可以呈現單季與
  // YOY」, citing 財報狗's own「XX 2026年第2季EPS為0.28元，季增-24.32%，近四季EPS為1.51元」sentence
  // shape as the target). That example's own 季增 (QoQ) has no equivalent metricCode in this
  // catalog at all — only epsCagr3/5/8y (multi-YEAR) and epsGrowthRate (單季 vs. 去年同季, i.e.
  // YoY) exist, confirmed live — so this follows the request's own header wording (YOY) rather
  // than the quote's literal QoQ, substituting 年增 for 季增 in the built sentence.
  // `related` here is the entry the whole field was added for: EPS lives in the nav's 獲利能力
  // group and 淨利成長年增率 lives in 成長動能, so a reader finishing this page had no route to「so
  // did the company actually earn more?」. 杜邦分析 is the other half of that question — EPS is
  // profit per share, and 杜邦 shows what drove the profit itself.
  { slug: 'eps', metricCode: 'eps', timeframe: 'TTM', topic: '每股盈餘', titleKeywords: 'EPS 每股盈餘逐季數據', quarterlyGrowthMetricCode: 'epsGrowthRate', related: ['net-income-growth', 'roe', 'dupont'] },
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
  // ── 三個換分母的報酬率（2026-09-26）──
  //
  // 使用者問「metrics 的 ROIC 不見了？」而答案是從來沒開過——沒有文案就開不了頁。三支一起要而不是
  // 只要 ROIC：獲利能力那一組原本只有 ROE 一個報酬率，讀者看不到「換一個分母會看到不同的東西」，
  // 而分開要會讓 analysis-ts 把同一段背景寫三次。
  //
  // croic 刻意不要：複合運算、性質偏徽章，那是「sidebar 更忠於財報」那條線（見 stock-page-nav.ts）。
  //
  // **roic 的覆蓋率與深度都比另外兩支低一截**（抽樣 41 家：roa 41/41、roce 40/41、roic 32/41，期數
  // 中位數 19 vs 13）。analysis-ts 查過是**結構性的不是資料缺口**：ROIC 要先用「所得稅費用 ÷ 稅前
  // 淨利」算有效稅率，稅前虧損那一季就算不出來（2026Q2 單季缺值 815 家中約 424 家屬此），而近四季
  // 要求四季都算得出來，一季虧損整期就 null。這一點已經寫進它的 limitations，所以頁面上的空白讀者
  // 讀得懂。
  { slug: 'roa', metricCode: 'roa', compareMetricCode: 'roe', timeframe: 'TTM', topic: '資產報酬率', titleKeywords: 'ROA 資產報酬率與資產運用效率', related: ['roe', 'dupont', 'roic'] },
  // roce 2026-09-30 整支刪除（analysis-ts 4c69d0ca，型錄 161 → 160）。理由是他們量的：ROCE 與 ROE
  // 的全市場排名相關係數 0.971（2026Q2、1,847 家），幾乎不提供額外資訊。roa 與 roic 留著、文案不變。
  { slug: 'roic', metricCode: 'roic', compareMetricCode: 'roe', timeframe: 'TTM', topic: '投入資本報酬率', titleKeywords: 'ROIC 投入資本報酬率與閒置現金', related: ['roe', 'roa', 'dupont'] },
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
  { slug: 'pe-ratio', metricCode: 'peRatio', timeframe: 'TTM', topic: '本益比', titleKeywords: 'PER 本益比與歷年區間', riverKind: 'pe' },
  // The FIRST Q-only metric page（pbRatio's `fields` is Q alone, not a choice made here）. That
  // made it the first one where `latest` and the page's own 單季 figure are the same period, which
  // StockMetricDetailPage's hasTrailingFigure now guards — see its own comment.
  { slug: 'pb-ratio', metricCode: 'pbRatio', timeframe: 'Q', topic: '股價淨值比', titleKeywords: 'PBR 股價淨值比逐季數據', riverKind: 'pb' },
  { slug: 'bvps', metricCode: 'bvps', timeframe: 'Q', topic: '每股淨值', titleKeywords: '每股淨值逐季變化與帳面價值', related: ['pb-ratio', 'equity-source', 'equity-growth'] },
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
  // 營收成長 and 淨利成長 point at each other because the GAP between them is the thing worth
  // reading: revenue up while profit is flat means margins gave way, and that is a question this
  // pair raises and 財報三率 answers.
  // WHY THIS PAGE STILL EXISTS beside /stock/:code/monthly-revenue（asked twice, 2026-09-23:
  //「功能似乎就不大了」then「還有保留必要嗎」）. Measured rather than argued, because the first
  // answer given here was wrong on both of its reasons:
  //
  //   * revenueGrowthRate.Q is NOT the monthly filing summed into quarters. On a 30-symbol random
  //     sample, 22 had both series: 8 matched to within 0.1pp, 14 did not, and the gaps are not
  //     rounding — 5301 by 26.2pp, 1616 by 8.3pp, 2701 by 6.4pp, 1101 台泥 in every one of 15
  //     quarters up to 5.3pp. It is the CONSOLIDATED statement figure; the monthly filing is the
  //     parent company's. They coincide for 2330, 2412, 2454 and most large 電子 names, which is
  //     exactly why looking at one symbol gave the wrong answer.
  //   * deleting this row would NOT have broken anything downstream. RANK_PAGES and METRIC_PAGES
  //     are independent registries, and the screener reads bff-ts's own /metrics schema — the
  //     earlier claim that /rank/revenue-growth and the screener field depended on this entry was
  //     simply false.
  //
  // So it stays on the strength of the first point alone. `related` leads with 月營收 because that
  // is the same question answered two to four months earlier（上市公司 file by the 10th）, and a
  // reader who meets both numbers should be sent to the other one rather than left wondering which
  // is broken.
  { slug: 'revenue-growth', metricCode: 'revenueGrowthRate', timeframe: 'Q', topic: '單季營收成長年增率', titleKeywords: '單季營收成長年增率與逐季變化', related: ['monthly-revenue', 'net-income-growth', 'margins'] },
  { slug: 'net-income-growth', metricCode: 'netIncomeGrowthRate', compareMetricCode: 'epsGrowthRate', timeframe: 'Q', topic: '淨利成長年增率', titleKeywords: '淨利成長年增率逐季變化', related: ['eps', 'revenue-growth', 'margins'] },
  { slug: 'equity-growth', metricCode: 'equityGrowthRate', compareMetricCode: 'bvpsGrowthRate', timeframe: 'Q', topic: '淨值成長年增率', titleKeywords: '淨值成長年增率逐季變化', related: ['equity-source', 'capex-to-revenue', 'net-income-growth', 'dividend-payout-ratio'] },
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
  { slug: 'fcf-conversion-rate', metricCode: 'fcfConversionRate', timeframe: 'TTM', topic: '自由現金流轉換率', titleKeywords: 'FCF 轉換率現金含金量' },
  { slug: 'ocf-margin', metricCode: 'ocfMargin', timeframe: 'TTM', topic: '營業現金流利潤率', titleKeywords: 'OCF 利潤率營收轉現金比率' },
  // 連續獲利年數 — PULLED 2026-09-22 on a live report（「連續獲利年數 資料怪怪的」）. Reported as a
  // unit question（年 or 季）; measuring it found the numbers themselves don't hold, which is why
  // relabelling it 連續獲利季數 was not the fix. `basis=FY` returns SEVERAL rows per fiscal year,
  // and the count MOVES between them:
  //
  //   2330  2024=5,5,5,6   2025=6,6,6,7     a count of YEARS cannot rise between Q1 and Q4
  //   1101  2025=4,4,4,0                    resets to zero mid-year
  //   2454  2026=1 → 5                      four years of history appear in one period
  //   2891  identical series to 2454's, which two unrelated companies should not have
  //
  // The catalog metadata is right（unit 年, one FY field, and a limitations note about the data
  // floor truncating the count）— it's the series that doesn't behave annually. Reported with these
  // figures; re-add when analysis-ts confirms one row per year and a monotonic count.

  // ── 損益表那一條鏈（2026-09-25）──────────────────────────────────────────────
  // 由下而上做出來的分組。做法不是先想分類名稱再往下填，而是量哪些申報值「相加會閉合」，結果長出
  // 來的就是損益表本身：營收 −營業成本 = 毛利 −營業費用 = 營業利益 ＋業外 = 稅前 −稅 −少數股權 = EPS。
  // 這條鏈全是恆等式不是相關性，也正是 /dividend-source 在投信投顧法下說得出口的同一個理由。
  //
  // 兩個節點自己還能再拆，而且拆法本身是恆等式：
  //   營業費用 = 推銷 ＋ 管理 ＋ 研發 ＋ 預期信用減損
  //   業外損益 = 利息收入 ＋ 其他收入 ＋ 其他利益損失 ＋ 權益法 − 財務成本
  // （業外那條一開始只有 14% 閉合，因為 financeCostPerShare 是以正數申報的費用，該減不該加。）
  //
  // 實測閉合率 2026-09-25：94.8%（母體 1883）與 95.1%（母體 1865）。這兩個數字寫在這裡是附日期與
  // 母體的快照，不是常數——同一天稍早量到 96.3% 與 96.6%，母體是 1801。差別不是資料變壞，是 analysis-ts
  // 修好一個完整度分組的 bug（銀行沒有營業成本，整組失效，把所得稅與營業費用一起拖成 null）之後，
  // 金融股進了母體，而金融業的費用結構不分解成那四項。恆等式穩定，比率跟著母體跑。
  //
  // 閉合 ≠ 可畫，這兩個是不同的問題。預期信用減損有 22.5% 為負（迴轉），權益法 35.4%、其他利益及
  // 損失 24.4% 為負 —— 部分-整體的長條圖畫不出負塊，所以這兩組都沒有被拆進 /dividend-source 的瀑布。
  // metric 頁不受影響：單一數列隨時間變化本來就有正負軸，負值是資料的性質不是渲染的例外。
  //
  // 覆蓋率刻意不寫在這裡。量測當下 analysis-ts 正在修一個完整度分組的 bug（所得稅／營業成本／營業
  // 費用綁同一組，銀行沒有營業成本就把另外兩項一起拖成 null，雙向共 47 + 79 家），回填進行中——我在
  // 幾次查詢之間就看到 2801 的近四季所得稅從 0 期變 1 期。任何寫死在這裡的百分比都會過期，而模板本來
  // 就從 GET /metrics 讀，不需要前端複製一份。
  //
  // 砍掉兩支（2026-09-25，看過實際頁面後）：每股少數股東損益 49.5% 的公司值為 0（1750 家中 867
  // 家——沒有非全資子公司就沒有少數股東），每股預期信用減損損失 30.2% 為 0 且只有 53% 的公司有這個
  // 科目。判準不是覆蓋率（回填中會變）而是「這一頁會對多少公司印出『為 0 元』」：noindex 擋的是「沒有
  // 值」，擋不了「值是 0」，所以那兩頁會是真的進得了索引的薄頁面。實測 1102 亞泥 2026Q2 上游就是 0，
  // 不是四捨五入的假象。
  //
  // 四支上游還沒寫文案（每股毛利／營業利益／稅前淨利／所得稅費用），已請 analysis-ts 補。不擋上線：
  // 模板每段條件渲染，而 description 為空的頁面本來就 noindex（見 StockMetricDetailPage.vue），所以
  // 薄頁面不會被索引，文案到位後自動長出來。eps 當初就是三欄全 null 上線的。
  { slug: 'revenue-per-share', metricCode: 'revenuePerShare', timeframe: 'TTM', topic: '每股營收', titleKeywords: '每股營收逐季數據', related: ['revenue-growth', 'gross-profit', 'psr'] },
  { slug: 'cost-of-goods-sold', metricCode: 'operatingCostsPerShare', timeframe: 'TTM', topic: '每股營業成本', titleKeywords: '每股營業成本與毛利的關係', compositionNote: '看不到，而且不是暫時的。損益表只申報一個營業成本總額，材料、人工、製造費用的明細不在申報用的科目表裡——一般產業與保險業連「員工福利費用」「折舊攤銷」這兩個欄位都沒有，所以不是等誰去補。折舊與攤銷只有全公司一個總數，沒有拆成營業成本與營業費用各多少。想知道成本佔營收多少，看毛利率；想知道這家公司的資產有多重，看每股折舊攤銷——但那是全公司的折舊加攤銷、含非營業的部分，不是營業成本裡的一項。', related: ['revenue-per-share', 'gross-profit', 'gross-margin'] },
  { slug: 'gross-profit', metricCode: 'grossProfitPerShare', timeframe: 'TTM', topic: '每股毛利', titleKeywords: '每股毛利逐季數據', related: ['gross-margin', 'cost-of-goods-sold', 'operating-income'] },
  { slug: 'operating-expense', metricCode: 'operatingExpensePerShare', timeframe: 'TTM', topic: '每股營業費用', titleKeywords: '每股營業費用的四個組成', partMetricCodes: ['sellingExpensePerShare', 'administrativeExpensePerShare', 'researchAndDevelopmentExpensePerShare', 'impairmentLossGainIfrs9PerShare', 'bankEmployeeBenefitsExpensePerShare', 'bankDepreciationAmortisationExpensePerShare', 'bankGeneralAdministrativeExpensePerShare'], related: ['selling-expense', 'administrative-expense', 'rd-expense'] },
  { slug: 'selling-expense', metricCode: 'sellingExpensePerShare', timeframe: 'TTM', topic: '每股推銷費用', titleKeywords: '每股推銷費用逐季數據', related: ['operating-expense', 'administrative-expense'] },
  { slug: 'administrative-expense', metricCode: 'administrativeExpensePerShare', timeframe: 'TTM', topic: '每股管理費用', titleKeywords: '每股管理費用逐季數據', related: ['operating-expense', 'selling-expense'] },
  // rd-intensity（研發費用率）is the RATIO and already exists; this is the per-share amount it is
  // built from, hence a different slug rather than a second page on the same subject.
  { slug: 'rd-expense', metricCode: 'researchAndDevelopmentExpensePerShare', timeframe: 'TTM', topic: '每股研發費用', titleKeywords: '每股研發費用逐季數據', related: ['rd-intensity', 'operating-expense'] },
  { slug: 'operating-income', metricCode: 'operatingIncomePerShare', timeframe: 'TTM', topic: '每股營業利益', titleKeywords: '每股營業利益逐季數據', related: ['operating-margin', 'gross-profit', 'pretax-income'] },
  { slug: 'non-operating-income', metricCode: 'nonOperatingIncomeExpensesPerShare', compareMetricCode: 'operatingIncomePerShare', timeframe: 'TTM', topic: '每股業外損益', titleKeywords: '每股業外損益的五個組成', related: ['non-operating-income-ratio', 'interest-income', 'finance-cost'] },
  // 業外損益占稅前淨利比（2026-09-30，直接問「沒有呈現業外損益佔稅前淨利比？」）。上面那一支是金額
  // 的每股化，這一支才回答「獲利多依賴非本業」——而且是上游自己的文案指過來的（每股業外損益的
  // misreadings 明寫「要看依賴程度請用 nonOperatingIncomeRatio」）。
  //
  // 用稅前淨利當分母而不是營業利益，是量出來的：抽 68 檔最新單季，業外÷營業利益 絕對值中位 11.7%、
  // **最大 2787%**（分母趨近零就爆掉）；業外÷稅前淨利 中位 10.7%、最大 97%——業外是稅前的一個組成，
  // 天然有界。
  //
  // timeframe 'Q'：上游只有單季（業外含處分投資與匯兌這類一次性項目，他們的 limitations 明說要連續
  // 看好幾季才看得出趨勢）。沒有前端自有文案——description／limitations／misreadings 三段上游都齊了
  // （analysis-ts 22c20761），再寫一份只會多一個要跟著漂移的副本。
  { slug: 'non-operating-income-ratio', metricCode: 'nonOperatingIncomeRatio', timeframe: 'Q', topic: '業外損益占稅前淨利比', titleKeywords: '業外損益占稅前淨利比與本業依賴', related: ['non-operating-income', 'operating-income', 'pretax-income'] },
  { slug: 'interest-income', metricCode: 'interestRevenuePerShare', timeframe: 'TTM', topic: '每股利息收入', titleKeywords: '每股利息收入逐季數據', related: ['cash-per-share', 'non-operating-income', 'finance-cost'] },
  { slug: 'finance-cost', metricCode: 'financeCostPerShare', timeframe: 'TTM', topic: '每股財務成本', titleKeywords: '每股財務成本與利息負擔', related: ['non-operating-income', 'interest-coverage', 'interest-bearing-debt-to-equity'] },
  { slug: 'other-income', metricCode: 'otherRevenuePerShare', timeframe: 'TTM', topic: '每股其他收入', titleKeywords: '每股其他收入逐季數據', related: ['non-operating-income', 'other-gains-losses'] },
  { slug: 'other-gains-losses', metricCode: 'otherGainsLossesPerShare', timeframe: 'TTM', topic: '每股其他利益及損失', titleKeywords: '每股其他利益及損失逐季數據', related: ['non-operating-income', 'other-income'] },
  { slug: 'equity-method-income', metricCode: 'shareOfProfitLossOfAssociatesPerShare', timeframe: 'TTM', topic: '每股權益法投資損益', titleKeywords: '每股權益法投資損益逐季數據', related: ['non-operating-income', 'roe'] },
  { slug: 'pretax-income', metricCode: 'pretaxIncomePerShare', timeframe: 'TTM', topic: '每股稅前淨利', titleKeywords: '每股稅前淨利逐季數據', related: ['operating-income', 'income-tax-expense', 'eps'] },
  { slug: 'income-tax-expense', metricCode: 'incomeTaxExpensePerShare', timeframe: 'TTM', topic: '每股所得稅費用', titleKeywords: '每股所得稅費用與所得稅利益', related: ['pretax-income', 'eps'] },

  // ── 營運周轉（2026-09-26）──
  //
  // 使用者問「庫存應該放在哪裡」引出來的一組。歸屬的理由是：`營業成本 = 期初存貨 + 本期進貨 − 期末存貨`
  // ——還堆在倉庫裡的貨根本沒走進損益表，所以存貨是損益表第二刀（營業成本／毛利）上唯一的閥門。應收帳款
  // 同理掛在第一刀（營收認列了、錢收到沒），應付帳款是反向的（拿供應商的錢在周轉）。
  //
  // 六支全部是 TTM（後端沒有 Q，也沒有 FY）。深度實測：2330 有 24 期回到 2020Q3 且無斷點，其餘公司典型
  // 19 期、起點 2021Q4，開頭四季是 `insufficient_history`。**那四期不是同一個原因**（2026-09-26 更正）：
  // 只有第一期是移動平均的暖機，另外三期是近四季窗口壓到 2020Q4——109、110 年第四季全市場的單季損益表
  // 都缺，那幾期在 entries 裡是整期缺席、連格子都沒有。所以那三期會在 mops-ts 補完之後變成有值，不是
  // 結構性的空白。原本這裡寫「移動平均要前期，正確」，那句話只對四分之一。抽樣 50 檔只有 2412
  // 中華電尾端斷掉（上游缺 114Q1、Q2 兩季財報，已請 mops-ts 補）。24 期 < 40 期，所以「近 10 年」視窗
  // 對這一組會一律停用。
  //
  // 這一組最值得說的是它是一條**恆等鏈**，跟損益表那條一樣可以自己驗算（2330 TTM 實測，閉合到分）：
  //     存貨天數 72.56 + 收現天數 26.49 = 營運週期 99.05
  //     營運週期 99.05 − 付現天數 21.03 = 現金轉換循環 78.02
  // 這是它在本站說得出口的原因——不是一堆各自獨立的比率。
  //
  // 文案（description／limitations／misreadings）全部來自 GET /metrics，analysis-ts 2026-09-26 補齊
  // （commit 1b7bcc8e）。前端不留副本。同批他們把 receivablesDays 的 name 從英文縮寫「DSO」改成
  // 「應收帳款收現天數」，本檔的 topic 跟著那個名字。
  //
  // 其餘 10 支（總資產週轉率、固定資產週轉率、應收／存貨／應付週轉率、淨營運資金週轉率、資本支出占營業
  // 現金流比…）目前沒有 description，沒有文案就不開頁——頁面的定義區塊會是空的。
  { slug: 'inventory-days', metricCode: 'inventoryDays', timeframe: 'TTM', topic: '存貨週轉天數', titleKeywords: '存貨週轉天數與庫存去化速度', related: ['cash-cycle', 'cost-of-goods-sold', 'inventory-to-revenue', 'operating-cycle'] },
  { slug: 'inventory-to-revenue', metricCode: 'inventoryToRevenueRatio', timeframe: 'TTM', topic: '存貨占營收比', titleKeywords: '存貨占營收比與庫存水位', related: ['inventory-days', 'cost-of-goods-sold'] },
  { slug: 'receivables-days', metricCode: 'receivablesDays', timeframe: 'TTM', topic: '應收帳款收現天數', titleKeywords: '應收帳款收現天數 DSO 與收款速度', related: ['cash-cycle', 'revenue-per-share', 'operating-cycle', 'accruals-ratio'] },
  { slug: 'payables-days', metricCode: 'payablesDays', timeframe: 'TTM', topic: '應付帳款付現天數', titleKeywords: '應付帳款付現天數 DPO 與付款節奏', related: ['cash-cycle', 'cost-of-goods-sold', 'cash-conversion-cycle'] },
  { slug: 'operating-cycle', metricCode: 'operatingCycle', timeframe: 'TTM', topic: '營運週期', titleKeywords: '營運週期從進貨到收款的天數', related: ['cash-cycle', 'inventory-days', 'receivables-days', 'cash-conversion-cycle'] },
  // 每股現金及約當現金（2026-09-30）。做這一頁的起點是「是什麼東西產生每股利息收入？能否呈現在
  // interest-income 那一頁？」——上游的定義已經答了一半（「主要來自銀行存款與持有的金融資產」），
  // 缺的是可以並排的那條線，analysis-ts 6fba7cc5 補上了這支。
  //
  // **但它沒有被設成 interest-income 的 compareMetricCode**：實測 2330 每股現金 120.86 元、每股利息
  // 收入 1.16 元，差 100 倍——共用一個線性軸的話利息收入會貼在零軸上變成一條直線，等於沒畫。所以
  // 兩頁互為 related，讀者一鍵可達，但不硬塞進同一張圖。
  //
  // timeframe 'Q'：現金是季末那一天的存量，近四季加總沒有意義（跟 bvps 同一種形狀），上游也只給 Q。
  // 沒有前端自有文案，上游三段齊全——misreadings 裡已經寫了「拿每股利息收入除以每股現金估資金
  // 收益率會偏高」的兩個理由，我們不必自己再寫一份。
  { slug: 'cash-per-share', metricCode: 'cashPerShare', timeframe: 'Q', topic: '每股現金及約當現金', titleKeywords: '每股現金及約當現金逐季變化', related: ['interest-income', 'cash-conversion-cycle', 'ocf-to-net-income'] },
  { slug: 'cash-conversion-cycle', metricCode: 'cashConversionCycle', timeframe: 'TTM', topic: '現金轉換循環', titleKeywords: '現金轉換循環與資金被綁住的天數', related: ['cash-cycle', 'operating-cycle', 'payables-days', 'ocf-to-net-income'] },

]

export function findMetricPage(slug: string): MetricPageDefinition | null {
  return METRIC_PAGES.find(page => page.slug === slug) ?? null
}

// Resolves a `related` slug list to what a link needs: the slug and the destination's OWN topic.
// The label is never written at the call site — it comes from whichever registry owns that page, so
// a topic rename can't leave a stale label behind on somebody else's page.
//
// Searches both registries because the split between them is invisible to a reader: /eps is a
// METRIC page and /roe is a BADGE page, and「相關指標」should be able to name either. An unknown
// slug is dropped rather than throwing — a pulled page (it has happened twice this month) must not
// take its neighbours down with it.
//
// The relationship pages are listed here by hand because they are the one page kind with no
// registry entry at all: each has its own route file, since each is a bespoke layout rather than a
// template filled from a row. They matter most as `related` targets precisely because of what they
// are — the question「營收成長了，獲利為什麼沒跟上」is not answered by another single metric, it is
// answered by 財報三率. Keep this in sync by hand; it is five entries and a check would cost more
// than it saves.
const RELATIONSHIP_PAGES: Record<string, string> = {
  margins: '財報三率',
  solvency: '安全韌性的組成',
  dupont: '杜邦分析',
  'monthly-revenue': '月營收',
  'dividend-fill': '填權填息',
  'dividend-source': '配息從哪來',
  'cash-cycle': '現金循環的組成',
  'equity-source': '淨值從哪來'
}

export function resolveRelatedPages(slugs: string[] | undefined): { slug: string; topic: string }[] {
  return (slugs ?? [])
    .map(slug => {
      const relationship = RELATIONSHIP_PAGES[slug]
      if (relationship) return { slug, topic: relationship }
      const page = findMetricPage(slug) ?? findBadgePage(slug)
      return page ? { slug, topic: page.topic } : null
    })
    .filter((entry): entry is { slug: string; topic: string } => entry !== null)
}

// Runnable check for the one invariant that silently breaks pages rather than erroring: a slug
// claimed by both registries would render whichever template the dispatcher happens to test
// first, and the other page would be unreachable with no error anywhere. Called from the
// dispatcher itself in dev.
export function assertMetricPagesDisjoint(): void {
  const collision = METRIC_PAGES.find(page => BADGE_PAGES.some(badge => badge.slug === page.slug))
  if (collision) throw new Error(`[hub-slugs] slug "${collision.slug}" is in both METRIC_PAGES and BADGE_PAGES`)
}
