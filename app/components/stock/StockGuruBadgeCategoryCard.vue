<script setup lang="ts">
import { Trophy, TrophyBase, QuestionFilled, TopRight, Right, Close } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER, guruBadgeHasProvenance, guruBadgeMetricCode, guruBadgeSourceUrl, guruBadgesByCategory } from '~/utils/guru-badges'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import type { MetricProvenanceEntry } from '~/composables/stock/useMetricProvenance'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'
import type { StockBadgeEntry } from '~/composables/stock/useStockBadges'

// Per direct request ("徽章系統改為每個面向 比如股東回饋 都有自己的專門用來呈現徽章的卡片") —
// replaces StockGuruBadgeCard.vue's single standalone multi-tile grid (which used to sit above
// every category tab, gated on isVisible('guru-badges')) with one dedicated card per category,
// living INSIDE that category's own tab alongside its other cards (design confirmed directly:
// per-category placement, keep the existing "score fraction tile → click for dialog detail"
// presentation since each card is now already scoped to a single category).
//
// Renders nothing at all (not even an empty-state card) when this category has zero real
// badges — same "scales back up automatically the moment a real methodology exists" philosophy
// the old card already had; a category with no badge shouldn't show an empty trophy card taking
// up a grid slot.
//
// Corrected live 2026-09-10 twice in a row: (1) "卡片呈現的徽章不會只有一個，他是攤平的。會有
// 好多個一字排開。" — a category can hold more than one badge (e.g. 獲利能力), and the original
// single aggregate tile (one medal, one fraction, everything else hidden behind a click)
// collapsed all of them into one number. Now every badge in the category gets its own flattened
// chip laid out in a row directly on the card face; the category fraction stays as a small
// subtitle for a quick overview. (2) "小徽章點開的時候，只呈現他自己的資訊就好。" — the dialog
// used to still list every badge in the category regardless of which chip was clicked; now it
// shows only the one badge that was clicked. (3) "徽章卡片要分上下兩半。上面是有達成的，下面是
// 沒達成的。" — the chip row used to be one flat, unordered list; now it's split into a 已達成
// section and a 未達成 section (data-insufficient badges count as 未達成 too, since they aren't
// a confirmed pass), each only rendered when it actually has a badge in it. (4) "整個徽章卡片外
// 面的呈現要重新設計。要從外面就看出分數...點進去裡面才呈現細節。" — chips used to show only the
// badge name, the actual score was hidden behind a click; every chip now also shows its own
// score directly (see chipScoreText()'s own comment for the fraction-vs-raw-value distinction).
//
// Formula display added 2026-09-10 per direct request ("小徽章點開要可以呈現算式，而這個算式會
// 從後端傳來，由後端維護。就是那個MathJson格式。") — confirmed live via GET /filters that the
// real field analysis-ts actually ships is `formulaLatex` (a LaTeX string), not MathJson; this
// is the exact same field/pilot MoleculeIndicatorPickerBody.vue already renders with KaTeX (see
// FilterMetric's own comment — only roe/peRatio/sue/chowderNumber have a real value so far,
// everything else is null and simply shows no formula). Reuses useFilterSchema() (already
// cached app-wide) rather than adding a second network call — a badge's own `fieldId` is
// `${metricKey}.${fieldKey}` (e.g. "sue.Q"), so the metric key is just the part before the dot.
const props = defineProps<{
  symbol: string
  category: GuruBadgeCategory
}>()

const symbolRef = computed(() => props.symbol)
// Per-category color dropped from badge rendering 2026-09-10 (see GuruBadgeCard.vue's own
// comment) — this card is already scoped to a single category via its own header, so the
// 8-color palette on medals/chip borders/dialog accents was pure noise; one shared theme accent
// instead.
const categoryColor = 'var(--el-color-primary)'

// Real bug found live 2026-09-10 while verifying this: an un-awaited `useFilterSchema()` call
// let SSR serialize the page before the real fetch resolved, baking the MOCK_FILTER_SCHEMA
// fallback into the payload — client hydration's own getCachedData then reused that cached mock
// forever and never refetched (by design, see useFilterSchema.ts's own comment on why it skips
// re-fetching once cached). screener.vue's own `await useFilterSchema()` doesn't have this
// problem; matching that here (Vue's Suspense-integrated async setup waits on nested components
// too, not just the page root) fixes it the same way. Moved to the top of setup 2026-09-10 (was
// previously declared further down) once `badges` itself also needed the fetched schema — see
// buildGuruBadges()'s own comment in guru-badges.ts for the 2026-09-10 backend migration.
const { data: filterSchema } = await useFilterSchema()

// Fetched unconditionally (not swapped in only when this category actually has a Piotroski
// sub-badge) — usePiotroskiBreakdown.ts's own cache is keyed by symbol only, so the 3 category
// cards that DO have one (獲利能力/財務韌性/營運周轉) all share the same cached response rather
// than each firing their own request. Moved above badgesByCategory 2026-09-11 once
// buildGuruBadges() itself also needed this data — its own `groupMetadata` is now the ONLY
// source for the 3 Piotroski sub-badges' name/summary/detail/denominator (see guru-badges.ts's
// own buildPiotroskiBadges() comment), not just something scoreFor() reads afterward.
const { data: piotroskiBreakdown } = usePiotroskiBreakdown(symbolRef)

