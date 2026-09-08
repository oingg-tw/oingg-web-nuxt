<script setup lang="ts">
// 大師指標 — a static reference gallery of named, real academic/practitioner scoring
// methodologies (Piotroski F-Score, Altman Z-Score, DuPont analysis, etc — see
// app/utils/guru-badges.ts's own top comment for the full list and why each was chosen). Built
// 2026-09-08 per direct request ("sidebar 加上一個功能，這個功能點進去看有非常多的徽章。每個
// 徽章都是一個評分標準或是論文").
//
// This route/nav slot was previously reserved (as a placeholder shell, see this file's own git
// history) for a DIFFERENT, earlier, larger design: a 大師-picker + editable six-axis radar
// chart applied to the user's own watchlist (full design + compliance review preserved in
// memory project_guru_zone_radar_chart_idea, rolled back to this placeholder 2026-09-03). Per
// direct confirmation (AskUserQuestion, 2026-09-08: "沙盤已預留的 /guru-indicators（推薦）"),
// this badge gallery now occupies that slot instead — the radar-chart plan is NOT built here,
// it stays parked in that memory note for a possible future separate feature.
//
// Deliberately a reference/glossary gallery, not a per-stock calculator: every badge's copy
// describes what the methodology MEASURES and how it's composed, never what any specific
// stock's score means or implies about buying/holding/selling it. Each badge does carry a real
// fieldId (a genuine GET /filters field this site can already query), but nothing here fetches
// live data yet — a future per-stock lookup feature could reuse useStockHealthCheck.ts's own
// per-symbol POST /screener/values pattern against these same fieldIds, out of scope for now.
</script>

<template>
  <div class="guru-indicators-page">
    <h1 class="guru-indicators-page__title">大師指標</h1>
    <p class="guru-indicators-page__subtitle">
      公開學術文獻與投資實務中常見的財務評分方法論參考手冊——不是任何一檔股票的評等或投資建議
    </p>
    <div class="guru-indicators-page__grid">
      <GuruBadgeCard v-for="badge in GURU_BADGES" :key="badge.id" :badge="badge" />
    </div>
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

.guru-indicators-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
