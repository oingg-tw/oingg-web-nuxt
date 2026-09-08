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
      '史丹佛會計學教授 Joseph Piotroski 在 2000 年發表的論文中提出，針對淨值市價比偏低（傳統定義的價值股）的公司，設計 9 個財務體質檢查項目，每項符合得 1 分、不符合得 0 分，總分 0～9。9 個項目分成三組：獲利能力（如稅後淨利是否為正、營運現金流是否為正）、財務槓桿與流動性（如負債比是否下降、流動比率是否上升）、營運效率（如毛利率與資產週轉率是否提升）。分數本身只反映「這家公司近期在這 9 個會計面向上，體質是變好還是變差」。'
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
      '紐約大學金融學教授 Edward Altman 於 1968 年發表，是財務危機預測領域最早、也最廣為引用的模型之一。將營運資金／總資產、保留盈餘／總資產、稅前息前淨利／總資產、股票市值／負債帳面值、營收／總資產這 5 個財務比率各自加權後加總，得出一個綜合分數，分數越低代表模型認定的財務危機風險越高。這是一個統計模型，反映的是歷史樣本歸納出的風險關聯性。'
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
      '印第安納大學會計學教授 Messod Beneish 於 1999 年發表，設計初衷是偵測財報上常見的盈餘操縱手法（例如提前認列營收、虛增應收帳款）。模型結合應收帳款成長率、毛利率變化、資產品質變化、營收成長率、折舊政策變化、銷管費用變化、財務槓桿變化、應計項目等 8 個會計比率，加權計算出一個綜合分數。分數本身是統計模型對「財報數字是否出現操縱跡象常見的異常模式」的量化呈現，不等於已認定財報造假。'
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
      '紐約大學會計學教授 James Ohlson 於 1980 年發表，是財務危機預測領域除了 Altman Z-Score 外另一個常被引用的模型。與 Z-Score 用加權加總的做法不同，O-Score 用邏輯迴歸（logistic regression）方式，將公司規模、負債比、營運資金比率、流動比率、獲利能力、現金流量等 9 項財務因子代入模型，直接估計出一個「陷入財務困境」的機率值。同樣是根據歷史樣本建立的統計模型，反映的是統計上的關聯性。'
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
      '芝加哥大學會計學教授 Mark Zmijewski 於 1984 年發表，同樣是財務危機預測模型，採用機率單位迴歸（probit model），聚焦在資產報酬率（ROA）、財務槓桿（負債／總資產）、流動性（流動資產／流動負債）這 3 個核心比率上，計算出企業財務困境的機率。模型設計上刻意只用少數幾個核心比率，是為了在樣本外的預測穩定度上做取捨。跟其他財務危機模型一樣，反映的是統計關聯性。'
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
      '價值投資之父 Benjamin Graham 在其著作中提出的簡化估值公式，計算方式為「每股盈餘 × 每股淨值 × 22.5」開根號。22.5 這個常數來自 Graham 自己設定的兩個上限：本益比不超過 15 倍、股價淨值比不超過 1.5 倍（15 × 1.5 = 22.5）。這個數字原始用途是作為一個保守的估值參考上限，幫助篩選相對於獲利與帳面資產而言股價偏低的公司，是 Graham 個人投資哲學下的簡化公式。'
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
      'Benjamin Graham 提出的另一個保守估值角度，計算方式為流動資產減去全部負債（不含流動資產以外的其他資產，如廠房設備），概念上接近「假設公司立刻清算，扣掉全部負債後，流動資產部分大約還剩多少」。當股價低於每股 NCAV 時，傳統上被視為股價相對於這個保守清算價值角度而言偏低，因此又被稱為 Net-Net 選股法。這是一個特定角度的估值參考方法，不考慮公司未來獲利能力或成長性。'
  },
  {
    id: 'nissim-penman-rnoa',
    name: 'Nissim-Penman RNOA',
    nameEn: 'Return on Net Operating Assets',
    author: 'Doron Nissim ＆ Stephen Penman, 2001',
    category: '獲利能力',
    fieldId: 'nissimPenmanRnoa.TTM',
    summary: '把財務報表拆成「營運」與「融資」兩部分，衡量純營運資產的報酬率。',
    detail:
      '哥倫比亞大學會計學教授 Doron Nissim 與 Stephen Penman 於 2001 年發表的財報分析框架，主張傳統 ROE 混雜了「本業營運」與「融資槓桿」兩種完全不同性質的報酬來源，容易讓財務槓桿撐出來的高 ROE 誤讀成營運能力強。RNOA（淨營運資產報酬率）將資產負債表與損益表都拆成營運與融資兩部分，只計算「營運資產所產生的稅後淨營運利潤」除以「淨營運資產」，藉此獨立出不受融資槓桿影響的本業獲利能力。這個框架跟本站個股頁的杜邦分析卡片系列一樣，是拆解獲利品質來源的分析工具。'
  },
  {
    id: 'dupont-analysis',
    name: 'DuPont 分析（杜邦分析）',
    nameEn: 'DuPont Analysis',
    author: 'DuPont 公司，1920 年代',
    category: '獲利品質',
    fieldId: 'dupontExtendedRoe.TTM',
    summary: '把股東權益報酬率（ROE）拆解成淨利率、資產週轉率、財務槓桿等因子的分析框架。',
    detail:
      '源自美國杜邦公司財務部門在 1920 年代發展出的財報分析方法，將 ROE 拆解為「淨利率 × 總資產週轉率 × 權益乘數」，後續學術界與實務界進一步拆解出更細的版本（如再把淨利率拆成稅務負擔、利息負擔、營業利潤率）。拆解的用意是回答「同樣的 ROE 數字，究竟是靠本業獲利能力撐起來的，還是靠資產運用效率，或是靠財務槓桿堆出來的」——同一個 ROE 數字，背後的組成可能完全不同，代表的體質意涵也不一樣。本站個股頁面「獲利品質」區塊已有完整的杜邦拆解圖表卡片可供查詢，這裡是方法論本身的簡介。'
  }
]

// StockGuruBadgeCard.vue shows exactly one badge per category (per direct request "這張卡片有
// 八個面向的徽章") even though 3 categories currently have multiple real badges — picks the
// FIRST one in GURU_BADGES' own array order for each category, so adding a new badge earlier in
// the array (not appending it) is how a future edit would change which one is "primary" for a
// category, rather than maintaining a second parallel mapping that could drift out of sync.
export function primaryGuruBadgeByCategory(): Partial<Record<GuruBadgeCategory, GuruBadge>> {
  const map: Partial<Record<GuruBadgeCategory, GuruBadge>> = {}
  for (const badge of GURU_BADGES) {
    if (!map[badge.category]) map[badge.category] = badge
  }
  return map
}