const badgesByCategory = computed(() => guruBadgesByCategory(filterSchema.value?.categories ?? [], piotroskiBreakdown.value?.groupMetadata))
const badges = computed<GuruBadge[]>(() => badgesByCategory.value[props.category] ?? [])
const hasBadges = computed(() => badges.value.length > 0)

// Migrated 2026-09-14 off client-side threshold comparison (used to fetch each badge's raw value
// via useGuruBadgeScores/POST-screener-values and compare it against GET /metrics' own threshold
// itself) to analysis-ts's new GET /stocks/:symbol/badges (bff-ts proxy, see useStockBadges.ts's
// own comment) — that endpoint now computes `passed`/`value`/`nullReason` server-side per badge,
// analysis-ts's own fix for real comparator/null-handling bugs the old homegrown logic had. Does
// NOT cover the 3 Piotroski sub-badges (confirmed live), which keep reading
// usePiotroskiBreakdown()'s own `groups` object, unchanged by this migration.
const { data: stockBadges, pending } = useStockBadges(symbolRef)

function entryFor(badge: GuruBadge): StockBadgeEntry | null {
  if (badge.piotroskiGroup) return null
  return findStockBadgeEntry(stockBadges.value, guruBadgeMetricCode(badge))
}

function unitFor(badge: GuruBadge): string {
  return locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)?.metric.unit ?? ''
}

// Real bug avoided 2026-09-10 while splitting Piotroski into 3 badges: this used to unconditionally
// read `badge.fieldId` through the generic scores pipeline — the 3 Piotroski sub-badges share one
// fieldId ('piotroskiFScore.Q') purely for formula/source-link lookup purposes (see
// guru-badges.ts's own comment), NOT for scoring, so scoring them the normal way would have
// silently given all 3 the exact same (wrong) numerator. `piotroskiGroup` branches to
// usePiotroskiBreakdown's own `groups` object instead — same "any missing signal nulls the whole
// group" rule the breakdown endpoint itself uses for its own `totalScore` (bff-ts's own note:
// don't infer a partial score from a mix of knowns and nulls).
function piotroskiGroupScore(group: 'profitability' | 'leverageLiquidity' | 'operatingEfficiency'): {
  numerator: number | null
  denominator: number
} {
  const signals = piotroskiBreakdown.value?.groups?.[group]
  if (!signals) return { numerator: null, denominator: 0 }
  const entries = Object.values(signals)
  const denominator = entries.length
  if (entries.some(value => value === null)) return { numerator: null, denominator }
  return { numerator: entries.filter(value => value === true).length, denominator }
}

// null = insufficient real data to evaluate (e.g. Graham Number/NCAV without a stock price) —
// never coerced to 0/false, which would misrepresent "we don't know" as "this one failed."
// Migrated 2026-09-14: for every non-Piotroski badge, this is now just the backend's own
// `passed` field (see useStockBadges.ts) — no client-side comparison left to do.
function isMet(badge: GuruBadge): boolean | null {
  if (badge.piotroskiGroup) {
    const score = piotroskiGroupScore(badge.piotroskiGroup)
    return score.numerator === null ? null : score.numerator === score.denominator
  }
  return entryFor(badge)?.passed ?? null
}

function formatFraction(badge: GuruBadge): string {
  if (!badge.piotroskiGroup) return isMet(badge) === null ? '資料不足' : isMet(badge) ? '1/1' : '0/1'
  const score = piotroskiGroupScore(badge.piotroskiGroup)
  if (score.numerator === null) return '資料不足'
  return `${score.numerator}/${score.denominator}`
}

// Card-level fraction: how many of this category's badges meet their own standard, out of how
// many were evaluable — badges with insufficient data are excluded from the denominator too,
// same "never count a missing number as a failure" reasoning as scoreFor()'s own null handling.
const categoryFraction = computed(() => {
  let met = 0
  let evaluated = 0
  for (const badge of badges.value) {
    const result = isMet(badge)
    if (result === null) continue
    evaluated += 1
    if (result) met += 1
  }
  return evaluated === 0 ? '資料不足' : `${met}/${evaluated}`
})

// Publishes this same fraction to stock/[code].vue's own tab label 2026-09-14 (reported live:
// "Tab 右邊要顯示徽章達成的數字 比如 2/3") — see useGuruBadgeCategoryFractions.ts's own comment
// for why this is a shared-state push rather than the tab label recomputing/re-fetching the same
// thing itself. Only ever writes a real "N/M" fraction, never the '資料不足' placeholder — a tab
// label showing that string for every category with insufficient data would be noisy, and this
// composable's own contract is "no entry = nothing to show," not "entry can be a non-fraction
// string." Cleared on unmount so a category that stops rendering (e.g. 顯示設定 hides it) doesn't
// leave a stale fraction behind for its tab label to keep reading.
const categoryFractions = useGuruBadgeCategoryFractions()
watchEffect(() => {
  categoryFractions.value[props.category] = hasBadges.value && categoryFraction.value !== '資料不足' ? categoryFraction.value : undefined
})
onBeforeUnmount(() => {
  categoryFractions.value[props.category] = undefined
})

