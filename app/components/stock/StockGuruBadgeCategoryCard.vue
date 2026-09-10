<script setup lang="ts">
import { Trophy, TopRight } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER, GURU_CATEGORY_COLOR, guruBadgeSourceUrl, guruBadgesByCategory } from '~/utils/guru-badges'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'

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
// a confirmed pass), each only rendered when it actually has a badge in it.
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

const badgesByCategory = computed(() => guruBadgesByCategory(filterSchema.value?.categories ?? []))
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

// null = insufficient real data to evaluate (e.g. Graham Number/NCAV without a stock price) —
// never coerced to 0, which would misrepresent "we don't know" as "this one failed."
function scoreFor(badge: GuruBadge): { numerator: number | null; denominator: number } {
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

function formatRawValue(badge: GuruBadge): string {
  const value = numericValue(badge.fieldId)
  if (value === null) return '尚無資料'
  return `${value}${units.value[badge.fieldId] ?? ''}`
}

function asOfDate(badge: GuruBadge): string | null {
  return scores.value?.[badge.fieldId]?.asOfDate ?? null
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
}

// Simplified 2026-09-10 to reuse locateFieldInSchema/renderFormulaHtml (see GuruBadgeCard.vue's
// own comment) instead of a hand-rolled metric lookup + a second direct katex import — same
// logic, one fewer place carrying its own copy of it.
function formulaHtml(badge: GuruBadge): string | null {
  const location = locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)
  return renderFormulaHtml(location?.metric.formulaLatex, true)
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
          <span class="guru-badge-category-card__chip-medal" :style="{ background: GURU_CATEGORY_COLOR[category] }">
            <el-icon><Trophy /></el-icon>
          </span>
          <span class="guru-badge-category-card__chip-name">{{ badge.name }}</span>
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
          <span class="guru-badge-category-card__chip-medal" :style="{ background: GURU_CATEGORY_COLOR[category] }">
            <el-icon><Trophy /></el-icon>
          </span>
          <span class="guru-badge-category-card__chip-name">{{ badge.name }}</span>
        </button>
      </div>
    </div>

    <!-- Redesigned 2026-09-10 alongside GuruBadgeCard.vue's own identical redesign (see that
         file's own comment) — same visual language: byline moved into the #header slot, the
         threshold/value/formula grouped into one tinted criteria card instead of three floating
         lines. sourceUrl link is new here too (this dialog never had one before). -->
    <el-dialog v-model="dialogVisible" width="min(480px, 92vw)" align-center append-to-body>
      <template v-if="selectedBadge" #header>
        <p class="guru-badge-category-card__dialog-title">{{ selectedBadge.name }}</p>
        <p class="guru-badge-category-card__dialog-byline">
          <template v-if="hasDistinctNameEn(selectedBadge)">{{ selectedBadge.nameEn }}｜</template>{{ selectedBadge.author }}
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
        <p class="guru-badge-category-card__criteria-current">
          符合 {{ formatFraction(selectedBadge) }} 項｜{{ symbol }} 目前數值：{{ formatRawValue(selectedBadge) }}
          <span v-if="asOfDate(selectedBadge)" class="guru-badge-category-card__list-date">（{{ asOfDate(selectedBadge) }}）</span>
        </p>
        <div v-if="formulaHtml(selectedBadge)" class="guru-badge-category-card__criteria-formula" v-html="formulaHtml(selectedBadge)" />
      </div>

      <p v-if="selectedBadge" class="guru-badge-category-card__list-detail">{{ selectedBadge.detail }}</p>
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

.guru-badge-category-card__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.guru-badge-category-card__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 6px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.guru-badge-category-card__chip.is-met {
  border-color: var(--el-color-success);
}

.guru-badge-category-card__chip.is-unmet {
  opacity: 0.7;
}

.guru-badge-category-card__chip.is-unknown {
  border-style: dashed;
  color: var(--el-text-color-placeholder);
}

.guru-badge-category-card__chip-medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  flex-shrink: 0;
}

.guru-badge-category-card__chip-name {
  white-space: nowrap;
}

.guru-badge-category-card__dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guru-badge-category-card__dialog-byline {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__dialog-source-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  color: var(--el-color-primary);
}

.guru-badge-category-card__criteria-card {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.guru-badge-category-card__criteria-label {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-category-card__criteria-value {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.guru-badge-category-card__criteria-current {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.guru-badge-category-card__list-date {
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.guru-badge-category-card__criteria-formula {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  overflow-x: auto;
}

.guru-badge-category-card__list-detail {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guru-badge-category-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
