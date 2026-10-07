<script setup lang="ts">
import { Trophy, TopRight } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'

const props = defineProps<{
  badge: GuruBadge
}>()

const dialogVisible = ref(false)


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

// 公式與來源都從型錄讀（2026-09-10「後端有給 referenceUrl，你前端忠實呈現就好」），前端不放第二份
const { data: filterSchema } = await useFilterSchema()
const badgeMetricLocation = computed(() => locateFieldInSchema(filterSchema.value?.categories ?? [], props.badge.fieldId))
const formulaHtml = computed(() => renderFormulaHtml(badgeMetricLocation.value?.metric.formulaLatex, true))
// 徽章自己的門檻來源（型錄 badge.sourceUrl，2026-09-20），不是指標的 referenceUrl；沒有就不顯示連結
const sourceUrl = computed(() => props.badge.sourceUrl)
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
      <!-- 幾個公式（Ohlson／Zmijewski／Beneish 的多項迴歸）寬過對話框：在自己的盒子裡橫向捲動，不撐壞對話框版面。 -->
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

/* 「不要scroll」（2026-09-10）：NCAV 的公式比對話框內容寬約 9%（實測 447px 對 411px），出現橫向捲軸。對話框 560→600px，
   公式以 14px 渲染（KaTeX 以 em 相對容器縮放，整條公式等比例縮小）——除了最寬的多項迴歸（Ohlson O-Score 預設尺寸就 1050px，
   九因子邏輯迴歸，縮到能塞進去就看不清）之外都夠。`overflow-x: auto` 留給那幾個極端案例：對話框寬度還得照顧下面的說明段落，
   不能一直加寬。 */
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