// formatSignificantDigits moved to app/utils/format-significant-digits.ts 2026-09-11 (Nuxt
// auto-import, no explicit import needed) once OrganismResultTable.vue's screener 市值 column
// needed the exact same behavior — see that file's own comment for the full history/reasoning.
// `nullReason` now comes straight from GET /stocks/:symbol/badges per badge (migrated 2026-09-14)
// — same "不適用" (industry-exclusion) vs generic "尚無資料" distinction as before, just read
// directly off the new endpoint's own field instead of a side-channel POST /screener/values call.
function formatRawValue(badge: GuruBadge): string {
  const entry = entryFor(badge)
  const value = entry?.value ?? null
  if (value === null) return entry?.nullReason === 'not_applicable_industry' ? '不適用' : '尚無資料'
  return `${formatSignificantDigits(value, 3)}${unitFor(badge)}`
}

// Added 2026-09-10 per direct request ("整個徽章卡片外面的呈現要重新設計。要從外面就看出分數
// 比如 達標 F-score 8/9。未達標 Graham Number 693。點進去裡面才呈現細節。") — chips used to
// show only the badge name, the actual score was hidden behind a click. The 3 Piotroski sub-
// badges (a genuine multi-point checklist within their own group) read naturally as a fraction;
// every other badge here is a single pass/fail comparison against one real number (denominator
// 1), where a "0/1"/"1/1" fraction says less than just showing that number itself — same
// distinction the user's own two examples draw (F-Score gets a fraction, Graham Number gets its
// raw value).
//
// Real bug fixed 2026-09-11: this used to branch on `badge.threshold.denominator > 1` — broke
// the moment a Piotroski sub-badge's denominator became a genuinely-0 loading-state placeholder
// (groupMetadata not fetched yet, see guru-badges.ts's own piotroskiGroupMeta()): `0 > 1` is
// false, so it silently fell through to formatRawValue(), which then resolved a real-looking but
// WRONG number — piotroskiFScore.Q's own generic-pipeline value (the whole 9-point aggregate
// score) instead of this group's own tally, mislabeled under a group-specific badge. Branches on
// `badge.piotroskiGroup` directly instead — a structural, always-true-for-these-3-badges
// property, not a data value that can transiently be a loading-state placeholder.
function chipScoreText(badge: GuruBadge): string {
  return badge.piotroskiGroup || badge.threshold.denominator > 1 ? formatFraction(badge) : formatRawValue(badge)
}

// GET /stocks/:symbol/badges gained knowledgeDate/knowledgeDateIsFallback the same day this
// migration shipped (2026-09-14, once flagged as a gap — briefly returned null for every non-
// Piotroski badge in between). Piotroski keeps its own knowledgeDate from
// usePiotroskiBreakdown(), unaffected by this endpoint.
function knowledgeDateFor(badge: GuruBadge): string | null {
  if (badge.piotroskiGroup) return piotroskiBreakdown.value?.knowledgeDate ?? null
  return entryFor(badge)?.knowledgeDate ?? null
}

// Dialog content for the 3 Piotroski sub-badges replaces the usual "目前數值" line (there's no
// single raw value to show for a group of booleans) with a checklist of each individual signal —
// genuinely more informative than a bare fraction, and the whole reason this split exists (see
// guru-badges.ts's own comment: "要從外面就看出分數...點進去裡面才呈現細節"). Returns null for
// every other badge, which the template uses to decide which content to render.
//
// Labels come from the breakdown response's own `signalLabels` (requested from analysis-ts
// 2026-09-11, "多語系 跟 資料 都歸後端" — see usePiotroskiBreakdown.ts's own comment) instead of
// a hardcoded lookup table this file used to carry. Falls back to the bare key itself
// (e.g. "positiveRoa") until they ship it — not a hardcoded Chinese translation, since that's
// exactly the duplication this change was meant to remove.
function piotroskiSignals(badge: GuruBadge): { label: string; met: boolean | null }[] | null {
  if (!badge.piotroskiGroup) return null
  const signals = piotroskiBreakdown.value?.groups?.[badge.piotroskiGroup]
  if (!signals) return []
  const labels = piotroskiBreakdown.value?.signalLabels
  return Object.entries(signals).map(([key, met]) => ({ label: labels?.[key] ?? key, met }))
}

// Flattened back into ONE list 2026-09-14 ("個股瀏覽徽章列拿掉卡片，但是保留徽章，不再呈現已
// 達成未達成文字") — undoes the 2026-09-10 已達成/未達成 two-section split (see this file's own
// git history for that change) now that the outer card container is gone too; met/unmet/unknown
// still reads at a glance from each chip's own shape (filled/hollow/dashed medal, see the
// __chip-medal rules below), so a text section header was redundant with that visual distinction
// once it wasn't also doing the job of grouping two halves of a card.
const sortedBadges = computed(() => [...badges.value].sort((a, b) => Number(isMet(b) === true) - Number(isMet(a) === true)))

