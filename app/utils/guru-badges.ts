import type { Component } from 'vue'
import { Coin, CircleCheck, Histogram, Lock, PriceTag, Refresh, Suitcase, TrendCharts } from '@element-plus/icons-vue'
import { FINANCIAL_ANALYSIS_DIMENSIONS, type FinancialAnalysisDimension } from '~/utils/financial-analysis-dimensions'
import type { FilterCategory, FilterMetric } from '~/composables/screener/useFilterSchema'

// 八類徽章（「徽章分成八類 股東回饋 獲利品質 獲利能力 成長動能 安全韌性 市場評價 營運周轉 大戶籌碼」；2026-09-21 起 財務韌性→安全韌性）：
// 前六類來自共用的 FINANCIAL_ANALYSIS_DIMENSIONS，不在這裡重抄一份（2026-09-09，兩份清單不能各自漂）；營運周轉／大戶籌碼是這套
// 分類多出來的兩類。
export type GuruBadgeCategory = FinancialAnalysisDimension | '營運周轉' | '大戶籌碼'

// 8 個分類的固定顯示順序——guru-indicators.vue（經 buildGuruBadges() 的迭代順序）與 StockFinancialHighlightsRisksCard 都用。
export const GURU_BADGE_CATEGORIES: GuruBadgeCategory[] = [...FINANCIAL_ANALYSIS_DIMENSIONS, '營運周轉', '大戶籌碼']

// 每個分類一個 icon（2026-09-10 從 stock/[code].vue 的 TAB_ICONS 搬來，guru-indicators 的分類列共用同一份）。獲利能力
// PieChart→Histogram、市場評價 Money→PriceTag（2026-09-14 使用者要求換，原本跟側邊欄的 ETF 專區／持股管理撞 icon）。
export const GURU_CATEGORY_ICON: Record<GuruBadgeCategory, Component> = {
  股東回饋: Coin,
  獲利品質: CircleCheck,
  獲利能力: Histogram,
  成長動能: TrendCharts,
  安全韌性: Lock,
  市場評價: PriceTag,
  營運周轉: Refresh,
  大戶籌碼: Suitcase
}

// GET /metrics 的 category `key`（analysis-ts 穩定的內部 slug）→ 本站的顯示名稱（2026-09-10）。後端的 name 有時跟本站用詞不同
//（實測 股東政策→股東回饋、營運效率→營運周轉），所以鍵用 key 不用 name。型錄沒有 大戶籌碼（前端專用、目前零徽章），刻意不列。
// buildGuruBadges() 也用它推每個徽章的顯示分類。
export const METRIC_CATEGORY_KEY_TO_DISPLAY: Record<string, GuruBadgeCategory> = {
  valuation: '市場評價',
  dividend: '股東回饋',
  resilience: '安全韌性',
  quality: '獲利品質',
  profitability: '獲利能力',
  efficiency: '營運周轉',
  growth: '成長動能'
}

// 固定的一行免責文字，由顯示徽章明細的元件各自顯示一次（GuruBadgeCard、StockGuruBadgeDialog、StockBadgeDetailPage、
// StockFinancialHighlightsRisksCard）——「與其文案在那邊寫非投資建議，不如把這個彈窗共用元件下面放固定文案就好」（2026-09-09）。
export const GURU_BADGE_DISCLAIMER = '以上為公開學術方法論的框架介紹，不代表本站對任何個股之評等或投資建議。'

