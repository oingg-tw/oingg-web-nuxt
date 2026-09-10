import type { Component } from 'vue'
import { Coin, CircleCheck, Lock, Money, PieChart, Refresh, Suitcase, TrendCharts } from '@element-plus/icons-vue'
import { FINANCIAL_ANALYSIS_DIMENSIONS, type FinancialAnalysisDimension } from '~/utils/financial-analysis-dimensions'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import type { FilterCategory, FilterMetric, FilterMetricBadgeThreshold } from '~/composables/screener/useFilterSchema'
import type { PiotroskiGroupMetadata } from '~/composables/stock/usePiotroskiBreakdown'

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

// One consistent icon per category — moved here 2026-09-10 from stock/[code].vue's own
// page-local TAB_ICONS constant (that page's per-category tab icons, chosen for the same 8-
// category taxonomy above and the screener's own MoleculeIndicatorPickerBody.vue category
// picker) so guru-indicators.vue's own nav row can reuse the exact same mapping instead of
// inventing a second one that could silently drift from it — same "share one map, don't
// duplicate" precedent as GURU_CATEGORY_COLOR just above.
export const GURU_CATEGORY_ICON: Record<GuruBadgeCategory, Component> = {
  股東回饋: Coin,
  獲利品質: CircleCheck,
  獲利能力: PieChart,
  成長動能: TrendCharts,
  財務韌性: Lock,
  市場評價: Money,
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
  // Set only on the 3 Piotroski F-Score sub-badges (see PIOTROSKI_*_BADGE below) — marks that
  // this badge's score does NOT come from the generic
  // fieldId->useGuruBadgeScores pipeline every other badge uses, but from
  // usePiotroskiBreakdown()'s own `groups` object instead. StockGuruBadgeCategoryCard.vue's own
  // scoreFor() branches on this field; threshold.numerator is a stub (`() => null`) for these
  // three and is never actually called.
  piotroskiGroup?: 'profitability' | 'leverageLiquidity' | 'operatingEfficiency'
}

// Source-link lookup, replacing this file's own former hardcoded `sourceUrl` field (added
// 2026-09-10, removed the same day) — per direct request ("後端有給 referenceUrl，你前端忠實
// 呈現就好。不然這樣我管理起來要兩邊跑"), bff-ts wired GET /metrics' own `referenceUrl` field
// through the same day (commit 71572ca, same treatment as formulaLatex), so this is now read
// live off the shared schema instead of maintained twice. A badge's own `fieldId` is
// `${metricKey}.${fieldKey}`, so locateFieldInSchema (already exported by useFilterSchema.ts)
// finds the right metric directly — no separate lookup helper needed here.
// Prefers academicSourceUrl (the original paper) over referenceUrl (a general-reader
// explanation) per direct request 2026-09-10 ("徽章彈窗 有 academicSourceUrl 就用 沒有的話
// referenceUrl 才當備案") — see useFilterSchema.ts's own comment on the two fields' distinct
// purposes. Falls through to referenceUrl whenever academicSourceUrl is null/absent (most
// metrics — analysis-ts only set it on 13 curated badge methodologies), not an either/or choice
// callers have to make themselves.
export function guruBadgeSourceUrl(categories: FilterCategory[], badge: GuruBadge): string | null {
  const metric = locateFieldInSchema(categories, badge.fieldId)?.metric
  return metric?.academicSourceUrl ?? metric?.referenceUrl ?? null
}

// "數字可回溯到原始申報資料" pilot (2026-09-10 plan) — analysis-ts's new
// GET /companies/:symbol/metric-provenance is zod-validated against exactly these 3 metricCodes
// server-side (a clean 400 on anything else, not a silent fallback), so the frontend mirrors
// that same explicit allowlist rather than trying every badge and eating a 404 — matches the
// "avoid a second dependsOn-style field that's broad but unmaintained" discipline both sides
// agreed on. `piotroskiFScore`, `graham`, etc. are deliberately NOT here; only add a metricCode
// once analysis-ts has actually shipped a resolver for it (their own 3-file-change discipline).
export const PROVENANCE_PILOT_METRIC_CODES = new Set(['sue', 'chowderNumber', 'roe'])

// A badge's fieldId is `${metricKey}.${fieldKey}` (e.g. "sue.Q", "chowderNumber.FY") —
// metric-provenance's own `metricCode` param is exactly that leading metricKey segment.
export function guruBadgeMetricCode(badge: GuruBadge): string {
  return badge.fieldId.split('.')[0]!
}

export function guruBadgeHasProvenance(badge: GuruBadge): boolean {
  return PROVENANCE_PILOT_METRIC_CODES.has(guruBadgeMetricCode(badge))
}

