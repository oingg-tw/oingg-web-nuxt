<script setup lang="ts">
import { Trophy, TopRight } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER, GURU_CATEGORY_COLOR, guruBadgeSourceUrl } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'

const props = defineProps<{
  badge: GuruBadge
}>()

const dialogVisible = ref(false)

// Formula added 2026-09-10 per direct request ("徽章補上來源與公式") — badges never showed their
// own formula before, only the plain "其他指標" rows did (see GuruIndicatorRow.vue). Reuses
// useFilterSchema()'s already-cached GET /metrics data (guru-indicators.vue's own page-level
// `await` already resolved the real schema into the shared cache before any card here mounts —
// see feedback_useasyncdata_shared_key_race memory — so this call is a guaranteed cache hit, not
// a fresh race) and locateFieldInSchema (already exported by useFilterSchema.ts for exactly this
// "find the metric behind a metricKey.fieldKey id" lookup — no need to hand-roll a second one).
// null when the badge's own metric hasn't been backfilled a formula/reference yet — same "don't
// force content that isn't real" discipline as everything else on this page.
//
// sourceUrl used to be a field hand-maintained per-badge in guru-badges.ts (web-searched one at
// a time) — replaced 2026-09-10 the same day it was added, per direct request ("後端有給
// referenceUrl，你前端忠實呈現就好。不然這樣我管理起來要兩邊跑") once bff-ts wired GET /metrics'
// own `referenceUrl` field through (same treatment as formulaLatex, commit 71572ca) — now read
// live off the same schema lookup instead of duplicated here.
const { data: filterSchema } = await useFilterSchema()
const formulaHtml = computed(() => {
  const location = locateFieldInSchema(filterSchema.value?.categories ?? [], props.badge.fieldId)
  return renderFormulaHtml(location?.metric.formulaLatex, true)
})
const sourceUrl = computed(() => guruBadgeSourceUrl(filterSchema.value?.categories ?? [], props.badge))

// Category colors and the disclaimer both moved to guru-badges.ts 2026-09-09 (see that file's
// own comments for the WCAG contrast verification and why it's shared) — StockGuruBadgeCard.vue
// on the stock-detail page needs the exact same two values, so they live in the shared data
// module instead of being duplicated per component.
const categoryColor = computed(() => GURU_CATEGORY_COLOR[props.badge.category])
const DISCLAIMER = GURU_BADGE_DISCLAIMER

// Several badges (Piotroski F-Score/Altman Z-Score/Beneish M-Score/Ohlson O-Score/Zmijewski
// Score/Graham Number) have no separate Chinese name — nameEn is set to the exact same string
// as name in guru-badges.ts (there's nothing to translate). Showing both lines back-to-back
// read as pure visual duplication (reported live). Only render nameEn when it's actually a
// different string worth showing.
const hasDistinctNameEn = computed(() => props.badge.nameEn !== props.badge.name)
</script>

<template>
  <!-- Real bug fixed 2026-09-10 (user explicitly asked this page reach WCAG AA): this card used
       to be an el-card with only a @click handler — no keyboard focus, no Enter/Space
       activation, nothing for a screen reader to announce as interactive. Wrapping the whole
       card body in a real <button> (reset to look identical, see .guru-badge-card__trigger)
       gives it native focus/keyboard/AT semantics for free, same reasoning as
       StockGuruBadgeCategoryCard.vue's own chip buttons already use. -->
  <el-card class="guru-badge-card" shadow="hover" :body-style="{ padding: 0 }">
    <button type="button" class="guru-badge-card__trigger" @click="dialogVisible = true">
      <div class="guru-badge-card__medal" :style="{ background: categoryColor }">
        <el-icon><Trophy /></el-icon>
      </div>
      <el-tag size="small" :color="categoryColor" class="guru-badge-card__category">
        {{ badge.category }}
      </el-tag>
      <p class="guru-badge-card__name">{{ badge.name }}</p>
      <p v-if="hasDistinctNameEn" class="guru-badge-card__name-en">{{ badge.nameEn }}</p>
      <p class="guru-badge-card__author">{{ badge.author }}</p>
      <p class="guru-badge-card__summary">{{ badge.summary }}</p>
    </button>
  </el-card>

  <el-dialog v-model="dialogVisible" width="min(560px, 92vw)" align-center append-to-body>
    <!-- Redesigned 2026-09-10 per direct feedback ("這邊看起來亂，告一段落以後請好好設計。") —
         the citation (byline) used to be its own plain body paragraph, visually identical to
         every other line in the dialog; moved into the dialog's own #header slot instead, right
         under the badge name, so it reads as a subtitle rather than competing with the actual
         criterion below for attention. -->
    <template #header>
      <p class="guru-badge-card__dialog-title">{{ badge.name }}</p>
      <p class="guru-badge-card__dialog-byline">
        <template v-if="hasDistinctNameEn">{{ badge.nameEn }}｜</template>{{ badge.author }}
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="guru-badge-card__dialog-source-link"
        >
          查看原始資料來源
          <el-icon><TopRight /></el-icon>
        </a>
      </p>
    </template>

    <!-- The threshold and formula used to be two separate floating lines with no visual
         relationship — grouped into one tinted "criteria card" instead, since they're really
         the same fact (the quantitative definition of this badge) told two ways. The threshold
         text itself is now the single most visually prominent thing in the dialog (18px/700),
         since it's what a reader actually came here to check. -->
    <div class="guru-badge-card__criteria-card">
      <p class="guru-badge-card__criteria-label">比較標準</p>
      <p class="guru-badge-card__criteria-value">{{ badge.threshold.description }}</p>
      <!-- Same overflow fix as GuruIndicatorRow.vue's own tooltip (see that file's own comment)
           — a handful of these formulas (Ohlson/Zmijewski/Beneish's own multi-term regressions)
           are wide enough to overflow even this dialog's width; scrolls horizontally within its
           own box instead of breaking the dialog's layout. -->
      <div v-if="formulaHtml" class="guru-badge-card__criteria-formula" v-html="formulaHtml" />
    </div>

    <p class="guru-badge-card__dialog-detail">{{ badge.detail }}</p>
    <p class="guru-badge-card__dialog-disclaimer">{{ DISCLAIMER }}</p>
  </el-dialog>
</template>

<style scoped>
.guru-badge-card {
  border-radius: 12px;
  text-align: center;
}

.guru-badge-card__trigger {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: center;
}

.guru-badge-card__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: #fff;
  font-size: 26px;
  margin-bottom: 4px;
}

.guru-badge-card__category {
  border: none;
  color: #fff;
}

.guru-badge-card__name {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
}

.guru-badge-card__name-en {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.guru-badge-card__author {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__summary {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.guru-badge-card__dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guru-badge-card__dialog-byline {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__dialog-source-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  color: var(--el-color-primary);
}

.guru-badge-card__criteria-card {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.guru-badge-card__criteria-label {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__criteria-value {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.guru-badge-card__criteria-formula {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  overflow-x: auto;
}

.guru-badge-card__dialog-detail {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guru-badge-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
