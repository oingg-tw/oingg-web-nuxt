<script setup lang="ts">
// 徽章系統 (renamed same day from 大師指標 — see app-features.ts's own comment) — a static
// reference gallery of named, real academic/practitioner scoring
// methodologies (Piotroski F-Score, Altman Z-Score, DuPont analysis, etc — see
// app/utils/guru-badges.ts's own top comment for the full list and why each was chosen). Built
// 2026-09-08 per direct request ("sidebar 加上一個功能，這個功能點進去看有非常多的徽章。每個
// 徽章都是一個評分標準或是論文").
//
// This route/nav slot was previously reserved (as a placeholder shell, see this file's own git
// history) for a DIFFERENT, earlier, larger design: a 大師-picker + editable六角雷達圖 applied to
// the user's own watchlist (full design + compliance review preserved in memory
// project_guru_zone_radar_chart_idea, rolled back to this placeholder 2026-09-03). Per direct
// confirmation (AskUserQuestion, 2026-09-08: "沙盤已預留的 /guru-indicators（推薦）"), this badge
// gallery now occupies that slot instead — the radar-chart plan is NOT built here, it stays
// parked in that memory note for a possible future separate feature.
//
// Deliberately a reference/glossary gallery, not a per-stock calculator: every badge's copy
// describes what the methodology MEASURES and how it's composed, never what any specific stock's
// score means or implies about buying/holding/selling it — this page itself never fetches live
// per-symbol data (unlike StockGuruBadgeCard.vue on the stock-detail page, which does, reusing
// each badge's own `fieldId`/`threshold`).
//
// Grouped by category top-to-bottom 2026-09-09 per direct request ("guru-indicators 那一頁要幫
// 我分類。從上到下") — was a single flat grid in GURU_BADGES' own array order; now one
// <section>/heading per GURU_BADGE_CATEGORIES slot that actually has a badge (empty categories
// don't get an empty heading, same "only show what's real" discipline as
// StockGuruBadgeCard.vue's own displayedCategories filter).
const badgesByCategory = computed(() =>
  GURU_BADGE_CATEGORIES.map(category => ({ category, badges: GURU_BADGES.filter(badge => badge.category === category) })).filter(
    group => group.badges.length > 0
  )
)
</script>

<template>
  <div class="guru-indicators-page">
    <h1 class="guru-indicators-page__title">徽章系統</h1>
    <p class="guru-indicators-page__subtitle">
      公開學術文獻與投資實務中常見的財務評分方法論參考手冊——不是任何一檔股票的評等或投資建議
    </p>
    <section v-for="group in badgesByCategory" :key="group.category" class="guru-indicators-page__section">
      <h2 class="guru-indicators-page__section-title">{{ group.category }}</h2>
      <div class="guru-indicators-page__grid">
        <GuruBadgeCard v-for="badge in group.badges" :key="badge.id" :badge="badge" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.guru-indicators-page {
  width: 100%;
}

.guru-indicators-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-indicators-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 24px;
}

.guru-indicators-page__section + .guru-indicators-page__section {
  margin-top: 32px;
}

.guru-indicators-page__section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px;
}

.guru-indicators-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