const selectedBadge = ref<GuruBadge | null>(null)

// Toggles an IN-CARD expand section right below the chip grid — replaces the old el-dialog
// 2026-09-15 per 卡片軌元件選型規範 2.4.4 ("嚴禁使用彈窗...同一頁面允許多個卡片展開層同時開啟，
// 不強制互斥收合"): a modal can only ever show one badge's detail at a time across the WHOLE
// page and forces the user to close it before looking at anything else, which breaks the
// "compare several indicators side by side" flow that section's own reasoning calls out.
// Clicking the currently-open badge's own chip again collapses it (toggle, not just open).
function openBadge(badge: GuruBadge): void {
  selectedBadge.value = selectedBadge.value?.id === badge.id ? null : badge
  provenanceOpen.value = false
}

// "數字可回溯到原始申報資料" pilot (2026-09-10 plan) — guruBadgeHasProvenance() now reads
// FilterMetric.hasProvenance directly off the live schema (see that field's own comment; no
// longer a hardcoded frontend allowlist as of 2026-09-14), so `selectedMetricCode` stays null for
// whichever badges the metric-provenance endpoint doesn't cover yet and useMetricProvenance
// simply never fires a request for those — no "查看計算依據" section renders at all rather than a
// section that always 404s.
const selectedMetricCode = computed(() => (selectedBadge.value && guruBadgeHasProvenance(selectedBadge.value) ? guruBadgeMetricCode(selectedBadge.value) : null))
const { data: provenance } = useMetricProvenance(symbolRef, selectedMetricCode)
const provenanceOpen = ref(false)

// `raw` isn't guaranteed to be a string — bff-ts confirmed live that most entries are
// bigint-serialized strings but at least one (chowderNumber's market-snapshot entry) is a plain
// float — Number() handles both uniformly, only the display formatting needs to branch.
// Real bug fixed 2026-09-11 (reported live: "台積電市值跑版了，希望有效數字控制在4位數或以下就
// 好") — this used to be a plain toLocaleString('zh-TW'), which rendered a market-cap snapshot
// like 62,108,026,310,465 in full, un-abbreviated (14 raw digits + separators) inside the
// provenance list's own fixed-width row. Reuses formatSignificantDigits (already established
// for the exact same "large statement figure overflowing a small chip/row" problem on the badge
// chips themselves) instead of inventing a second rounding scheme — 4 significant figures per
// this request (chips use 3; provenance detail rows have a bit more room and benefit from the
// extra digit of precision when tracing a real number back to its filing).
function formatProvenanceValue(raw: string | number): string {
  const value = Number(raw)
  return Number.isFinite(value) ? formatSignificantDigits(value, 4) : String(raw)
}

// Jumps into 會計模式 at the exact period/row this entry came from (useStatementRowFocus.ts's
// own jumpToStatementRow, built ahead of this exact caller — see that file's own comment).
// `other`-typed entries (market price, share-count filings) have no statement row to jump to,
// so they render as plain text in the template instead of calling this at all. Collapses the
// in-card expand first since the jump navigates the whole page away from "looking at a badge"
// into "looking at the raw statement" — leaving it open on top of that would just cover it.
function openProvenanceEntry(entry: MetricProvenanceEntry): void {
  if (entry.type !== 'statementField' || !entry.statementType || !entry.fieldKey) return
  selectedBadge.value = null
  jumpToStatementRow({
    statementType: entry.statementType,
    rowKey: entry.fieldKey,
    year: entry.fiscalYear,
    quarter: entry.fiscalQuarter as StockQuarter
  })
}

// Simplified 2026-09-10 to reuse locateFieldInSchema/renderFormulaHtml (see GuruBadgeCard.vue's
// own comment) instead of a hand-rolled metric lookup + a second direct katex import — same
// logic, one fewer place carrying its own copy of it.
function formulaHtml(badge: GuruBadge): string | null {
  const location = locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)
  return renderFormulaHtml(location?.metric.formulaLatex, true)
}

// Data-provenance category tags, added 2026-09-10 alongside GuruBadgeCard.vue's own identical
// change (see that file's own comment) — same schema lookup formulaHtml() already does above.
function metricSources(badge: GuruBadge): string[] | undefined {
  return locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)?.metric.sources
}

// Added 2026-09-10 alongside GuruBadgeCard.vue's own identical change — GET /metrics' own
// `referenceUrl` field (bff-ts commit 71572ca), read live instead of hand-maintained per badge.
function sourceUrl(badge: GuruBadge): string | null {
  return guruBadgeSourceUrl(filterSchema.value?.categories ?? [], badge)
}