// 方法論自己文獻裡的單一已發表比較值（機率輸出的模型用教科書的 0.5 分類邊界）——「每個都會像現在的F-score那樣有分子分母」。措辭
// 中性（「符合...項標準中的...項」「> 2.99」），不是達標／未達標（「改用中性事實描述」）：報告一個真實數字滿足 N 個文獻定義條件
// 中的幾個，不是綜合評價；Altman 自己發表的安全／灰色／危險區間刻意不呈現。
// 2026-09-14 簡化：原本還有一套手寫的 numerator／isMet 比較器，analysis-ts 的 GET /stocks/:symbol/badges（useStockBadges）在伺服器端
// 算 `passed` 後移除——他們指出用戶端那套有真 bug（比較器處理不一致、產業排除的 null 情況）。這裡只剩 `description` 與 Piotroski
// 多訊號分數顯示要用的 `denominator`。
export interface GuruBadgeThreshold {
  description: string
  // How many "points" this badge is out of. Piotroski F-Score is the one genuine 0-9 checklist
  // (denominator 9 — see PIOTROSKI_FIELD_ID's own comment for its 2026-09-10→2026-09-19 split-
  // then-remerge history); every other badge here is a single real published comparison
  // (denominator 1) — its pass/fail comes directly from GET /stocks/:symbol/badges' own `passed`
  // field, not from comparing numerator===denominator here.
  denominator: number
  // The threshold is a market POSITION（「前 20%」）rather than a value（「≥ 40%」）. Carried through
  // from the catalog's own `badge.threshold.percentileRank` so a renderer can put the company's
  // position — not just its raw figure — beside a threshold stated in positions（2026-09-22）.
  isPercentileRank: boolean
  // Which way that position counts, from the same catalog field. `desc` means the top of the
  // ranking is the HIGHEST value（研發密度前 20%: ≥ the boundary）, `asc` the lowest（應計項目比率
  // 最低十分位: ≤ it）. Null on absolute-threshold badges, which carry their own comparator in
  // `description`.
  percentileDirection: 'asc' | 'desc' | null
}

export interface GuruBadge {
  id: string
  name: string
  nameEn: string
  author: string
  category: GuruBadgeCategory
  // 這個方法論對應的 GET /metrics 欄位（metricCode.timeframe 格式，不是舊的 metricKey.fieldKey）；2026-09-09 起對每檔做即時查詢。
  fieldId: string
  summary: string
  detail: string
  threshold: GuruBadgeThreshold
  // Mirrors the underlying metric's own FilterMetric.hasProvenance (see that field's own comment)
  // — whether GET /stocks/:symbol/metric-provenance supports this badge's metricCode.
  hasProvenance: boolean
  // 徽章自己的門檻出處（型錄 badge.sourceUrl）；兩個門檻來自紙本書的徽章是 null。2026-09-20 取代了退回指標 referenceUrl 的
  // fallback——那回答的是「這個指標是什麼」不是「門檻為什麼是 40%」（線上回報的 bug）。沒有 sourceUrl 就不畫連結，不得改用指標的
  // 連結；沒有連結不代表門檻是本站發明的（見 author）。
  sourceUrl: string | null
}

// A badge's fieldId is `${metricKey}.${fieldKey}` (e.g. "sue.Q", "chowderNumber.FY") —
// metric-provenance's own `metricCode` param is exactly that leading metricKey segment.
export function guruBadgeMetricCode(badge: GuruBadge): string {
  return badge.fieldId.split('.')[0]!
}

// Was a transitional safety net (bff-ts's GET /metrics mapping lagged analysis-ts's own
// hasProvenance field by several hours on 2026-09-14) — removed once bff-ts confirmed synced the
// same day (verified live via curl: 12 metricCodes, exactly matching analysis-ts's own list).
// Just reads the live field now; see FilterMetric.hasProvenance's own comment for the full field
// history.
export function metricHasProvenance(metric: FilterMetric): boolean {
  return metric.hasProvenance ?? false
}

// 「數字可回溯到原始申報資料」：直接轉發 FilterMetric.hasProvenance（2026-09-14 拿掉前端自己維護的白名單——payablesTurnover 上游
// 支援了而名單沒更新，沒人發現；analysis-ts：「不要自己另外維護清單」）。
export function guruBadgeHasProvenance(badge: GuruBadge): boolean {
  return badge.hasProvenance
}

// Piotroski F-Score 2026-09-10 拆成 3 個徽章、2026-09-19 依使用者決定合併回「一個指標、一個徽章」：型錄的 badge 欄位直接帶
// name／author／summary／detail／denominator(9)，GET /stocks/:symbol/badges 帶 passed／value（0–9），跟其他徽章一樣走
// metricBadgeToGuruBadge()。唯一的特殊處理在明細：九項訊號（GET /stocks/:symbol/piotroski-breakdown）在 StockGuruBadgeDialog 裡
// 用 fieldId === PIOTROSKI_FIELD_ID 判斷要不要畫成清單（仍照論文的三組 groupMetadata 分組）。
export const PIOTROSKI_FIELD_ID = 'piotroskiFScore.Q'

