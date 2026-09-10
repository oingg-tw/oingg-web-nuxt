<script setup lang="ts">
import { Trophy, TopRight, Right } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER, guruBadgeHasProvenance, guruBadgeMetricCode, guruBadgeSourceUrl, guruBadgesByCategory } from '~/utils/guru-badges'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import type { MetricProvenanceEntry } from '~/composables/stock/useMetricProvenance'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'

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

// Every field a threshold might need across this category's own badges: each badge's own
// fieldId plus any extraFieldIds (e.g. Graham Number/NCAV need the stock's own price) — deduped.
const fieldIds = computed(() => [...new Set(badges.value.flatMap(badge => [badge.fieldId, ...(badge.threshold.extraFieldIds ?? [])]))])

const { data: scores, units, pending } = useGuruBadgeScores(symbolRef, fieldIds.value)

function numericValue(fieldId: string): number | null {
  const raw = scores.value?.[fieldId]?.value
  if (raw === null || raw === undefined) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
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
// never coerced to 0, which would misrepresent "we don't know" as "this one failed."
function scoreFor(badge: GuruBadge): { numerator: number | null; denominator: number } {
  if (badge.piotroskiGroup) return piotroskiGroupScore(badge.piotroskiGroup)
  const value = numericValue(badge.fieldId)
  if (value === null) return { numerator: null, denominator: badge.threshold.denominator }
  const extra: Record<string, number | null> = {}
  for (const fieldId of badge.threshold.extraFieldIds ?? []) extra[fieldId] = numericValue(fieldId)
  return { numerator: badge.threshold.numerator(value, extra), denominator: badge.threshold.denominator }
}

function isMet(badge: GuruBadge): boolean | null {
  const score = scoreFor(badge)
  if (score.numerator === null) return null
  const check = badge.threshold.isMet ?? ((numerator, denominator) => numerator === denominator)
  return check(score.numerator, score.denominator)
}

function formatFraction(badge: GuruBadge): string {
  const score = scoreFor(badge)
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

// Real bug fixed 2026-09-10 (reported live: "淨流動資產價值 數字要format不讓他跑版") — this used
// to interpolate the API's raw floating-point value with zero formatting (`${value}`), so a
// value like 64.19384729103647 rendered in full on the chip and blew out its layout. Not
// specific to NCAV — every badge that goes through formatRawValue (anything with denominator 1,
// i.e. everything except Piotroski F-Score) had the exact same unformatted-float problem, so the
// fix is generic, not a special case for one badge. 3 significant figures per direct request
// (toPrecision(3), not toFixed — significant figures, not decimal places, so a three-digit whole
// number like Graham Number's 693.89 → "694" stays 3 digits instead of gaining two more after a
// decimal point).
//
// Second real bug caught live while verifying the first fix: NCAV is a total balance-sheet
// figure (流動資產－總負債), not a per-share one — a large-cap stock's own value came back as
// 1660000000000 (NT$1.66 trillion). toPrecision(3) alone is technically still "3 significant
// figures" on a number like that (the trailing zeros are just place value, not extra precision),
// but the round-tripped Number().toString() output is still a 13-digit string that blows out the
// exact same chip layout the first fix was meant to protect. Abbreviates with 億/兆 (the units
// Taiwanese financial reporting actually uses for numbers this size, not a frontend invention)
// once the magnitude crosses those thresholds — the recursive call re-applies the same 3-sig-fig
// rounding to the now-scaled-down number (e.g. 1.66) rather than trying to divide an
// already-rounded integer and hope the result is still clean.
function formatSignificantDigits(value: number, digits: number): string {
  const rounded = Number(value.toPrecision(digits))
  const magnitude = Math.abs(rounded)
  if (magnitude >= 1e12) return `${formatSignificantDigits(rounded / 1e12, digits)}兆`
  if (magnitude >= 1e8) return `${formatSignificantDigits(rounded / 1e8, digits)}億`
  return rounded.toString()
}

function formatRawValue(badge: GuruBadge): string {
  const value = numericValue(badge.fieldId)
  if (value === null) return '尚無資料'
  return `${formatSignificantDigits(value, 3)}${units.value[badge.fieldId] ?? ''}`
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

function asOfDate(badge: GuruBadge): string | null {
  if (badge.piotroskiGroup) return piotroskiBreakdown.value?.knowledgeDate ?? null
  return scores.value?.[badge.fieldId]?.asOfDate ?? null
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

// Split into 達成/未達成 halves per direct request 2026-09-10 ("徽章卡片要分上下兩半。上面是
// 有達成的，下面是沒達成的。") — a badge with insufficient data to evaluate (isMet === null)
// still isn't a confirmed "達成", so it groups with the 未達成 half, not its own third section.
const metBadges = computed(() => badges.value.filter(badge => isMet(badge) === true))
const unmetBadges = computed(() => badges.value.filter(badge => isMet(badge) !== true))

const dialogVisible = ref(false)
const selectedBadge = ref<GuruBadge | null>(null)

function openBadge(badge: GuruBadge): void {
  selectedBadge.value = badge
  dialogVisible.value = true
  provenanceOpen.value = false
}

// "數字可回溯到原始申報資料" pilot (2026-09-10 plan) — analysis-ts's new metric-provenance
// endpoint only covers 3 metricCodes so far (see guru-badges.ts's own
// PROVENANCE_PILOT_METRIC_CODES comment), so `selectedMetricCode` stays null for every other
// badge and useMetricProvenance simply never fires a request for those — no "查看計算依據"
// section renders at all rather than a section that always 404s.
const selectedMetricCode = computed(() => (selectedBadge.value && guruBadgeHasProvenance(selectedBadge.value) ? guruBadgeMetricCode(selectedBadge.value) : null))
const { data: provenance } = useMetricProvenance(symbolRef, selectedMetricCode)
const provenanceOpen = ref(false)

// `raw` isn't guaranteed to be a string — bff-ts confirmed live that most entries are
// bigint-serialized strings but at least one (chowderNumber's market-snapshot entry) is a plain
// float — Number() handles both uniformly, only the display formatting needs to branch.
function formatProvenanceValue(raw: string | number): string {
  const value = Number(raw)
  return Number.isFinite(value) ? value.toLocaleString('zh-TW') : String(raw)
}

// Jumps into 會計模式 at the exact period/row this entry came from (useStatementRowFocus.ts's
// own jumpToStatementRow, built ahead of this exact caller — see that file's own comment).
// `other`-typed entries (market price, share-count filings) have no statement row to jump to,
// so they render as plain text in the template instead of calling this at all. Closes this
// dialog first since the jump navigates the whole page away from "looking at a badge" into
// "looking at the raw statement" — leaving the dialog open on top of that would just cover it.
function openProvenanceEntry(entry: MetricProvenanceEntry): void {
  if (entry.type !== 'statementField' || !entry.statementType || !entry.fieldKey) return
  dialogVisible.value = false
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
  <el-card v-if="hasBadges" v-loading="pending" class="guru-badge-category-card" shadow="never">
    <div class="guru-badge-category-card__head">
      <p class="guru-badge-category-card__category">{{ category }}徽章</p>
      <p class="guru-badge-category-card__fraction">{{ categoryFraction }}</p>
    </div>

    <div v-if="metBadges.length" class="guru-badge-category-card__section">
      <p class="guru-badge-category-card__section-title">已達成</p>
      <div class="guru-badge-category-card__row">
        <button
          v-for="badge in metBadges"
          :key="badge.id"
          type="button"
          class="guru-badge-category-card__chip is-met"
          @click="openBadge(badge)"
        >
          <span class="guru-badge-category-card__chip-medal" :style="{ background: categoryColor }">
            <el-icon><Trophy /></el-icon>
          </span>
          <span class="guru-badge-category-card__chip-name">{{ badge.name }}</span>
          <span class="guru-badge-category-card__chip-score">{{ chipScoreText(badge) }}</span>
        </button>
      </div>
    </div>

    <div v-if="unmetBadges.length" class="guru-badge-category-card__section">
      <p class="guru-badge-category-card__section-title">未達成</p>
      <div class="guru-badge-category-card__row">
        <button
          v-for="badge in unmetBadges"
          :key="badge.id"
          type="button"
          class="guru-badge-category-card__chip"
          :class="{ 'is-unknown': isMet(badge) === null }"
          @click="openBadge(badge)"
        >
          <span class="guru-badge-category-card__chip-medal" :style="{ background: categoryColor }">
            <el-icon><Trophy /></el-icon>
          </span>
          <span class="guru-badge-category-card__chip-name">{{ badge.name }}</span>
          <span class="guru-badge-category-card__chip-score">{{ chipScoreText(badge) }}</span>
        </button>
      </div>
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
    <el-dialog v-model="dialogVisible" width="min(600px, 92vw)" align-center append-to-body>
      <template v-if="selectedBadge" #header>
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
            查看原始資料來源
            <el-icon><TopRight /></el-icon>
          </a>
        </p>
      </template>

      <div v-if="selectedBadge" class="guru-badge-category-card__criteria-card">
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
      <p v-if="selectedBadge && metricSources(selectedBadge)" class="guru-badge-category-card__sources">
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

      <p v-if="selectedBadge && (!selectedBadge.piotroskiGroup || asOfDate(selectedBadge))" class="guru-badge-category-card__as-of-date">
        <!-- Piotroski's 3 sub-badges have no single raw value to show (formatRawValue reads the
             shared piotroskiFScore field, which isn't this group's own number) — the checklist
             above already tells the full story, so this half is skipped for those three. -->
        <template v-if="!selectedBadge.piotroskiGroup">{{ symbol }} 目前數值：{{ formatRawValue(selectedBadge) }}｜</template>
        <template v-if="asOfDate(selectedBadge)">資料時間：{{ asOfDate(selectedBadge) }}</template>
      </p>
      <p class="guru-badge-category-card__dialog-disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.guru-badge-category-card {
  border-radius: 12px;
}

.guru-badge-category-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.guru-badge-category-card__category {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__fraction {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.guru-badge-category-card__section + .guru-badge-category-card__section {
  margin-top: 12px;
}

.guru-badge-category-card__section-title {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
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
  gap: 6px;
  padding: 12px 8px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-primary);
  text-align: center;
}

/* Per direct request 2026-09-10 ("已達成的badge border也是...減少畫面上的雜訊") — was
   var(--el-color-success), now the same theme accent as everything else on this card instead of
   an extra green that only the met chips carried. */
.guru-badge-category-card__chip.is-met {
  border-color: var(--el-color-primary);
}

.guru-badge-category-card__chip.is-unmet {
  opacity: 0.7;
}

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
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
}

/* white-space: nowrap dropped — a badge name now wraps onto a second line inside its own grid
   cell instead of forcing the cell wider than its column (which a fixed-width grid can't allow
   the way the old flex row could just grow a chip to fit). */
.guru-badge-category-card__chip-name {
  font-size: 16px;
}

.guru-badge-category-card__chip-score {
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__chip.is-met .guru-badge-category-card__chip-score {
  color: var(--el-color-primary);
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

.guru-badge-category-card__provenance-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
