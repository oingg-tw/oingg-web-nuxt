// 8-category taxonomy per direct request ("徽章分成八類 股東回饋 獲利品質 獲利能力 成長動能
// 財務韌性 市場評價 營運周轉 大戶籌碼") — shares 5 names with useStockCards.ts's own
// STOCK_CARD_CATEGORIES (股東回饋/獲利品質/獲利能力/成長動能/財務韌性/市場評價) but is its own
// independent list, not a shared const: this one adds 營運周轉/大戶籌碼 instead of 公司資訊, and
// nothing requires the two lists to move in lockstep — a future edit to one doesn't have to
// touch the other.
export type GuruBadgeCategory = '股東回饋' | '獲利品質' | '獲利能力' | '成長動能' | '財務韌性' | '市場評價' | '營運周轉' | '大戶籌碼'

// Fixed display order for the 8 categories — used by both guru-indicators.vue (implicitly, via
// GURU_BADGES' own array order) and StockGuruBadgeCard.vue (explicitly, since that card shows
// exactly one slot per category regardless of how many real badges a category has).
export const GURU_BADGE_CATEGORIES: GuruBadgeCategory[] = ['股東回饋', '獲利品質', '獲利能力', '成長動能', '財務韌性', '市場評價', '營運周轉', '大戶籌碼']

// One consistent color per category so badges group visually at a glance without needing to
// read every label — same "same category, same color" convention already established for
// preferred-stocks.vue's own column-preset categories. Moved here from GuruBadgeCard.vue
// 2026-09-09 so StockGuruBadgeCard.vue (the stock-detail page's own 8-dimension badge card) can
// share the exact same palette instead of duplicating it. All 8 fixed hex values, not
// accent-linked — with 8 categories there's no natural "one of these IS the theme accent"
// candidate, and fixing all 8 avoids a repeat of an earlier warning-vs-primary near-collision
// under this site's default GOLD theme. Every value contrast-checked directly (relative-
// luminance formula, not eyeballed) against white badge-icon/tag text — all clear the WCAG
// 1.4.11 3:1 non-text floor AND the stricter 4.5:1 AA normal-text floor (4.83–7.13:1), since
// 獲利品質's first pick (#16a34a, 3.30:1) failed AA against white before being darkened to
// #15803d.
export const GURU_CATEGORY_COLOR: Record<GuruBadgeCategory, string> = {
  股東回饋: '#0e7490',
  獲利品質: '#15803d',
  獲利能力: '#2563eb',
  成長動能: '#c2410c',
  財務韌性: '#dc2626',
  市場評價: '#7c3aed',
  營運周轉: '#92400e',
  大戶籌碼: '#be185d'
}

// One fixed disclaimer line, shown once by whichever component displays badge detail (currently
// GuruBadgeCard.vue's dialog and StockGuruBadgeCard.vue's dialog) — per direct request ("與其
// 文案在那邊寫非投資建議，不如把這個彈窗共用元件下面放固定文案就好"), moved here 2026-09-09 so
// both components share the exact same string instead of each hardcoding their own copy.
export const GURU_BADGE_DISCLAIMER = '以上為公開學術方法論的框架介紹，不代表本站對任何個股之評等或投資建議。'

// A single, real published comparison from the methodology's own literature (or, for probability
// -output models, the textbook-standard 0.5 classifier boundary) — per direct request
// ("徽章總覽我要改成計算達標徽章的數量。每個都會像現在的F-score那樣有分子分母"). Wording is
// deliberately neutral/factual ("符合...項標準中的...項", "> 2.99"), never "達標/未達標" — per
// direct correction ("改用中性事實描述") this must not read as a pass/fail verdict, matching the
// same "raw values only, no interpretive verdict" discipline StockHealthCheckCard.vue already
// established for this exact family of scores (Altman's own published safe/grey/distress zones
// are deliberately NOT surfaced there for this reason). The numerator/denominator framing here
// is the one exception to that discipline the user explicitly asked for — it's still reporting
// which of N objective, literature-defined conditions a real number satisfies, not a synthesized
// opinion, but every UI surface using this must keep the wording factual, not evaluative.
export interface GuruBadgeThreshold {
  description: string
  // Extra field IDs (beyond the badge's own fieldId) this comparison needs — e.g. Graham Number/
  // NCAV compare against the stock's own price, not just their own field.
  extraFieldIds?: string[]
  // How many "points" this badge is out of. Piotroski F-Score is a genuine 0-9 checklist
  // (denominator 9, see its own threshold below); every other badge here is a single real
  // published comparison (denominator 1).
  denominator: number
  // Given the badge's own numeric value and any extra field values (both keyed by fieldId),
  // returns how many of `denominator` are met. Returns null when there isn't enough real data to
  // evaluate — never guessed or defaulted to 0/the max.
  numerator: (value: number, extra: Record<string, number | null>) => number | null
  // Whether this badge counts as "met" for StockGuruBadgeCard.vue's card-level headline count
  // (how many of the displayed BADGES meet their own standard, not how many raw points were
  // earned). Defaults to numerator === denominator when omitted — the natural "met" reading for
  // every denominator-1 badge here. Piotroski F-Score overrides this: requiring a perfect 9/9
  // would misrepresent a genuinely strong score as "not met" — Piotroski's own 2000 paper
  // specifically treats scores of 8–9 as its own top-quality bucket (the one his highest-return
  // decile results are drawn from), so that's the real, literature-sourced bar used here instead
  // of an arbitrary one.
  isMet?: (numerator: number, denominator: number) => boolean
}

