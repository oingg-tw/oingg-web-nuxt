<script setup lang="ts">
import { Trophy, TopRight } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER } from '~/utils/guru-badges'
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
const badgeMetricLocation = computed(() => locateFieldInSchema(filterSchema.value?.categories ?? [], props.badge.fieldId))
const formulaHtml = computed(() => renderFormulaHtml(badgeMetricLocation.value?.metric.formulaLatex, true))
// The badge's OWN threshold source (catalog `badge.sourceUrl`, 2026-09-20) — no longer the
// metric's referenceUrl/academicSourceUrl, which answer a different question; see
// GuruBadge.sourceUrl's own comment. Absent → the template's v-if renders no link at all.
const sourceUrl = computed(() => props.badge.sourceUrl)
// Data-provenance category tags (資產負債表/損益表/...) added 2026-09-10 per direct request —
// same schema lookup formulaHtml/sourceUrl already do, no extra fetch. Undefined until bff-ts
// wires `sources` through GET /metrics (see useFilterSchema.ts's own comment) — the template's
// own v-if hides the whole row until then, same "don't show a section with nothing behind it"
// rule as every other conditional block on this page.
const metricSources = computed(() => badgeMetricLocation.value?.metric.sources)

// Per-category color (GURU_CATEGORY_COLOR, still used by guru-indicators.vue's own nav/section
// dots to tell 8 sections apart while scrolling) dropped from badge rendering itself 2026-09-10
// per direct request ("徽章的顏色都幫我統一改成主題色...減少畫面上的雜訊") — 8 fixed hex colors
// across medals/tags/dialog accents read as noise once badges also live inside category-scoped
// cards that already say which category they're in via the card header; one shared theme accent
// instead.
const categoryColor = 'var(--el-color-primary)'
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
       StockGuruBadgeDialog.vue's own chip buttons already use. -->
  <!-- `id` is the anchor every stock-detail card's「這是什麼指標？」link (StockCardTitle.vue)
       points at — `guru-badge-{metricCode}`, frozen once live. -->
  <el-card :id="`guru-badge-${badge.id}`" class="guru-badge-card" shadow="hover" :body-style="{ padding: 0 }">
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

  <el-dialog v-model="dialogVisible" width="min(600px, 92vw)" align-center append-to-body>
    <!-- Redesigned 2026-09-10 per direct feedback ("這邊看起來亂，告一段落以後請好好設計。") —
         the citation (byline) used to be its own plain body paragraph, visually identical to
         every other line in the dialog; moved into the dialog's own #header slot instead, right
         under the badge name, so it reads as a subtitle rather than competing with the actual
         criterion below for attention. -->
    <template #header>
      <p class="guru-badge-card__dialog-title">{{ badge.name }}</p>
      <p class="guru-badge-card__dialog-byline">
        <span><template v-if="hasDistinctNameEn">{{ badge.nameEn }}｜</template>{{ badge.author }}</span>
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="guru-badge-card__dialog-source-link"
        >
          查看公式出處
          <el-icon><TopRight /></el-icon>
        </a>
      </p>
    </template>

    <!-- The threshold and formula used to be two separate floating lines with no visual
         relationship — grouped into one tinted "criteria card" instead, since they're really
         the same fact (the quantitative definition of this badge) told two ways. Real bug fixed
         2026-09-10 (user's own dark-mode screenshot): this card's background used to be nearly
         indistinguishable from the dialog's own background in dark mode (measured live:
         rgb(30,30,30) dialog vs rgb(38,39,39) card — an 8-value difference, invisible in
         practice), so the whole dialog read as a flat gray wall. Fixed with a real border (see
         .guru-badge-card__criteria-card below). Visual weight also corrected the same day per
         direct follow-up ("希望視覺重點放在公式就好，門檻描述不跟他一樣權重") — the threshold
         text used to be the most prominent thing here (18px/700); the formula is now the actual
         focal point instead, the threshold text stepped back to plain body weight.

         Used to also carry a category-color left accent, set via inline :style (not
         `v-bind(categoryColor)` — that silently fails here since this el-dialog's
         `append-to-body` Teleports its content out of this component's own DOM subtree, and
         Vue's CSS v-bind() writes the bound value onto the component's root element, which
         teleported content can no longer inherit). Removed 2026-09-10 once categoryColor itself
         became a single shared theme color for every badge (see this file's own comment on that
         const) — a left accent that's identical on every single card no longer distinguishes
         anything, just adds a stripe of noise. -->
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
    <!-- Data-provenance line, added 2026-09-10 per direct request, moved to the bottom of the
         dialog the same day per direct follow-up ("sources 要放在 徽章彈窗的下面") — originally
         lived inside the criteria-card next to the threshold, which competed with the formula
         for the card's own visual focal point (see that card's own comment on why the formula
         is deliberately the focal point). Down here it reads as supporting metadata about the
         methodology, not part of the criterion itself. Rendered as plain comma-joined text, not
         el-tag chips, per same-day follow-up ("sources 不要裝飾") — a pill/border per source read
         as more visually important than this quiet metadata line deserves. -->
    <!-- Hidden 2026-09-15 per直接要求（"卡片上的 資料來源 都先幫我隱藏吧"）— same temporary,
         easy-to-revert intent as SharedDataFreshnessNote.vue's own SHOW_DATA_SOURCE. Hidden via
         CSS (a `hidden` class), not by touching the v-if condition itself — wrapping/`&&`-ing
         the condition both broke vue-tsc's type narrowing on metricSources below (confirmed live,
         turned this into a real "possibly undefined" typecheck error either way), so the v-if
         stays exactly as it was and only the visual display changes. -->
    <p v-if="metricSources" class="guru-badge-card__sources guru-badge-card__sources--hidden">資料來源：{{ metricSources.join('、') }}</p>
    <p class="guru-badge-card__dialog-disclaimer">{{ DISCLAIMER }}</p>
  </el-dialog>