// Several badges have no separate Chinese name — nameEn is set to the exact same string as name
// in guru-badges.ts. Same "don't show pure visual duplication" rule as GuruBadgeCard.vue's own.
function hasDistinctNameEn(badge: GuruBadge): boolean {
  return badge.nameEn !== badge.name
}
</script>

<template>
  <!-- Card container REMOVED 2026-09-14 ("個股瀏覽徽章列拿掉卡片，但是保留徽章，不再呈現已達成
       未達成文字。一樣用GRID呈現在其他卡片上面。只是把容器拿掉，用來降低認知負荷") — this used
       to be its own el-card (still spanning both grid columns via [code].vue's own
       .stock-detail-page__grid-badge, unchanged); now a plain div so the badge chips sit directly
       in that same grid slot with no card chrome (border/shadow/padding) around them. The
       category/fraction head and the chip grid below are otherwise unchanged in substance — only
       the 已達成/未達成 section split lost its text headers (see sortedBadges' own script-side
       comment) and everything is now ONE flat grid instead of two side-by-side ones. -->
  <div v-if="hasBadges" v-loading="pending" class="guru-badge-category-card">
    <!-- Fraction moved right after the Chinese label 2026-09-14 (reported live: "徽章grid 右上角
         不是有 數字嗎 1/2 之類的。請放到 中文字後面 這樣用戶比較直觀可以閱讀") — used to sit at
         the row's far right via justify-content: space-between, reading as a separate, unrelated
         number floating on its own; inline right after "{{ category }}徽章" reads as one
         sentence ("市場評價徽章 0/3") instead of two disconnected pieces of text. -->
    <p class="guru-badge-category-card__head">
      {{ category }}徽章
      <span class="guru-badge-category-card__fraction">{{ categoryFraction }}</span>
    </p>

    <div class="guru-badge-category-card__row">
      <button
        v-for="badge in sortedBadges"
        :key="badge.id"
        type="button"
        class="guru-badge-category-card__chip"
        :class="{ 'is-met': isMet(badge) === true, 'is-unmet': isMet(badge) === false, 'is-unknown': isMet(badge) === null }"
        @click="openBadge(badge)"
      >
        <span class="guru-badge-category-card__chip-medal" :style="isMet(badge) === true ? { background: categoryColor } : undefined">
          <el-icon><component :is="isMet(badge) === null ? QuestionFilled : isMet(badge) === true ? Trophy : TrophyBase" /></el-icon>
        </span>
        <span class="guru-badge-category-card__chip-name" :title="badge.name">{{ badge.name }}</span>
        <span class="guru-badge-category-card__chip-score">{{ chipScoreText(badge) }}</span>
      </button>
    </div>

    <!-- Redesigned 2026-09-10 alongside GuruBadgeCard.vue's own identical redesign (see that
         file's own comment) — same visual language: byline moved into the #header slot, the
         threshold/value/formula grouped into one tinted criteria card instead of three floating
         lines. sourceUrl link is new here too (this dialog never had one before). Border added
         the same day (real dark-mode contrast bug, see GuruBadgeCard.vue's own comment for the
         measured rgb values), and the fraction now renders as its own met/unmet-colored pill
         (reusing the chip colors above) instead of plain text, so the pass/fail result reads at
         a glance instead of requiring the full sentence. Visual weight also rebalanced per
         direct follow-up ("希望視覺重點放在公式就好，門檻描述不跟他一樣權重") — formula is now
         the card's actual focal point, threshold text and the current-value line both stepped
         back to plain body weight.

         Used to also carry a category-color left accent (set via inline :style, not
         `v-bind(categoryColor)` — same Teleport/append-to-body bug as GuruBadgeCard.vue's own
         identical fix, see that file's own comment). Removed 2026-09-10 alongside that same file
         once categoryColor became one shared theme color for every badge — an accent stripe
         that's identical on every card no longer distinguishes anything. -->
    <!-- IN-CARD expand — replaces the old el-dialog 2026-09-15 per 卡片軌元件選型規範 2.4.4, see
         openBadge()'s own script-side comment for why. Renders directly below the chip grid,
         inside this same card, instead of a modal — other cards' own expand states (this
         component's own OR any other card on the page) are completely unaffected by this one
         opening/closing. -->
    <div v-if="selectedBadge" class="guru-badge-category-card__detail">
      <div class="guru-badge-category-card__dialog-title-row">
        <div>
          <p class="guru-badge-category-card__dialog-title">{{ selectedBadge.name }}</p>
          <p class="guru-badge-category-card__dialog-byline">
            <span><template v-if="hasDistinctNameEn(selectedBadge)">{{ selectedBadge.nameEn }}｜</template>{{ selectedBadge.author }}</span>
            <a
              v-if="sourceUrl(selectedBadge)"
              :href="sourceUrl(selectedBadge)"
              target="_blank"
              rel="noopener noreferrer"
              class="guru-badge-category-card__dialog-source-link"
            >
              查看公式出處
              <el-icon><TopRight /></el-icon>
            </a>
          </p>
        </div>
        <button type="button" class="guru-badge-category-card__detail-close" aria-label="收合徽章詳情" @click="selectedBadge = null">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <div class="guru-badge-category-card__criteria-card">
        <p class="guru-badge-category-card__criteria-label">比較標準</p>
        <p class="guru-badge-category-card__criteria-value">{{ selectedBadge.threshold.description }}</p>
        <!-- The fraction pill that used to live here ("符合 X/Y 項") was removed entirely
             2026-09-10 per direct follow-up ("符合 1/1 項 這個在彈窗刪掉。從外面卡片的已達成
             未達成 就已經看出來了，這是重複資訊。") — the outer card already sorts every badge
             into a 已達成/未達成 section before this dialog ever opens, so repeating the same
             pass/fail result again in here (after the raw value and date were already moved out
             for the same reason, see the git history on this block) was the last piece of
             duplicated information left. This card now goes straight from the criterion's own
             description to whatever's actually new information — the Piotroski signal checklist
             or the formula. -->
        <!-- Added 2026-09-10 alongside the Piotroski 3-way split (see guru-badges.ts's own
             comment) — the whole reason for splitting this badge out was to surface the
             individual signals instead of hiding them behind one aggregate number, so this list
             is the actual payoff: each of the group's own booleans, not just their sum. -->
        <ul v-if="piotroskiSignals(selectedBadge)" class="guru-badge-category-card__signal-list">
          <li v-for="signal in piotroskiSignals(selectedBadge)" :key="signal.label" class="guru-badge-category-card__signal">
            <span
              class="guru-badge-category-card__signal-mark"
              :class="{ 'is-met': signal.met === true, 'is-unmet': signal.met === false, 'is-unknown': signal.met === null }"
            >
              {{ signal.met === true ? '✓' : signal.met === false ? '✗' : '—' }}
            </span>
            {{ signal.label }}
          </li>
        </ul>
        <div v-if="formulaHtml(selectedBadge)" class="guru-badge-category-card__criteria-formula" v-html="formulaHtml(selectedBadge)" />
      </div>

      <p v-if="selectedBadge" class="guru-badge-category-card__list-detail">{{ selectedBadge.detail }}</p>

      <!-- Data-provenance line, added 2026-09-10 per direct request, moved to the bottom of the
           dialog the same day per direct follow-up ("sources 要放在 徽章彈窗的下面") — same
           reasoning as GuruBadgeCard.vue's own identical move (see that file's own comment):
           originally lived inside the criteria-card next to the threshold, competing with the
           formula for the card's own visual focal point. Plain comma-joined text, not el-tag
           chips, per same-day follow-up ("sources 不要裝飾"). -->
      <!-- Hidden 2026-09-15 per直接要求（"卡片上的 資料來源 都先幫我隱藏吧"）— same temporary,
           easy-to-revert intent as SharedDataFreshnessNote.vue's own SHOW_DATA_SOURCE. Hidden via
           CSS (a `hidden` class), not by touching the v-if condition — wrapping/`&&`-ing the
           condition both broke vue-tsc's type narrowing on selectedBadge here (confirmed live,
           real "possibly null" typecheck errors either way, see GuruBadgeCard.vue's own identical
           fix/comment), so the v-if stays exactly as it was and only the visual display changes. -->
      <p v-if="selectedBadge && metricSources(selectedBadge)" class="guru-badge-category-card__sources guru-badge-category-card__sources--hidden">
        資料來源：{{ metricSources(selectedBadge)!.join('、') }}
      </p>

      <!-- "數字可回溯到原始申報資料" pilot (2026-09-10 plan) — only renders for the 3 metricCodes
           analysis-ts's metric-provenance endpoint currently covers (selectedMetricCode is null
           for every other badge), and only once `provenance.found` is actually true — no empty
           disclosure for a badge this pilot doesn't cover yet, same "don't show a control with
           nothing behind it" rule as every other conditional section in this dialog. Collapsed
           by default (provenanceOpen) since most viewers won't need it — a skeptical user opts
           in, it's not shoved in front of everyone. -->
      <div v-if="provenance?.found" class="guru-badge-category-card__provenance">
        <button type="button" class="guru-badge-category-card__provenance-toggle" @click="provenanceOpen = !provenanceOpen">
          {{ provenanceOpen ? '收合計算依據' : '查看計算依據' }}
        </button>
        <div v-if="provenanceOpen" class="guru-badge-category-card__provenance-body">
          <ul class="guru-badge-category-card__provenance-list">
            <li v-for="(entry, index) in provenance.entries" :key="index" class="guru-badge-category-card__provenance-entry">
              <button
                v-if="entry.type === 'statementField'"
                type="button"
                class="guru-badge-category-card__provenance-link"
                @click="openProvenanceEntry(entry)"
              >
                <span>{{ entry.role }}：{{ formatProvenanceValue(entry.value) }}</span>
                <el-icon><Right /></el-icon>
              </button>
              <span v-else class="guru-badge-category-card__provenance-text">
                {{ entry.role }}：{{ formatProvenanceValue(entry.value) }}（{{ entry.sourceDescription }}）
              </span>
            </li>
          </ul>
          <p v-if="provenance.methodologyNote" class="guru-badge-category-card__provenance-note">{{ provenance.methodologyNote }}</p>
        </div>
      </div>

      <p v-if="selectedBadge && (!selectedBadge.piotroskiGroup || knowledgeDateFor(selectedBadge))" class="guru-badge-category-card__as-of-date">
        <!-- Piotroski's 3 sub-badges have no single raw value to show (formatRawValue reads the
             shared piotroskiFScore field, which isn't this group's own number) — the checklist
             above already tells the full story, so this half is skipped for those three. -->
        <template v-if="!selectedBadge.piotroskiGroup">{{ symbol }} 目前數值：{{ formatRawValue(selectedBadge) }}｜</template>
        <template v-if="knowledgeDateFor(selectedBadge)">資料時間：{{ knowledgeDateFor(selectedBadge) }}</template>
      </p>
      <p class="guru-badge-category-card__dialog-disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
    </div>
  </div>
