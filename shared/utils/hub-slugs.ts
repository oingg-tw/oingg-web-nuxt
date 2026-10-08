// URL vocabulary of the hub pages (2026-09-19, the SEO build) — the ONE place the app pages, the
// Nitro data layer and the sitemap handler all read, so a slug can't drift between the three
// (same reason f-score-pilot.ts lives here). Rules (from the vault's URL guidance, adopted):
// lowercase hyphenated English slugs, no query state, depth ≤ 3.
// 個股 × 徽章／指標專頁的登記表（BADGE_PAGES／METRIC_PAGES）在 metric-pages.ts（2026-10-08 拆出）。

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

// 13 與 19 在 SECTORS 裡是為了讓代號對照完整，但產業頁打不開（19 綜合、13 電子工業（舊分類））。守衛放在 sectorPath()
// 而不是 10 個呼叫端（首頁、/screener、/industries、/stock、產業頁的其他類股、個股麵包屑、sitemap）：實測症狀是 /screener 的
// 膠囊「電子工業（舊分類）（33）」點進去 404，check-click-depth 抓到的。上游 2026-10-02 已把型錄縮成 34 個類股、與目錄合計
// 相等（2,339 = 2,339），這個集合目前擋不到東西，但 SECTORS 仍帶 13／19，守衛留著。靜態清單不打 /api/hub/directory：類股增減
// 是交易所幾年一次的事，漏了 check-hub-pages 會在那一頁抓到 404。
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
  // 年增率排行的基期門檻（2026-10-01，使用者選加門檻而不是撤頁）：/rank/revenue-growth 前 50 名全部 ≥100%、榜首 24852%，
  // 基期每股營收 0.0016 元——排的是「去年幾乎沒營收」不是成長。靠 `基期 = 現值 ÷ (1 + g/100)` 反推，而上游分母是 |基期|，
  // 所以反推有兩個符號自洽的解（6116 由虧轉盈與 2303 真成長各落在不同分支）：對營收安全（基期為負只有退貨／會計調整，
  // 實測前 50 列全為正），對 EPS 不安全——EPS 那兩頁改走 screener。minBase 用誤差預算推：revenuePerShare 只報到小數兩位，
  // 四捨五入誤差 ±0.005，相對誤差要壓到 1% 基期必須 ≥ 0.5。實測 50 列留 29 列，榜首 7740 1938%（基期 3.86 元，真的二十倍）。
  growthBaseFloor?: { valueField: string; minBase: number }
  // 改走 POST /screener 而不是 GET /screener/ranking（2026-10-01）：ranking 沒有 filter，而 EPS 那兩頁要先把族群篩出來
  //（上游年增率的分母是 |去年同季|，真成長／由虧轉盈／虧損縮小三種的年增率都是正的）。derivedMinus 給「排序值是兩欄相減」
  // 的頁（由虧轉盈幅度＝本季 − 去年同季）：上游沒做 epsChange 欄位，所以要把符合的頁數全抓回來自己排。
  screener?: {
    filters: { field: string; min?: number; max?: number }[]
    columns: string[]
    // 伺服器端排序。欄位必須同時出現在 `columns` 裡，否則上游回 400（它的錯誤訊息講得很清楚）。
    sortField?: string
    // 排序值 = 第一欄 − 第二欄。給了這個就不用 sortField，而且會把所有頁都抓回來。
    derivedMinus?: [string, string]
    // 畫面上的指標名與單位。derivedMinus 的頁面在型錄裡沒有對應的指標，所以名字要自己給。
    metricName?: string
    unit?: string
    // 母體說明。**screener 頁面一定要給**：這一頁的答句原本寫「全市場有 X 資料的公司依數值排序」，
    // 而那句話對篩過族群的頁面是錯的——由虧轉盈那頁只收「去年同季虧損、本季獲利」的公司，
    // 讀者不知道的話會把它讀成全市場的每股盈餘排行。
    population: string
  }
}