</template>

<style scoped>
.guru-badge-card {
  border-radius: 12px;
  text-align: center;
  /* Anchor landings (see the id above) clear the sticky app header/banner. */
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
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
  font-size: 1.625rem;
  margin-bottom: 4px;
}

.guru-badge-card__category {
  border: none;
  color: #fff;
}

.guru-badge-card__name {
  margin: 8px 0 0;
  font-size: 1rem;
  font-weight: 600;
}

.guru-badge-card__name-en {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.guru-badge-card__author {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__summary {
  margin: 8px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.guru-badge-card__dialog-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guru-badge-card__dialog-byline {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__dialog-source-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--el-color-primary);
}

.guru-badge-card__criteria-card {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.guru-badge-card__criteria-label {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__criteria-value {
  margin: 4px 0 0;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__sources {
  margin: 16px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__sources--hidden {
  display: none;
}

/* Real follow-up bug fixed 2026-09-10 ("不要scroll") — NCAV's own formula alone overflowed the
   dialog's content width by ~9% (measured live: 447px formula vs 411px box), enough to trigger
   an unwanted horizontal scrollbar. Same "widen + shrink" strategy as GuruIndicatorRow.vue's own
   tooltip fix: the dialog itself was widened (560px → 600px) and this formula renders at 14px
   instead of the ~17px it'd otherwise inherit (KaTeX sizes itself in em units relative to its
   container, so this shrinks the whole formula proportionally) — together enough for every badge
   except the widest multi-term regressions (Ohlson O-Score measured 1050px even at default size
   — a real 9-factor logistic regression, genuinely too wide to fit any reasonably-proportioned
   dialog without becoming illegibly tiny). `overflow-x: auto` stays as the fallback for those
   rare extreme cases specifically — unlike the tooltip (which is free to grow as wide as it
   needs since nothing else on screen depends on its width), this dialog's own width also has to
   stay reasonable for the prose detail paragraph below, so it can't just keep growing to fit
   every possible formula. */
/* Given a little color 2026-09-10 per direct request ("公式可以加點顏色...1底色改主題色...3只加
   上底線border") — a subtle primary-tinted background plus the existing border-top separator
   (kept as the only border, not a full surrounding one, per the same request) makes the formula
   read as the card's own visual highlight without the "box inside a box" weight a full border
   around it would add on top of the criteria-card's own border. */
.guru-badge-card__criteria-formula {
  /* Negative left/right/bottom margins cancel the parent .guru-badge-card__criteria-card's own
     padding (12px 16px) so this tinted box bleeds flush to the card's edges — otherwise the
     border-radius below would round corners floating in the middle of the card instead of
     lining up with the card's own bottom-left/right corners. */
  margin: 12px -16px -12px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-radius: 0 0 7px 7px;
  background: var(--el-color-primary-light-9);
  overflow-x: auto;
  text-align: center;
  font-size: 0.875rem;
}

.guru-badge-card__dialog-detail {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guru-badge-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}
</style>