// 其餘徽章（Altman Z／Beneish M／Ohlson O／Zmijewski／Graham Number／NCAV／S&P 500 盈餘門檻／Sloan 應計／Fidelity 發放率／SUE／
// Chowder＋2026-09-14 加的 roe／grossMargin／netProfitMargin）原本是這裡手寫的物件各帶一支 numerator 函式：2026-09-10 定義搬到後端
//（「畫面不變動，只把資料設定搬去後端」），2026-09-14 判定也搬到後端——GET /stocks/:symbol/badges 逐家算 passed，analysis-ts 證實前端
// 自己比較有真 bug（比較子處理不一致、產業排除的 null 處理錯）。這個檔案不再做任何門檻運算；FilterMetricBadgeThreshold 的
// comparator 等欄位這裡沒用到，只用 threshold.description 與 denominator。門檻的合規審查史（為什麼移除 RNOA／杜邦／SGR／CCC 徽章、
// NCAV 的 2/3 安全邊際為什麼拿掉）在 analysis-ts 的 MetricDefinitionSpec 註解。buildGuruBadges() 從型錄的 badge 欄位重建同樣的
// GuruBadge 形狀，呼叫端不用知道資料曾經手寫在這裡。
function metricBadgeToGuruBadge(category: GuruBadgeCategory, metric: FilterMetric): GuruBadge | null {
  const badge = metric.badge
  if (!badge) return null
  const { threshold } = badge
  // fieldId 三段（2026-09-26 實測前兩段目前都沒有實例，第三段是唯一活著的路徑；兩段都不刪，規格仍允許而且各自造成過線上故障）：
  //   1. allPositiveFieldIds 形狀的徽章 timeframe 刻意留空（期別已在第一個 fieldId 裡）→ 取第一個；目前 0 個（33 個徽章：value 21／
  //      percentileRank 9／compareAgainstFieldId 2／in_range 1；唯一實例 eps 的徽章整個被移除）。
  //   2. 一般徽章用 badge.timeframe——2026-09-14 的線上 bug 是讀了不存在的 badge.token，每個 fieldId 變成 "sue.undefined"、後端 400。
  //   3. 沒有 timeframe 的徽章退回指標自己的第一個 field（2026-09-19 合併後的 Piotroski 曾經沒有 timeframe，產生
  //      "piotroskiFScore.undefined"；上游補上 'Q' 之後目前 0 個）。
  // fieldId 只給 locateFieldInSchema()（公式／出處／連結）用，判定讀 useStockBadges 的 passed（以 metricCode 為鍵）。
  const fieldId = threshold.allPositiveFieldIds
    ? threshold.allPositiveFieldIds[0]!
    : `${metric.key}.${badge.timeframe ?? metric.fields[0]?.key ?? ''}`
  return {
    id: metric.key,
    name: badge.name,
    nameEn: badge.nameEn,
    author: badge.author,
    category,
    fieldId,
    summary: badge.summary,
    detail: badge.detail,
    hasProvenance: metricHasProvenance(metric),
    sourceUrl: badge.sourceUrl ?? null,
    threshold: {
      description: threshold.description,
      denominator: threshold.denominator,
      isPercentileRank: threshold.percentileRank != null,
      percentileDirection: threshold.percentileRank?.direction ?? null
    }
  }
}

// Builds the full, current badge list from a live GET /metrics response — every metric across
// every category that has a real `badge` field, piotroskiFScore included (see PIOTROSKI_FIELD_ID's
// own comment for its split-then-remerge history; it's a plain badge like any other again as of
// 2026-09-19). Every real consumer already has `categories` on hand from its own
// `await useFilterSchema()` call (see feedback_useasyncdata_shared_key_race memory for why that
// await matters), so this takes it as a plain argument rather than fetching again.
export function buildGuruBadges(categories: FilterCategory[]): GuruBadge[] {
  const badges: GuruBadge[] = []
  for (const backendCategory of categories) {
    const displayCategory = METRIC_CATEGORY_KEY_TO_DISPLAY[backendCategory.key]
    if (!displayCategory) continue
    for (const metric of backendCategory.metrics) {
      const badge = metricBadgeToGuruBadge(displayCategory, metric)
      if (badge) badges.push(badge)
    }
  }
  return badges
}