</template>

<style scoped>
.guru-badge-category-card__head {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__fraction {
  margin-left: 4px;
  font-weight: 700;
  color: var(--el-color-primary);
}

/* Grid, not a wrapping flex row, per direct request 2026-09-11 ("guru-badge-category-card__row
   希望可以做成grid 手機上比較好看") — a flex row's chips wrapped at whatever width each badge's
   own name happened to need, so a mobile-width row could end up with one long chip alone on its
   own line next to a lot of empty space beside it. A grid gives every chip the same column
   width regardless of name length, so mobile in particular lands on a clean, evenly-spaced 2-
   or-3-column layout instead of ragged wrapping. */
.guru-badge-category-card__row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

/* Icon-on-top, text-below per the same request ("徽章一樣要做icon在上 文字在下的樣子") — matches
   this app's own established badge-icon convention elsewhere (GuruBadgeCard.vue's own medal
   sits above its name the same way). No longer a horizontal pill (medal-name-score in a row),
   so the full-pill 999px radius no longer fits the now-roughly-square card shape either. */
.guru-badge-category-card__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Vertical centering per direct request — the grid row (repeat(auto-fill, minmax(140px, 1fr)))
     stretches every chip in the same row to the tallest one's height (e.g. a 2-line badge name),
     and without this the shorter chips' content just sat at the top of that extra space instead
     of centering in it. Applied to every state (is-met/is-unmet/is-unknown), not only is-met —
     they already share every other layout rule on this base class, and centering only one state
     would make chips visibly jump position depending on pass/fail within the same row. */
  justify-content: center;
  gap: 8px;
  padding: 16px 8px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-primary);
  text-align: center;
}