// Piotroski F-Score SPLIT into 3 separate badges 2026-09-10, one per the paper's own signal
// grouping — per direct request ("Piotroski F-Score 徽章跟 analysis 喬一下要怎麼拿到9個指標
// 列表顯示" then "Piotroski F-Score 會出現在三個區域" / "我要把她一拆為三"). Was one 9-point
// 獲利品質 badge; analysis-ts already computed all 9 individual pass/fail signals internally the
// whole time but only ever persisted the summed total (confirmed by reading
// computePiotroskiFScorePit.ts directly) — asked them to expose the 9 signals, and they shipped
// GET /companies/piotroski-breakdown (bff-ts proxy: GET /stocks/:symbol/piotroski-breakdown,
// commit dd5ea92), grouped exactly per the original 2000 paper's own structure: profitability
// (4 signals), leverage/liquidity/source-of-funds (3 signals), operating efficiency (2 signals).
// See usePiotroskiBreakdown.ts's own comment for the real response shape.
//
// These 3 remain the ONE hardcoded exception to the 2026-09-10 backend-badge migration (see this
// file's own comment further below) — not because their threshold logic doesn't fit the
// declarative comparator vocabulary (it does: each is just "count of true signals in this
// group"), but because their DATA doesn't come from the generic fieldId pipeline at all — see
// GuruBadge's own `piotroskiGroup` field and StockGuruBadgeCategoryCard.vue's scoreFor() branch.
//
// Known trade-off: Piotroski's own paper only defines pass/fail buckets for the FULL 9-point
// total (8-9 = top quality), not for these 3 sub-groups individually — there's no literature-
// sourced bar to reuse for "達標" at the sub-group level. Rather than invent one, `isMet` is left
// at its default (numerator === denominator, i.e. every signal in that group must pass) — the
// same "don't publish a number that isn't really sourced" discipline already applied elsewhere
// (see the Nissim-Penman RNOA/SGR/Cash Conversion Cycle removal history in git blame).
//
// All 3 share the same fieldId ('piotroskiFScore.Q') deliberately — they're 3 facets of the same
// underlying methodology/paper, so the formula and source link (via locateFieldInSchema) should
// show the same thing for all three, not three different (nonexistent) sub-formulas.
//
// The per-signal Chinese labels used to live here as a hardcoded PIOTROSKI_SIGNAL_LABELS lookup
// table (key -> label) — removed 2026-09-11 per direct request ("多語系 跟 資料 都歸後端"): the
// raw signal keys/booleans already come live from GET /stocks/:symbol/piotroski-breakdown, only
// their display text was hand-maintained separately here. analysis-ts now ships each signal's
// own label directly in that response's own `signalLabels` field (see usePiotroskiBreakdown.ts's
// own comment) — piotroskiSignals() in StockGuruBadgeCategoryCard.vue falls back to the raw key
// itself only for the brief window before that data has loaded, never a hardcoded translation.
const PIOTROSKI_FIELD_ID = 'piotroskiFScore.Q'
// Never actually called — StockGuruBadgeCategoryCard.vue's scoreFor() intercepts these 3 badges
// via `piotroskiGroup` before threshold.numerator would ever run. Present only because
// GuruBadgeThreshold.numerator is a required field on the shared interface.
const PIOTROSKI_NUMERATOR_STUB = () => null

// `name` on all 3 badges is plain "Piotroski F-Score", NOT "Piotroski F-Score｜獲利能力" (etc.)
// — per direct request ("請勿顯示 Piotroski F-Score｜獲利能力 這種無效雜訊 Piotroski F-Score
// 就是 Piotroski F-Score"). Every place this name renders (the chip, the dialog title) already
// sits inside its own category-labeled card/section, so baking the category into the name a
// second time was pure duplication, not disambiguation — the 3 badges are still distinguishable
// where it actually matters, via `nameEn` in the dialog's own byline (see hasDistinctNameEn()).
//
// name/author/nameEn/summary/detail/denominator ALL now come from the live breakdown response's
// own `groupMetadata` (analysis-ts shipped it 2026-09-11) — nothing left hand-maintained here
// except the structural mapping (which category tab each group belongs to, which piotroskiGroup
// key it reads) and the threshold's own numerator stub, both of which are this app's own UI/IA
// decisions, not domain content. Two earlier, narrower attempts at this were tried and reverted
// same-day (see git history) before the user made the actual reason explicit: i18n. Any hardcoded
// Chinese string here is a string that can't be translated without a code deploy — once that's
// the bar, "is this technically re-derivable data or our own UI choice" stopped being the right
// question; every piece of user-facing text needs a backend home, full stop.
//
// `author` is read from piotroskiFScore's own `badge.author` (GET /metrics), not groupMetadata —
// analysis-ts modeled groupMetadata as Piotroski-specific fields on the breakdown endpoint, which
// has no `author` field of its own (author doesn't vary by sub-group, so it stays on the
// aggregate metric's own badge object instead of being repeated 3 times in groupMetadata).
//
// `denominator`/`name`/`nameEn`/`summary`/`detail` are left as empty/0 defaults (never a
// hardcoded Chinese fallback) for the brief window before groupMetadata has loaded — matching
// this app's own "don't invent text that isn't real" rule everywhere else (e.g. GuruIndicatorRow
// .vue's "尚未提供" formula placeholder, not a guessed formula).
function piotroskiGroupMeta(groupMetadata: PiotroskiGroupMetadata[] | undefined, key: PiotroskiGroupMetadata['key']): PiotroskiGroupMetadata {
  return (
    groupMetadata?.find(entry => entry.key === key) ?? {
      key,
      name: '',
      nameEn: '',
      summary: '',
      detail: '',
      denominator: 0
    }
  )
}

