import { FINANCIAL_ANALYSIS_DIMENSIONS, type FinancialAnalysisDimension } from '~/utils/financial-analysis-dimensions'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import type { FilterCategory, FilterMetric, FilterMetricBadgeThreshold } from '~/composables/screener/useFilterSchema'

// 8-category taxonomy per direct request ("徽章分成八類 股東回饋 獲利品質 獲利能力 成長動能
// 財務韌性 市場評價 營運周轉 大戶籌碼") — the first 6 come from the shared
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
  財務韌性: '#dc2626',
  市場評價: '#7c3aed',
  營運周轉: '#92400e',
  大戶籌碼: '#be185d'
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
  resilience: '財務韌性',
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

// Source-link lookup, replacing this file's own former hardcoded `sourceUrl` field (added
// 2026-09-10, removed the same day) — per direct request ("後端有給 referenceUrl，你前端忠實
// 呈現就好。不然這樣我管理起來要兩邊跑"), bff-ts wired GET /metrics' own `referenceUrl` field
// through the same day (commit 71572ca, same treatment as formulaLatex), so this is now read
// live off the shared schema instead of maintained twice. A badge's own `fieldId` is
// `${metricKey}.${fieldKey}`, so locateFieldInSchema (already exported by useFilterSchema.ts)
// finds the right metric directly — no separate lookup helper needed here.
export function guruBadgeSourceUrl(categories: FilterCategory[], badge: GuruBadge): string | null {
  return locateFieldInSchema(categories, badge.fieldId)?.metric.referenceUrl ?? null
}

// One real hardcoded exception, per mutual agreement with analysis-ts during the 2026-09-10
// migration below: Piotroski F-Score's numerator is `clamp(round(value), 0, 9)` (a genuine 0-9
// checklist score, not a single pass/fail comparison) and its "met" bar is a non-default
// `isMet: numerator => numerator >= 8` (Piotroski's own 2000 paper treats 8-9 as one top-quality
// bucket, not requiring a perfect 9/9) — the declarative comparator vocabulary the other 11
// badges now use (see buildGuruBadges() below) can't express either of those cleanly, so this
// one stays a real object here instead of backend data.
const PIOTROSKI_BADGE: GuruBadge = {
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
    isMet: numerator => numerator >= 8
  }
}

// The other 11 badges (Altman Z-Score/Beneish M-Score/Ohlson O-Score/Zmijewski Score/Graham
// Number/NCAV/S&P 500 earnings eligibility/Sloan Accrual Ratio/Fidelity payout-ratio guideline/
// SUE/Chowder Number) used to be hardcoded objects here, each with a hand-written `numerator`
// function — MIGRATED to backend data 2026-09-10 per direct request ("畫面不變動，只把資料設定
// 搬去後端，請與analysis傳達"). Their real, compliance-reviewed history — why each threshold is
// what it is, why an earlier Nissim-Penman RNOA/DuPont/Sustainable Growth Rate/Cash Conversion
// Cycle badge was each REMOVED for not having a real citable threshold (verified via live web
// search each time — the paper's own actual comparison concept didn't match a simple threshold,
// or no single authoritative source could be found), why NCAV's "× 2/3" safety-margin multiplier
// was dropped over a compliance concern — now lives in analysis-ts's own MetricDefinitionSpec
// comments, not here. This file no longer carries a second copy of that history to drift out of
// sync with; see git blame on this comment's own prior revision if that history is ever needed
// again locally.
//
// buildGuruBadges() below reconstructs the exact same GuruBadge shape these used to be, by
// reading each metric's own `badge` field from GET /metrics (added by bff-ts, commit a128d28)
// and converting its declarative `threshold` (comparator/value/compareAgainstFieldId/
// allPositiveFieldIds) into the same numerator-function shape every consumer already expects —
// GuruBadgeCard.vue/StockGuruBadgeCategoryCard.vue/guru-indicators.vue don't need to know or
// care that the threshold logic used to be hand-written here and is now derived.
function numeratorFor(threshold: FilterMetricBadgeThreshold): GuruBadgeThreshold['numerator'] {
  if (threshold.allPositiveFieldIds) {
    // First id is this badge's own fieldId (passed as `value`); the rest arrive via `extra`.
    const extraIds = threshold.allPositiveFieldIds.slice(1)
    return (value, extra) => {
      if (value <= 0) return 0
      for (const id of extraIds) {
        const extraValue = extra[id]
        if (extraValue === null || extraValue === undefined) return null
        if (extraValue <= 0) return 0
      }
      return 1
    }
  }
  if (threshold.compareAgainstFieldId) {
    const compareId = threshold.compareAgainstFieldId
    return (value, extra) => {
      const compareValue = extra[compareId]
      if (compareValue === null || compareValue === undefined) return null
      // Every real badge using this shape so far (Graham Number/NCAV) is 'lt' — extend if a
      // future migrated badge needs a different direction.
      return compareValue < value ? 1 : 0
    }
  }
  const { comparator, value: thresholdValue, valueMin, valueMax } = threshold
  if (comparator === 'gt') return value => (value > thresholdValue! ? 1 : 0)
  if (comparator === 'lt') return value => (value < thresholdValue! ? 1 : 0)
  if (comparator === 'gte') return value => (value >= thresholdValue! ? 1 : 0)
  if (comparator === 'abs_lt') return value => (Math.abs(value) < thresholdValue! ? 1 : 0)
  // Added 2026-09-10 (analysis-ts commit dcb1f17) — a real correction, not a new feature: the
  // Fidelity payout-ratio badge's own real conclusion is a 40–60% RANGE, not a one-sided "< 60%"
  // floor (see FilterMetricBadgeThreshold's own comment on useFilterSchema.ts).
  if (comparator === 'in_range') return value => (value >= valueMin! && value <= valueMax! ? 1 : 0)
  // Shouldn't happen with real backend data (every real threshold shape is one of the above) —
  // fails safe to "insufficient data" rather than silently mis-scoring.
  return () => null
}

function metricBadgeToGuruBadge(category: GuruBadgeCategory, metric: FilterMetric): GuruBadge | null {
  const badge = metric.badge
  if (!badge) return null
  const { threshold } = badge
  const extraFieldIds = threshold.compareAgainstFieldId
    ? [threshold.compareAgainstFieldId]
    : threshold.allPositiveFieldIds?.slice(1)
  const fieldId = threshold.allPositiveFieldIds ? threshold.allPositiveFieldIds[0]! : `${metric.key}.${badge.token}`
  return {
    id: badge.id,
    name: badge.name,
    nameEn: badge.nameEn,
    author: badge.author,
    category,
    fieldId,
    summary: badge.summary,
    detail: badge.detail,
    threshold: {
      description: threshold.description,
      denominator: threshold.denominator,
      extraFieldIds,
      numerator: numeratorFor(threshold)
    }
  }
}

// Builds the full, current badge list from a live GET /metrics response — Piotroski first
// (hardcoded, see its own comment above), then every other metric across every category that
// has a real `badge` field. Every real consumer already has `categories` on hand from its own
// `await useFilterSchema()` call (see feedback_useasyncdata_shared_key_race memory for why that
// await matters), so this takes it as a plain argument rather than fetching again.
export function buildGuruBadges(categories: FilterCategory[]): GuruBadge[] {
  const badges: GuruBadge[] = [PIOTROSKI_BADGE]
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