export interface GuruBadge {
  id: string
  name: string
  nameEn: string
  author: string
  category: GuruBadgeCategory
  // The real GET /filters field this methodology corresponds to on this site (metricCode.basis
  // format — see project_screener_backend_outage memory for why this format, not the old
  // metricKey.fieldKey scheme). Wired to a live per-symbol lookup 2026-09-09 by
  // StockGuruBadgeCard.vue (see useGuruBadgeScores.ts) — reuses this same field mapping rather
  // than re-deriving it.
  fieldId: string
  summary: string
  detail: string
  threshold: GuruBadgeThreshold
}

// Static reference content for guru-indicators.vue's badge gallery — NOT fetched from
// GET /filters, since every field's description/source/unit there is currently null
// (analysis-ts's own text hasn't been backfilled yet, confirmed live 2026-09-08 — see
// project_screener_backend_outage memory). Written here instead, but only for methodologies
// that are real, publicly documented academic/practitioner frameworks with a real matching
// field on this site (fieldId above, re-verified live against GET /filters before writing this
// file) — never a fabricated metric. Every summary/detail describes what the methodology
// MEASURES and how it's composed, never what a specific stock's score means or implies about
// whether to buy/hold/sell it — this page is a reference gallery, not a stock evaluator (see
// guru-indicators.vue's own comment for the compliance reasoning this follows, same pattern as
// the 個股健檢 card's "raw values only, no interpretive verdict" convention).
export const GURU_BADGES: GuruBadge[] = [
  {
    id: 'piotroski-f-score',
    name: 'Piotroski F-Score',
    nameEn: 'Piotroski F-Score',
    author: 'Joseph Piotroski, 2000',
    category: '獲利品質',
    fieldId: 'piotroskiFScore.Q',
    summary: '9 項財務體質檢查項目的計分表，用來篩出體質正在改善的公司。',
    detail:
      '史丹佛會計學教授 Joseph Piotroski 在 2000 年發表的論文中提出，針對淨值市價比偏低（傳統定義的價值股）的公司，設計 9 個財務體質檢查項目，每項符合得 1 分、不符合得 0 分，總分 0～9。9 個項目分成三組：獲利能力（如稅後淨利是否為正、營運現金流是否為正）、財務槓桿與流動性（如負債比是否下降、流動比率是否上升）、營運效率（如毛利率與資產週轉率是否提升）。分數本身只反映「這家公司近期在這 9 個會計面向上，體質是變好還是變差」。',
    threshold: {
      description: '9 項會計檢查項目中，符合的項目數（Piotroski 原始論文計分法）',
      denominator: 9,
      numerator: value => Math.max(0, Math.min(9, Math.round(value))),
      // Piotroski's own paper treats scores of 8-9 as its own top-quality bucket — see this
      // file's own GuruBadgeThreshold.isMet comment for why a perfect 9/9 isn't used instead.
      isMet: numerator => numerator >= 8
    }
  },
  {
    id: 'altman-z-score',
    name: 'Altman Z-Score',
    nameEn: 'Altman Z-Score',
    author: 'Edward Altman, 1968',
    category: '財務韌性',
    fieldId: 'altmanZScore.TTM',
    summary: '結合 5 個財務比率的加權模型，最初用來預測企業破產風險。',
    detail:
      '紐約大學金融學教授 Edward Altman 於 1968 年發表，是財務危機預測領域最早、也最廣為引用的模型之一。將營運資金／總資產、保留盈餘／總資產、稅前息前淨利／總資產、股票市值／負債帳面值、營收／總資產這 5 個財務比率各自加權後加總，得出一個綜合分數，分數越低代表模型認定的財務危機風險越高。這是一個統計模型，反映的是歷史樣本歸納出的風險關聯性。',
    threshold: {
      description: '> 2.99（Altman 原始論文劃定的安全區下限）',
      denominator: 1,
      numerator: value => (value > 2.99 ? 1 : 0)
    }
  },
  {
    id: 'beneish-m-score',
    name: 'Beneish M-Score',
    nameEn: 'Beneish M-Score',
    author: 'Messod Beneish, 1999',
    category: '獲利品質',
    fieldId: 'beneishMScore.Q',
    summary: '結合 8 個會計比率的模型，用來偵測財報是否存在盈餘操縱的跡象。',
    detail:
      '印第安納大學會計學教授 Messod Beneish 於 1999 年發表，設計初衷是偵測財報上常見的盈餘操縱手法（例如提前認列營收、虛增應收帳款）。模型結合應收帳款成長率、毛利率變化、資產品質變化、營收成長率、折舊政策變化、銷管費用變化、財務槓桿變化、應計項目等 8 個會計比率，加權計算出一個綜合分數。分數本身是統計模型對「財報數字是否出現操縱跡象常見的異常模式」的量化呈現，不等於已認定財報造假。',
    threshold: {
      description: '< -1.78（Beneish 原始論文劃定的疑似操縱門檻）',
      denominator: 1,
      numerator: value => (value < -1.78 ? 1 : 0)
    }
  },
  {
    id: 'ohlson-o-score',
    name: 'Ohlson O-Score',
    nameEn: 'Ohlson O-Score',
    author: 'James Ohlson, 1980',
    category: '財務韌性',
    fieldId: 'ohlsonOScore.TTM',
    summary: '用邏輯迴歸模型估計企業陷入財務困境的機率。',
    detail:
      '紐約大學會計學教授 James Ohlson 於 1980 年發表，是財務危機預測領域除了 Altman Z-Score 外另一個常被引用的模型。與 Z-Score 用加權加總的做法不同，O-Score 用邏輯迴歸（logistic regression）方式，將公司規模、負債比、營運資金比率、流動比率、獲利能力、現金流量等 9 項財務因子代入模型，直接估計出一個「陷入財務困境」的機率值。同樣是根據歷史樣本建立的統計模型，反映的是統計上的關聯性。',
    threshold: {
      description: '< 0.5（機率模型的標準判別界線）',
      denominator: 1,
      numerator: value => (value < 0.5 ? 1 : 0)
    }
  },
  {
    id: 'zmijewski-score',
    name: 'Zmijewski Score',
    nameEn: 'Zmijewski Score',
    author: 'Mark Zmijewski, 1984',
    category: '財務韌性',
    fieldId: 'zmijewskiScore.TTM',
    summary: '用機率模型評估財務困境可能性，聚焦資產報酬率、槓桿與流動性三個面向。',
    detail:
      '芝加哥大學會計學教授 Mark Zmijewski 於 1984 年發表，同樣是財務危機預測模型，採用機率單位迴歸（probit model），聚焦在資產報酬率（ROA）、財務槓桿（負債／總資產）、流動性（流動資產／流動負債）這 3 個核心比率上，計算出企業財務困境的機率。模型設計上刻意只用少數幾個核心比率，是為了在樣本外的預測穩定度上做取捨。跟其他財務危機模型一樣，反映的是統計關聯性。',
    threshold: {
      description: '< 0.5（機率模型的標準判別界線）',
      denominator: 1,
      numerator: value => (value < 0.5 ? 1 : 0)
    }
  },
  {
    id: 'graham-number',
    name: 'Graham Number',
    nameEn: 'Graham Number',
    author: 'Benjamin Graham',
    category: '市場評價',
    fieldId: 'grahamNumber.TTM',
    summary: '用每股盈餘與每股淨值估算的一個保守估值上限參考值。',
    detail:
      '價值投資之父 Benjamin Graham 在其著作中提出的簡化估值公式，計算方式為「每股盈餘 × 每股淨值 × 22.5」開根號。22.5 這個常數來自 Graham 自己設定的兩個上限：本益比不超過 15 倍、股價淨值比不超過 1.5 倍（15 × 1.5 = 22.5）。這個數字原始用途是作為一個保守的估值參考上限，幫助篩選相對於獲利與帳面資產而言股價偏低的公司，是 Graham 個人投資哲學下的簡化公式。',
    threshold: {
      description: '股價 < Graham Number（Graham 本人的比較慣例）',
      extraFieldIds: ['stockPrice.Q'],
      denominator: 1,
      numerator: (value, extra) => {
        const price = extra['stockPrice.Q']
        return price === null || price === undefined ? null : price < value ? 1 : 0
      }
    }
  },
  {
    id: 'ncav',
    name: 'NCAV（淨流動資產價值）',
    nameEn: 'Net Current Asset Value',
    author: 'Benjamin Graham',
    category: '市場評價',
    fieldId: 'ncav.Q',
    summary: '用「流動資產減總負債」估算的清算價值角度估值方法，又稱 Net-Net。',
    detail:
      'Benjamin Graham 提出的另一個保守估值角度，計算方式為流動資產減去全部負債（不含流動資產以外的其他資產，如廠房設備），概念上接近「假設公司立刻清算，扣掉全部負債後，流動資產部分大約還剩多少」。當股價低於每股 NCAV 時，傳統上被視為股價相對於這個保守清算價值角度而言偏低，因此又被稱為 Net-Net 選股法。這是一個特定角度的估值參考方法，不考慮公司未來獲利能力或成長性。',
    threshold: {
      description: '股價 < NCAV × 2/3（Graham 本人著作中的安全邊際慣例）',
      extraFieldIds: ['stockPrice.Q'],
      denominator: 1,
      numerator: (value, extra) => {
        const price = extra['stockPrice.Q']
        return price === null || price === undefined ? null : price < value * (2 / 3) ? 1 : 0
      }
    }
  },
  // Added 2026-09-09 per direct request — real, live-verified via curl before writing, and
  // genuinely different in kind from every other badge here: not an academic paper or a
  // practitioner rule of thumb, but S&P Dow Jones Indices' own official published eligibility
  // screen for S&P 500 inclusion (S&P U.S. Indices Methodology, confirmed via live web search) —
  // an absolute (not relative-ranking) profitability-stability gate index committees themselves
  // use to exclude companies with unstable/negative earnings, not a "quality score." Placed in
  // 獲利能力 per direct confirmation.
  {
    id: 'sp500-earnings-eligibility',
    name: 'S&P 500 獲利資格門檻',
    nameEn: 'S&P 500 Earnings Eligibility Screen',
    author: 'S&P Dow Jones Indices（S&P U.S. Indices Methodology）',
    category: '獲利能力',
    fieldId: 'eps.TTM',
    threshold: {
      description: '近四季 EPS 合計為正，且最近一季 EPS 也為正（S&P 500 官方納入門檻）',
      extraFieldIds: ['eps.Q'],
      denominator: 1,
      numerator: (value, extra) => {
        const latestQuarter = extra['eps.Q']
        return latestQuarter === null || latestQuarter === undefined ? null : value > 0 && latestQuarter > 0 ? 1 : 0
      }
    },
    summary: '近四季獲利合計為正、且最近一季也為正，S&P 500 官方採用的獲利穩定性資格審查。',
    detail:
      'S&P Dow Jones Indices 在其公開發布的《S&P U.S. Indices Methodology》裡，明訂公司要被納入 S&P 500 指數，除了市值、流動性、公眾流通量等條件外，還必須同時符合兩個獲利門檻：最近一季 GAAP 稅後淨利為正，且最近連續四季 GAAP 稅後淨利加總也為正。這不是用來衡量「獲利能力多強」的評分方法論，而是指數編製機構自己用來篩掉獲利不穩定、可能虧損公司的資格審查——用意是排除帳面上靠一次性收益撐場面、但本業實際上正在虧損或獲利極不穩定的公司。'
  },
  // Nissim-Penman RNOA badge removed 2026-09-09 per direct correction ("Nissim-Penman RNOA ...
  // 比較標準：> 0% 站得住腳嗎"). Verified via live web search: the paper's OWN real comparison
  // concept is SPREAD = RNOA − NBC (net borrowing cost) — leverage only creates shareholder
  // value when RNOA beats the actual cost of debt financing — not a flat "> 0%" floor, which was
  // my own invented conservative minimum, never something the 2001 paper itself proposed. This
  // site's GET /filters schema has no net-borrowing-cost/cost-of-debt field to compute the real
  // SPREAD, so there was no honest way to build this badge to the paper's own actual standard —
  // removed rather than keep a threshold not really sourced from it.
  // DuPont Analysis badge removed 2026-09-09 per direct correction ("DuPont 分析 不是徽章系統
  // 的 請移除") — it's a decomposition/diagnostic framework, not a scoring standard, and this
  // site already has a full dedicated DuPont chart family on the stock-detail page itself
  // (StockDupontChart.vue/StockDupontExtendedChart.vue/StockDupontFactorLevelChart.vue/
  // StockDupontFiveStageMetricCards.vue) — redundant to also carry it here as a 徽章.
  // Two badges added 2026-09-09 per direct follow-up ("徽章列表請繼續") to fill 2 of the
  // originally-empty categories (成長動能/營運周轉) — both re-verified live via curl against
  // GET /filters (real fields exist) and POST /screener/values (real 2330 data returned) before
  // being written, same discipline as the original 9.
  //
  // Sustainable Growth Rate (SGR, Higgins 1977) was one of the two — REMOVED same day per direct
  // correction ("永續成長率（SGR）...比較標準：> 0%（永續成長率為正）這個呢"). Verified via live
  // web search: Higgins' own framework's real comparison is ACTUAL growth rate vs. the calculated
  // SGR (exceeding it signals the company can't sustain that pace without new equity/rising
  // leverage) — not a flat "SGR > 0%" floor, which was my own invented simplification, same
  // mistake as the Nissim-Penman RNOA badge removed the same day (see its own comment). This
  // site's schema has no "actual revenue/earnings growth rate" field to compare SGR against, so
  // there was no honest way to build this to Higgins' own actual standard — removed rather than
  // keep a threshold not really sourced from the paper. 成長動能 is empty again as a result — no
  // real named methodology with a matching, correctly-thresholded field currently fills it.
  //
  // 股東回饋/大戶籌碼 still had no badge as of the original 2-badge addition above: no real
  // named academic/practitioner framework was found with a matching schema field for either at
  // that time (dividend category only had raw payout-ratio/yield ratios, no composite
  // shareholder-return model; there is no institutional/large-holder ownership field in
  // GET /filters at all — see StockForeignShareholdingChart.vue's own separate, non-screener
  // endpoint for the closest thing this site has to 大戶籌碼 data). 股東回饋 was filled later the
  // same day (see the Fidelity payout-ratio badge further below); 大戶籌碼 remains empty.
  //
  // Cash Conversion Cycle badge REMOVED 2026-09-09 per direct request ("這個標準找不到出處的話
  // 幫我拿掉") after a direct question about its threshold ("比較標準：< 0 天...這個呢"). Verified
  // via live web search: Richards & Laughlin's own 1980 paper introduced the CCC metric itself
  // but never proposed "< 0 days" as a threshold. "Negative CCC = elite" only became a
  // recognized framing later, through Dell/Amazon business case studies — but every source found
  // for that framing was secondary commentary (finance-education blogs, a Motley Fool article),
  // not a single identifiable authoritative document the way Fidelity's own paper (payout ratio
  // badge) or S&P Dow Jones' own methodology document (earnings eligibility badge) are. Dell's
  // own SEC filings are a real primary source, but only for Dell's own numbers — not for the
  // claim that negative CCC itself is an industry-recognized top-tier standard. Without one
  // citable authority for that specific claim, this doesn't meet the bar every other badge here
  // is held to — removed rather than keep a threshold whose only backing is informal commentary.
  // 營運周轉 is empty again as a result — no other real badge currently fills it.
  // Added 2026-09-09 per direct request ("品質徽章加上 理察·斯隆（Richard Sloan）的應計項目模型
  // （Sloan Accrual Ratio）"). 獲利品質 already had 2 badges (Piotroski/Beneish) at the time —
  // this is a 3rd, additive one, not a replacement (a since-removed DuPont Analysis badge was
  // also here briefly, removed same day — see this file's own comment above). StockGuruBadgeCard.
  // vue's own 獲利品質 tile combines every real badge in the category (see
  // guruBadgesByCategory()'s own comment), and this one is also browsable on its own on the full
  // /guru-indicators gallery.
  {
    id: 'sloan-accrual-ratio',
    name: '斯隆應計項目比率（Sloan Accrual Ratio）',
    nameEn: 'Sloan Accrual Ratio',
    author: 'Richard Sloan, 1996',
    category: '獲利品質',
    fieldId: 'accrualsRatio.TTM',
    summary: '衡量盈餘中「應計項目」佔比，比重越高代表盈餘品質可能越低。',
    detail:
      '加州大學柏克萊分校會計學教授 Richard Sloan 於 1996 年發表的經典論文，指出企業盈餘可拆成「現金流量」與「應計項目」兩部分——應計項目（例如尚未收現的應收帳款增加、存貨增加等會計調整）的持續性通常低於實際現金流量，佔比越高的公司，未來盈餘反轉或下修的機率往往越高。計算方式概念上為「（稅後淨利－營運現金流）÷ 平均總資產」，比率越高代表當期盈餘越依賴會計估計與調整撐出來，而非實際收到的現金，是財報鑑識領域最常被引用的盈餘品質指標之一。',
    // Sloan's OWN 1996 methodology used decile ranking against a sample (not a fixed universal
    // cutoff) — the ±10% magnitude threshold here is a widely-used later practitioner adaptation,
    // not Sloan's own precise number, per direct confirmation this distinction is fine to use.
    threshold: {
      description: '絕對值 < 10%（實務上常用的應計項目異常門檻，非 Sloan 原始論文的十分位法）',
      denominator: 1,
      numerator: value => (Math.abs(value) < 10 ? 1 : 0)
    }
  },
  // Added 2026-09-09 per direct request ("加上這個品質標準"/"加上去 但是 一定 要有出處可查，被
  // 引用也好"), then renamed same day per direct follow-up ("業界廣泛引用的股利永續性經驗法則
  // 太空泛 請找出更具體的名稱") — two separate live web searches confirmed there is no single
  // formally-named rule for this "60%" figure (no "XYZ Rule" the way e.g. the Chowder Rule has a
  // name), so rather than keep the vague "業界廣泛引用" attribution, this now names the one
  // concrete, checkable source found: Fidelity Investments' own investor-education paper "Payout
  // Ratio: The Most Influential Management Decision a Company Can Make?"
  // (fidelity.com/bin-public/060_www_fidelity_com/documents/Payout-Ratio-The-Most-Influential-
  // Management-Decision-a-Company-Can-Make-retail.pdf). Same honesty level as Sloan Accrual
  // Ratio/Cash Conversion Cycle above — a real, checkable practitioner source, explicitly NOT
  // presented as a landmark peer-reviewed study with one named academic author.
  {
    id: 'dividend-payout-ratio-safety',
    name: 'Fidelity 股利發放率安全門檻',
    nameEn: 'Fidelity Payout Ratio Guideline',
    author: 'Fidelity Investments（投資人教育文件）',
    category: '股東回饋',
    fieldId: 'dividendPayoutRatio.TTM',
    summary: '股利發放率低於 Fidelity 投資人教育資料建議的安全門檻，保留較多盈餘因應景氣循環。',
    detail:
      '出自 Fidelity Investments 的投資人教育文件《Payout Ratio: The Most Influential Management Decision a Company Can Make?》：股利發放率（現金股利 ÷ 稅後淨利）低於 60% 時，一般被視為留有較多緩衝空間，即使獲利下滑，也較有能力維持股利不縮減；高於 60% 則風險升高，但公用事業、REITs 等高配息產業慣例上發放率本來就偏高，屬產業特性差異，不是絕對標準。這不是一個有專屬名稱的正式法則（不像 Chowder Rule 那樣有具體命名），也不是單一學術論文，而是 Fidelity 這份文件裡整理提出的具體門檻建議。',
    threshold: {
      description: '< 60%（Fidelity 投資人教育文件的建議門檻）',
      denominator: 1,
      numerator: value => (value < 60 ? 1 : 0)
    }
  }
]

// StockGuruBadgeCard.vue groups by category and shows EVERY real badge within it (per direct
// correction 2026-09-09, "斯隆應計項目比率 也算獲利品質的徽章。所以用戶會看到 1/2。點進去以後才
// 看到F-Score現在分數，以及 斯隆應計項目比率 實際分數" — an earlier version picked only one
// "primary" badge per category via a since-removed primaryGuruBadgeByCategory(), which silently
// left Sloan Accrual Ratio and Beneish M-Score/DuPont out of 獲利品質's own tile even though
// they're real badges assigned to that category).
export function guruBadgesByCategory(): Partial<Record<GuruBadgeCategory, GuruBadge[]>> {
  const map: Partial<Record<GuruBadgeCategory, GuruBadge[]>> = {}
  for (const badge of GURU_BADGES) {
    const list = map[badge.category] ?? (map[badge.category] = [])
    list.push(badge)
  }
  return map
}