function buildPiotroskiBadges(categories: FilterCategory[], groupMetadata: PiotroskiGroupMetadata[] | undefined): GuruBadge[] {
  const author = locateFieldInSchema(categories, PIOTROSKI_FIELD_ID)?.metric.badge?.author ?? ''
  const specs: { id: string; category: GuruBadgeCategory; group: GuruBadge['piotroskiGroup'] & string }[] = [
    { id: 'piotroski-profitability', category: '獲利能力', group: 'profitability' },
    { id: 'piotroski-leverage-liquidity', category: '財務韌性', group: 'leverageLiquidity' },
    { id: 'piotroski-operating-efficiency', category: '營運周轉', group: 'operatingEfficiency' }
  ]
  return specs.map(spec => {
    const meta = piotroskiGroupMeta(groupMetadata, spec.group)
    return {
      id: spec.id,
      name: 'Piotroski F-Score',
      nameEn: meta.nameEn,
      author,
      category: spec.category,
      fieldId: PIOTROSKI_FIELD_ID,
      piotroskiGroup: spec.group,
      summary: meta.summary,
      detail: meta.detail,
      threshold: {
        description: meta.summary,
        denominator: meta.denominator,
        numerator: PIOTROSKI_NUMERATOR_STUB
      }
    }
  })
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

// Builds the full, current badge list from a live GET /metrics response — the 3 Piotroski
// sub-badges first (built from `piotroskiGroupMetadata`, see buildPiotroskiBadges' own comment
// above for where that comes from), then every other metric across every category that has a
// real `badge` field. Every real consumer already has `categories` on hand from its own
// `await useFilterSchema()` call (see feedback_useasyncdata_shared_key_race memory for why that
// await matters), so this takes it as a plain argument rather than fetching again.
export function buildGuruBadges(categories: FilterCategory[], piotroskiGroupMetadata?: PiotroskiGroupMetadata[]): GuruBadge[] {
  const badges: GuruBadge[] = buildPiotroskiBadges(categories, piotroskiGroupMetadata)
  for (const backendCategory of categories) {
    const displayCategory = METRIC_CATEGORY_KEY_TO_DISPLAY[backendCategory.key]
    if (!displayCategory) continue
    for (const metric of backendCategory.metrics) {
      // Real bug fixed 2026-09-11 (caught live while verifying groupMetadata): piotroskiFScore
      // now has a real `badge` field on GET /metrics too (analysis-ts populated it for the
      // author lookup above), so this generic loop started ALSO turning it into a 4th, duplicate
      // aggregate "Piotroski F-Score" badge (denominator 9, sitting in 獲利品質) right alongside
      // our own 3 intentional split sub-badges — visible live as an extra card showing the old
      // whole-9-signal description instead of one of the 3 groups. This metric is deliberately
      // handled ONLY through buildPiotroskiBadges() above; skip it here so its `badge` field
      // never flows through the generic single-badge path too.
      if (metric.key === 'piotroskiFScore') continue
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
export function guruBadgesByCategory(categories: FilterCategory[], piotroskiGroupMetadata?: PiotroskiGroupMetadata[]): Partial<Record<GuruBadgeCategory, GuruBadge[]>> {
  const map: Partial<Record<GuruBadgeCategory, GuruBadge[]>> = {}
  for (const badge of buildGuruBadges(categories, piotroskiGroupMetadata)) {
    const list = map[badge.category] ?? (map[badge.category] = [])
    list.push(badge)
  }
  return map
}
