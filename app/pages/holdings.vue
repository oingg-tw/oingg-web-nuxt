<script setup lang="ts">
// Placeholder page — 持股管理。Still shell-only overall (no position data model/backend
// yet), but now sectioned into the three sub-systems this page is actually meant to cover
// (see project_docs_derived_feature_backlog memory) so each has its own place to land
// independently as real work starts, rather than one undifferentiated empty state:
// - 三水桶配置：使用者實際持股歸類到三個資產配置艙位。
// - 稅後現金流試算：股利拆解（54C／76／收益平準金）＋二代健保 2.11% 預扣試算。
// - 動態提領護欄：依目前市值與生活費預算計算當期提領率是否偏離基準。
// None of these have a real backend yet — every section below is a structure-only shell,
// no fabricated numbers.
</script>

<template>
  <div class="holdings-page">
    <div class="holdings-page__header">
      <h1 class="holdings-page__title">持股管理</h1>
      <p class="holdings-page__subtitle">持股數量、成本管理，以及股利現金流儀表板——追蹤每檔持股的配息時間與現金流入</p>
    </div>

    <section class="holdings-page__section">
      <h2 class="holdings-page__section-title">三水桶配置</h2>
      <el-empty description="功能開發中，敬請期待" :image-size="60" />
    </section>

    <section class="holdings-page__section">
      <h2 class="holdings-page__section-title">稅後現金流試算</h2>
      <el-empty description="功能開發中，敬請期待" :image-size="60" />
    </section>

    <section class="holdings-page__section">
      <h2 class="holdings-page__section-title">動態提領護欄</h2>
      <el-empty description="功能開發中，敬請期待" :image-size="60" />
    </section>
  </div>
</template>

<style scoped>
.holdings-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Real bug fixed 2026-09-16 ("全站嚴禁出現 負 margin 負 padding") — the subtitle used to pull
   itself up 16px via `margin: -16px 0 0`, shrinking the parent flex's own 24px `gap` down to an
   effective 8px between just title and subtitle. Wrapping both in their own header block (see
   template) with its own smaller `gap` gets the identical 8px spacing without fighting the outer
   gap via negative margin — the outer flex still sees this header as a single child, so every
   OTHER section below keeps its full 24px gap unchanged. */
.holdings-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.holdings-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.holdings-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.holdings-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.holdings-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}
</style>
