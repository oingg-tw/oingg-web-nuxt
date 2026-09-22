import type { Component } from 'vue'
import { Coin, CircleCheck, Histogram, Lock, PriceTag, Refresh, Suitcase, TrendCharts } from '@element-plus/icons-vue'
import { FINANCIAL_ANALYSIS_DIMENSIONS, type FinancialAnalysisDimension } from '~/utils/financial-analysis-dimensions'
import type { FilterCategory, FilterMetric } from '~/composables/screener/useFilterSchema'

// 8-category taxonomy per direct request ("徽章分成八類 股東回饋 獲利品質 獲利能力 成長動能
// 安全韌性 市場評價 營運周轉 大戶籌碼"，2026-09-21 起 財務韌性→安全韌性) — the first 6 come from the shared
// FINANCIAL_ANALYSIS_DIMENSIONS constant (also used by useStockCards.ts's own
// STOCK_CARD_CATEGORIES, see that file's own import) rather than being repeated here as an
// independent list, per direct request 2026-09-09 to stop the two from being able to drift
// apart silently. 營運周轉/大戶籌碼 are this taxonomy's own two extra categories on top of that
// shared base (STOCK_CARD_CATEGORIES adds a different one, 公司資訊, instead).
export type GuruBadgeCategory = FinancialAnalysisDimension | '營運周轉' | '大戶籌碼'

// Fixed display order for the 8 categories — used by both guru-indicators.vue (implicitly, via
// buildGuruBadges()' own iteration order) and StockGuruBadgeCard.vue (explicitly, since that
// card shows exactly one slot per category regardless of how many real badges a category has).
export const GURU_BADGE_CATEGORIES: GuruBadgeCategory[] = [...FINANCIAL_ANALYSIS_DIMENSIONS, '營運周轉', '大戶籌碼']

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
  安全韌性: '#dc2626',
  市場評價: '#7c3aed',
  營運周轉: '#92400e',
  大戶籌碼: '#be185d'
}

// One consistent icon per category — moved here 2026-09-10 from stock/[code].vue's own
// page-local TAB_ICONS constant (that page's per-category tab icons, chosen for the same 8-
// category taxonomy above and the screener's own MoleculeIndicatorPickerBody.vue category
// picker) so guru-indicators.vue's own nav row can reuse the exact same mapping instead of
// inventing a second one that could silently drift from it — same "share one map, don't
// duplicate" precedent as GURU_CATEGORY_COLOR just above.
//
// 獲利能力 PieChart→Histogram and 市場評價 Money→PriceTag both changed 2026-09-14 per direct
// follow-up ("個股瀏覽的 獲利能力要換個 icon" / "市場評價也要換個icon") — both were picked before
// this app's sidebar nav (app-features.ts) settled on PieChart for ETF 專區 and Money for 持股
// 管理 the same day, so the two ended up sharing an icon with an unrelated sidebar entry (same
// "too visually close to X" class of issue as this app's other icon reassignments). Histogram
// reads as "profitability" via the margin/ratio bar-chart shape already used throughout this
// category's own cards; PriceTag reads directly as "what is this worth" for a valuation category.
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

// Maps GET /metrics' own category `key` (analysis-ts's stable internal slug, e.g. "valuation")
// to this app's own display-name taxonomy above — added 2026-09-10 for guru-indicators.vue's
// redesign, which now shows every real metric from that catalog (84 as of this date), not just
// the curated badge subset. Backend category NAMES sometimes differ from this app's own
// preferred wording (confirmed live: "股東政策"→股東回饋, "營運效率"→營運周轉, same "pure
// frontend display decision, decoupled from backend naming" precedent as
// financial-analysis-dimensions.ts's own comment) — keyed off the stable `key`, not the
// backend's own `name`, so a future backend copy tweak can't silently break this mapping.
// GET /metrics has no 大戶籌碼 category at all (that's a frontend-only badge category with zero
// badges assigned to it today anyway) — deliberately left out of this map, not an oversight.
// Also reused by buildGuruBadges() below to derive each migrated badge's display category.
export const METRIC_CATEGORY_KEY_TO_DISPLAY: Record<string, GuruBadgeCategory> = {
  valuation: '市場評價',
  dividend: '股東回饋',
  resilience: '安全韌性',
  quality: '獲利品質',
  profitability: '獲利能力',
  efficiency: '營運周轉',
  growth: '成長動能'
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
//
// Simplified 2026-09-14: this used to also carry a hand-written `numerator`/`isMet` comparator
// function (gt/lt/gte/abs_lt/in_range/allPositiveFieldIds/compareAgainstFieldId, all reconstructed
// from GET /metrics' own declarative threshold shape) — REMOVED once analysis-ts shipped
// GET /stocks/:symbol/badges (bff-ts proxy, see useStockBadges.ts's own comment), which computes
// `passed` server-side per company. analysis-ts's own words: the homegrown client-side comparison
// had real bugs (inconsistent comparator handling, industry-exclusion null cases mishandled) —
// this app no longer does its own pass/fail math for badges at all, it just reads the backend's
// answer. Only `description` (the human-readable criterion text) and `denominator` (still needed
// for Piotroski's own genuine multi-signal fraction display) remain.
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
}