export const RANK_PAGES: RankPageDefinition[] = [
  { slug: 'dividend-yield', field: 'dividendYield.EOD', direction: 'desc', label: '殖利率', metricCode: 'dividendYield' },
  { slug: 'pe-ratio-low', field: 'exchangePeRatio.EOD', direction: 'asc', label: '本益比', metricCode: 'exchangePeRatio' },
  { slug: 'pb-ratio-low', field: 'exchangePbRatio.EOD', direction: 'asc', label: '股價淨值比', metricCode: 'exchangePbRatio' },
  { slug: 'roe', field: 'roe.TTM', direction: 'desc', label: 'ROE', metricCode: 'roe' },
  // /rank/eps 撤掉（2026-10-01 使用者：「eps 由高到低前 50 檔沒有意義，EPS 成長排行才有意義」）：EPS 高低幾乎只反映股本大小與
  // 面額。換成成長率之後成了下面的 eps-growth／eps-turnaround 兩頁。
  // /rank/consecutive-dividend-years 撤掉（2026-09-22）：欄位目前排不出東西——>=5 有 890 家、>=6 只有 1 家，889 家並列 5（2330 是 7），
  // 前 50 會是台積電加 49 個代號最小的公司。原因是結構性的（analysis-ts）：指標讀現金流量表判斷有沒有配息，mops 的 XBRL 從
  // 109Q3 才有，所以「5」是「至少 5」。FY115 結算（約 2027 Q1）後上限變 6 才會開始拆開——還原前先重量分布，前 50 跨過一個以上
  // 的值才放回來；指標本身在個股頁與篩選器照常。
  { slug: 'market-cap', field: 'liveMarketCap.EOD', direction: 'desc', label: '市值', metricCode: 'liveMarketCap' },
  { slug: 'revenue-growth', field: 'revenueGrowthRate.Q', direction: 'desc', label: '單季營收成長年增率', metricCode: 'revenueGrowthRate', growthBaseFloor: { valueField: 'revenuePerShare.Q', minBase: 0.5 } },
  // EPS 的兩頁（2026-10-01）。使用者：「eps 可以分成兩個版本阿 一個說明成長 一個說明由虧轉盈的
  // 幅度就好了」——而那個拆法解掉的正是 /rank/eps 被撤掉之後剩下的那個數學問題。
  //
  // 上游的年增率分母是 **|去年同季|**（型錄的 formulaLatex），所以單一個 epsGrowthRate 排行混著
  // 三個族群，而且後兩個的年增率都是**正的**：
  //     去年>0、今年>0  真成長
  //     去年<0、今年>0  由虧轉盈      ← 年增率正且很大
  //     去年<0、今年<0  虧損縮小      ← 年增率也是正的，公司還在虧錢
  // 上游自己的 limitations 就寫著「去年同季虧損、本季轉盈時數字為正但意義跟『獲利成長』不同」。
  //
  // 先前做不出來是因為基期的**符號不可還原**（|分母| 讓兩個反推分支都符號自洽，見 growthBaseFloor
  // 的註解）。analysis-ts 2026-10-01 補了 `epsPriorYear.Q`——就是那個分母但不取絕對值——族群才分得開。
  { slug: 'eps-growth', field: 'epsGrowthRate.Q', direction: 'desc', label: '單季每股盈餘成長年增率', metricCode: 'epsGrowthRate', screener: {
    // 去年同季 ≥ 0.5 元：門檻用誤差預算推的，不是挑觀測值。EPS 只報到分（小數兩位），所以基期的
    // 四捨五入誤差是 ±0.005，而年增率對基期的相對誤差就是 0.005/基期；要壓到 1% 以內，基期要 ≥ 0.5。
    // 這一道同時把「由虧轉盈」與「虧損縮小」擋在外面（基期必須是正的），所以這一頁只有真成長。
    //
    // `eps.Q` 的 min 是**排除 null**，不是篩數值。下限取 −10000 元，遠低於任何真實的每股虧損，
    // 所以它只排除 null 不排除虧損公司（基期 ≥ 0.5 而本季轉虧的公司年增率是負的，本來就排不到
    // 前面，但它們該留在母體裡）。
    //
    // 加這一道的原因是上游的 `sortField` 原本把 **null 排在最前面**——由大到小時等於把「沒有資料」
    // 當成最大值，實測 3036 文曄、6911 群運（本季沒申報、年增率 null）以「0%」佔住榜首前兩名。
    // 回報後上游同日就改成 nulls last（commit 46f17fd1），我也驗過了：拿掉這道 filter 前三名仍然是
    // 宜鼎／吉祥全／群聯。
    //
    // **即使如此這一道仍然留著**，而且不是因為不信那個修正：(1) 它現在的語意「排除 null」本身就是
    // 這一頁真正要表達的意圖，寫出來比靠排序的副作用更清楚；(2) 那個修正在上游的 DEV，正式環境
    // 還沒上，而我們不該讓一個已經做對的頁面依賴一個尚未全環境生效的行為。
    filters: [{ field: 'epsPriorYear.Q', min: 0.5 }, { field: 'eps.Q', min: -10000 }],
    columns: ['epsGrowthRate.Q', 'eps.Q', 'epsPriorYear.Q'],
    sortField: 'epsGrowthRate.Q',
    population: '只收去年同季每股盈餘達 0.5 元以上的公司：基期接近零時，年增率會被放大成不具意義的數字；去年同季虧損的公司也不在這裡，它們的「成長」另有一頁。'
  } },
  // 由虧轉盈：去年同季虧損、本季獲利。**排的是幅度（元）不是年增率**——年增率在這個族群裡是
  // (今年 + |去年|) / |去年|，基期越接近零就越大，排出來會是「去年剛好差不多打平」而不是「轉得最多」。
  // 幅度是相減不是相除，所以沒有除以近零的問題。
  //
  // 上游沒有做 epsChange 欄位（他們的判斷：符合的公司只有幾百家，前端相減就好），所以這一頁靠
  // derivedMinus，而那表示要把符合的頁數全抓回來再排序。實測 442 家、9 頁、每頁約 0.9 秒。
  { slug: 'eps-turnaround', field: 'eps.Q', direction: 'desc', label: '單季每股盈餘由虧轉盈幅度', metricCode: 'eps', screener: {
    // −0.0001／0.0001 而不是 0：上游的 filter 是閉區間，用 0 會把剛好 0.00 的公司兩邊都算進去。
    filters: [{ field: 'epsPriorYear.Q', max: -0.0001 }, { field: 'eps.Q', min: 0.0001 }],
    columns: ['eps.Q', 'epsPriorYear.Q'],
    derivedMinus: ['eps.Q', 'epsPriorYear.Q'],
    metricName: '每股盈餘由虧轉盈幅度',
    unit: '元',
    population: '只收去年同季虧損、本季獲利的公司，排的是兩者相差幾元。這不是獲利高低的排行：轉盈幅度大不代表現在賺得多。'
  } }
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
  // 鍵是範本的名稱，上游改名會靜默少一個連結（股利穩健→股利連續性 2026-09-20、財務韌性→安全韌性 2026-09-21 都是
  // check-hub-pages 抓到 /screener 少一個範本連結才發現的）；slug 刻意不跟著改——那是已上線、在 sitemap 裡的網址，頁面主題沒變。
  股利連續性: 'dividend-stability',
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

// 可索引的 /metrics/{code} 頁：從 Piotroski F-Score 一頁（2026-09-19「先來 f score 徽章作為示範就足夠」）長到三頁（09-20），每一頁
// 都驗過三段文案齊全、meta description 經 clampDescription(text, 90) 後仍過 60 個 CJK 字的下限。liveGrahamNumber 文案齊但不在：
// 原始描述混了太多 ASCII，90 字元的裁切只剩 56 個 CJK 等效字——那是共用模板的缺口，不在這裡繞過。其餘指標同一個模板、
// noindex follow、不進 sitemap。跟 BADGE_PAGES 的 slug 是不同詞彙表，'roe'／'gross-margin' 同字是巧合不是互通。
export const METRIC_PAGE_SLUGS: string[] = ['piotroski-f-score', 'roe', 'gross-margin']

export function isIndexableMetricSlug(slug: string): boolean {
  return METRIC_PAGE_SLUGS.includes(slug)
}