.guru-badge-category-card__chip:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* Redesigned 2026-09-14 (reported live: "卡片現在看起來醜，希望重新設計") — real bug behind the
   "ugly" report: the medal below used to render the exact same bright categoryColor fill for
   EVERY state regardless of met/unmet/unknown (is-unmet was never even applied as a class — see
   git history), so a genuinely-failed badge looked as prominent as an achieved one. Per direct
   request 2026-09-10, this card doesn't use --el-color-success/danger for met/unmet (safe-harbor
   wording concern — a color implying "good/bad" reads as investment advice) — so the 3 states are
   now told apart by SHAPE (filled circle / hollow ring / dashed ghost, see chip-medal rules
   below), not color. Met gets a light background tint so "achieved" reads as an emphasized card,
   not just a border-color change. */
.guru-badge-category-card__chip.is-met {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

/* Unmet-with-real-data (`is-unmet`) deliberately has NO chip-level border/background override —
   this is the "standard, neutral" state, distinguished only via its medal's hollow ring below,
   not via dimming the whole chip (a full-chip opacity, as this class used to do before this
   redesign, drops var(--el-text-color-primary) text below AA contrast — removed for that
   reason). The class is still applied (see template) purely to scope the medal rule below. */

.guru-badge-category-card__chip.is-unknown {
  border-style: dashed;
  color: var(--el-text-color-placeholder);
}

/* Bumped from 24px to 32px moving into the icon-on-top layout — at the old size, sitting alone
   on its own top row (no name/score beside it anymore to visually balance it) read as small and
   a little lost; matches this app's other stacked-icon conventions (e.g. GURU_CATEGORY_ICON's
   own tab icons) better at this size. */
.guru-badge-category-card__chip-medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  font-size: 16px;
  flex-shrink: 0;
}

/* Solid fill (background set inline via :style="{ background: categoryColor }" in the template,
   since it needs the JS categoryColor value) — white icon reads against any of the 8 category
   colors, never overridden by is-unmet/is-unknown below (those set their own icon color). */
.guru-badge-category-card__chip.is-met .guru-badge-category-card__chip-medal {
  color: #fff;
}

/* Hollow ring — no fill, just an outline + the outline-trophy icon (see template), so a real
   "didn't pass" result reads as a plain, unfilled circle instead of the same bright medal a met
   badge gets. */
.guru-badge-category-card__chip.is-unmet .guru-badge-category-card__chip-medal {
  background: transparent;
  border-color: var(--el-text-color-secondary);
  color: var(--el-text-color-secondary);
}