export interface GuruBadge {
  id: string
  name: string
  nameEn: string
  author: string
  category: GuruBadgeCategory
  // The real GET /filters field this methodology corresponds to on this site (metricCode.timeframe
  // format — see project_screener_backend_outage memory for why this format, not the old
  // metricKey.fieldKey scheme). Wired to a live per-symbol lookup 2026-09-09 by
  // StockGuruBadgeCard.vue (see useGuruBadgeScores.ts) — reuses this same field mapping rather
  // than re-deriving it.
  fieldId: string
  summary: string
  detail: string
  threshold: GuruBadgeThreshold
  // Mirrors the underlying metric's own FilterMetric.hasProvenance (see that field's own comment)
  // — whether GET /stocks/:symbol/metric-provenance supports this badge's metricCode.
  hasProvenance: boolean
  // The BADGE's own verified source for its THRESHOLD — straight from the catalog's own
  // badge.sourceUrl (see FilterMetricBadge.sourceUrl's full comment). null on the two badges
  // whose threshold comes from a print book.
  //
  // This replaced a `guruBadgeSourceUrl(categories, badge)` helper on 2026-09-20 that did
  // `metric.academicSourceUrl ?? metric.referenceUrl` — a fallback chain onto the METRIC's own
  // links, which answer a different question ("what is this metric") than a badge's threshold
  // needs ("why is the threshold 40%"). analysis-ts fixed that at the source by giving badges
  // their own field; the helper is deleted rather than re-pointed so the fallback can't come back
  // by accident. A caller with no sourceUrl renders no link — it must NOT substitute the metric's
  // referenceUrl, and an absent link does not mean this app invented the threshold (see `author`).
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

// "數字可回溯到原始申報資料" pilot (2026-09-10 plan) — used to check a hand-maintained frontend
// allowlist (PROVENANCE_PILOT_METRIC_CODES) mirroring analysis-ts's own metric-provenance
// zod-validated set. REMOVED 2026-09-14 (real bug reported live: payablesTurnover got real
// provenance support server-side but wasn't in this hardcoded list — and wasn't even a badge
// metric — so nothing in this app noticed) in favor of reading FilterMetric.hasProvenance
// directly off the live schema, per analysis-ts's own request ("不要自己另外維護清單，之後我們
// 每次擴大範圍，這個欄位會自動反映"). Just forwards badge.hasProvenance now (see
// metricBadgeToGuruBadge()'s own comment for where that's set from the metric).
export function guruBadgeHasProvenance(badge: GuruBadge): boolean {
  return badge.hasProvenance
}

// Piotroski F-Score was SPLIT into 3 separate badges 2026-09-10 (one per the paper's own signal
// grouping: profitability/leverage-liquidity/operating-efficiency), then MERGED BACK into one
// 2026-09-19 per the user's own decision, relayed by analysis-ts once they shipped it server-side
// ("Piotroski F-Score 依使用者決定合併回「一個指標、一個徽章」"). It now flows through
// metricBadgeToGuruBadge() below exactly like every other badge — GET /metrics' own `badge` field
// carries name/author/summary/detail/denominator(9) directly, and GET /stocks/:symbol/badges
// carries its `passed`/`value` (a real 0-9 score) the same way every other badge's does. No
// special-casing left in this file at all.
//
// The one place this badge still needs distinct handling is its own DETAIL view: the 9 individual
// signals behind the aggregate score (GET /stocks/:symbol/piotroski-breakdown, unchanged by the
// remerge — see usePiotroskiBreakdown.ts's own comment) are worth showing as a checklist, not just
// the bare "8/9" fraction. StockGuruBadgeDialog.vue's own isPiotroskiBadge() checks
// `fieldId === PIOTROSKI_FIELD_ID` to know when to render that checklist (still grouped into the
// paper's own 3 sections via `groupMetadata`, just inside ONE dialog now instead of 3 separate
// badges).
export const PIOTROSKI_FIELD_ID = 'piotroskiFScore.Q'

// The other 12 badges (Piotroski F-Score/Altman Z-Score/Beneish M-Score/Ohlson O-Score/
// Zmijewski Score/Graham Number/NCAV/S&P 500 earnings eligibility/Sloan Accrual Ratio/Fidelity
// payout-ratio guideline/SUE/Chowder Number), plus the 3 profitability badges added 2026-09-14
// (roe/grossMargin/netProfitMargin), used to be hardcoded objects here, each with a hand-written
// `numerator`
// function — MIGRATED to backend DEFINITION data 2026-09-10 ("畫面不變動，只把資料設定搬去後端"),
// then MIGRATED AGAIN 2026-09-14 to backend-computed PASS/FAIL: this function used to convert
// GET /metrics' own declarative `threshold` (comparator/value/compareAgainstFieldId/
// allPositiveFieldIds) into a numerator function this app ran itself against a fetched raw value
// — analysis-ts confirmed that homegrown comparison had real bugs (inconsistent comparator
// handling, industry-exclusion null cases mishandled) once they shipped
// GET /stocks/:symbol/badges (bff-ts proxy, see useStockBadges.ts), which computes `passed`
// server-side per company. StockGuruBadgeDialog.vue now reads `passed`/`value`/`nullReason`
// straight from that endpoint for every non-Piotroski badge; this file no longer does any
// threshold math of its own. `FilterMetricBadgeThreshold`'s comparator/value/valueMin/valueMax/
// compareAgainstFieldId/allPositiveFieldIds fields (useFilterSchema.ts) are now unused here —
// only `threshold.description` (the human-readable criterion text) and `denominator` still are.
//
// Their real, compliance-reviewed history — why each threshold is what it is, why an earlier
// Nissim-Penman RNOA/DuPont/Sustainable Growth Rate/Cash Conversion Cycle badge was each REMOVED
// for not having a real citable threshold, why NCAV's "× 2/3" safety-margin multiplier was
// dropped over a compliance concern — lives in analysis-ts's own MetricDefinitionSpec comments,
// not here.
//
// buildGuruBadges() below reconstructs the exact same GuruBadge shape these used to be, by
// reading each metric's own `badge` field from GET /metrics for definition/methodology text —
// GuruBadgeCard.vue/StockGuruBadgeDialog.vue/guru-indicators.vue don't need to know or care
// that this data used to be hand-written here and is now sourced from the backend.
function metricBadgeToGuruBadge(category: GuruBadgeCategory, metric: FilterMetric): GuruBadge | null {
  const badge = metric.badge
  if (!badge) return null
  const { threshold } = badge
  // Real bug fixed 2026-09-14 (reported live: "不管怎麼重新整理都顯示資料不足") — this read
  // `badge.token`, a field that never actually existed on bff-ts's response (the real key is
  // `timeframe` — see FilterMetricBadge's own comment). Every badge built through this generic
  // path ended up with a fieldId like "sue.undefined", which the backend correctly rejected with
  // a 400 ("Unknown filter field"). `allPositiveFieldIds`-shaped badges leave `badge.timeframe`
  // deliberately empty (analysis-ts's own convention — the timeframe is already baked into the
  // first allPositiveFieldIds entry), so fieldId still needs this special case purely for
  // locateFieldInSchema() lookups (formula/sources/referenceUrl display) — unrelated to scoring
  // now, which reads `passed` from useStockBadges.ts keyed by metricCode, not fieldId.
  //
  // Third case (2026-09-19): the remerged Piotroski badge carries NO `timeframe` at all (the
  // catalog's badge object simply lacks the key — verified live), which made this line produce
  // "piotroskiFScore.undefined" — so PIOTROSKI_FIELD_ID never matched and locateFieldInSchema()
  // (source link, sources) found nothing for that badge. A badge without an explicit timeframe
  // falls back to its metric's own first (for Piotroski: only) field, "piotroskiFScore.Q".
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
      isPercentileRank: threshold.percentileRank != null
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

// StockGuruBadgeCard.vue groups by category and shows EVERY real badge within it (per direct
// correction 2026-09-09, "斯隆應計項目比率 也算獲利品質的徽章。所以用戶會看到 1/2。點進去以後才
// 看到F-Score現在分數，以及 斯隆應計項目比率 實際分數" — an earlier version picked only one
// "primary" badge per category via a since-removed primaryGuruBadgeByCategory(), which silently
// left Sloan Accrual Ratio and Beneish M-Score/DuPont out of 獲利品質's own tile even though
// they're real badges assigned to that category).
export function guruBadgesByCategory(categories: FilterCategory[]): Partial<Record<GuruBadgeCategory, GuruBadge[]>> {
  const map: Partial<Record<GuruBadgeCategory, GuruBadge[]>> = {}
  for (const badge of buildGuruBadges(categories)) {
    const list = map[badge.category] ?? (map[badge.category] = [])
    list.push(badge)
  }
  return map
}