/* Dashed "ghost" ring + question mark — matches the chip's own dashed border for "we don't know"
   (insufficient data or industry-inapplicable), visually distinct from both the filled (met) and
   solid-ring (unmet) states. */
.guru-badge-category-card__chip.is-unknown .guru-badge-category-card__chip-medal {
  background: transparent;
  border-style: dashed;
  border-color: var(--el-text-color-placeholder);
  color: var(--el-text-color-placeholder);
}

/* Re-added 2026-09-15 per direct request ("guru-badge-category-card__chip-name 不要換行") —
   badges with longer names (e.g. "Basel III 資本適足率門檻") were wrapping to 2-3 lines and
   making chips within the same row uneven heights; nowrap + ellipsis keeps every chip's own
   name to one line, full text still available via the native `title` attribute on hover/long-
   press (see template) and in full inside the badge's own expanded detail. */
.guru-badge-category-card__chip-name {
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.guru-badge-category-card__chip-score {
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__chip.is-met .guru-badge-category-card__chip-score {
  color: var(--el-color-primary);
}

.guru-badge-category-card__detail {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color);
}

.guru-badge-category-card__dialog-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.guru-badge-category-card__detail-close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.guru-badge-category-card__detail-close:hover,
.guru-badge-category-card__detail-close:focus-visible {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.guru-badge-category-card__dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guru-badge-category-card__dialog-byline {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__dialog-source-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--el-color-primary);
}

.guru-badge-category-card__criteria-card {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.guru-badge-category-card__criteria-label {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__criteria-value {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__sources {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__sources--hidden {
  display: none;
}

/* Moved down here from the criteria card 2026-09-10 ("資料時間可以放到彈窗下面點的位置。他順序
   沒這麼高。") — same quiet, low-priority styling as the disclaimer right below it, since it's
   metadata about the data rather than part of the result itself. */
.guru-badge-category-card__as-of-date {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

/* Same "widen + shrink" fix as GuruBadgeCard.vue's own identical bug (see that file's own
   comment for the measured widths) — dialog widened 480px → 600px, formula font-size reduced to
   14px. overflow-x:auto stays as the fallback for the widest outlier formulas only. */
/* Given a little color 2026-09-10 alongside GuruBadgeCard.vue's own identical change (see that
   file's own comment) — subtle primary-tinted background + the existing border-top separator
   kept as the only border, not a full surrounding one. */
.guru-badge-category-card__criteria-formula {
  /* Same edge-bleed trick as GuruBadgeCard.vue's own identical block — negative margins cancel
     the parent criteria-card's own 12px/16px padding so the tinted box's bottom corners line up
     with the card's own rounded corners instead of floating mid-card. */
  margin: 12px -16px -12px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-radius: 0 0 7px 7px;
  background: var(--el-color-primary-light-9);
  overflow-x: auto;
  text-align: center;
  font-size: 14px;
}

.guru-badge-category-card__signal-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.guru-badge-category-card__signal {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.guru-badge-category-card__signal-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  font-weight: 700;
  font-size: 14px;
}

.guru-badge-category-card__signal-mark.is-met {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.guru-badge-category-card__signal-mark.is-unmet {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.guru-badge-category-card__signal-mark.is-unknown {
  background: var(--el-fill-color);
  color: var(--el-text-color-placeholder);
}

.guru-badge-category-card__list-detail {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guru-badge-category-card__provenance {
  margin-top: 16px;
}

.guru-badge-category-card__provenance-toggle {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
  cursor: pointer;
}

.guru-badge-category-card__provenance-body {
  margin-top: 8px;
}

/* Capped + scrollable per direct request 2026-09-14 ("徽章彈窗 計算依據 展開時可能會變得非常長
   希望可以限制高度用scroll的") — some metrics itemize many periods (e.g. a metric needing a
   long comparison window could list well over a screen's worth of entries), which would
   otherwise push the dialog's own footer (確認/取消) off-screen with no way to reach it short of
   scrolling the whole page behind the dialog. Capping just this list (not the whole dialog body)
   keeps the badge's own description/formula above it always visible, and methodologyNote below
   it (see template) stays anchored outside the scroll area too. */
.guru-badge-category-card__provenance-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 6px;
}

.guru-badge-category-card__provenance-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
}

/* Real bug fixed 2026-09-11 (reported live: "希望表頭不要跑版") — a flex child defaults to
   min-width: auto, refusing to shrink below its own text's natural width; a long role label
   (e.g. "市值（X4 分子，＝流通股數×股價，見 marketCap 指標）") pushed this row wider than its own
   card instead of wrapping, same flex-shrink trap this app has hit before. */
.guru-badge-category-card__provenance-link span {
  flex: 1;
  min-width: 0;
  white-space: normal;
  word-break: break-word;
}

.guru-badge-category-card__provenance-link:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.guru-badge-category-card__provenance-text {
  display: block;
  padding: 8px 10px;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__provenance-note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.guru-badge-category-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
