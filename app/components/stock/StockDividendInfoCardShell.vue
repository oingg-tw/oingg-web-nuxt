<script setup lang="ts">
// Loading-state placeholder for StockDividendInfoCard.vue (merged 2026-09-14 from
// StockExDividendCard.vue + StockDividendStabilityCard.vue) — shown while
// useExDividendNotices() at the page level hasn't resolved yet, same "只做版面結構，不放任何
//數字" convention as StockChartShell.vue/StockProfileCardShell.vue. Mirrors the real card's own
// two-section layout (stability tiles, then ex-dividend fields) so the loading state doesn't
// visually jump once real data arrives.
const TILE_LABELS = ['殖利率', '盈餘發放率', '連續配息年數']
const FIELDS = ['除權息基準日', '類型', '現金股利', '股票股利比例']
</script>

<template>
  <el-card class="dividend-info-shell" shadow="never">
    <template #header>
      <span class="dividend-info-shell__title">股利資訊</span>
    </template>

    <p class="dividend-info-shell__section-title">配息穩定度</p>
    <div class="dividend-info-shell__tiles">
      <div v-for="label in TILE_LABELS" :key="label" class="dividend-info-shell__tile">
        <span class="dividend-info-shell__tile-label">{{ label }}</span>
        <span class="dividend-info-shell__tile-value" />
      </div>
    </div>

    <el-divider class="dividend-info-shell__divider" />

    <p class="dividend-info-shell__section-title">下次除權息</p>
    <div class="dividend-info-shell__grid">
      <div v-for="label in FIELDS" :key="label" class="dividend-info-shell__field">
        <span class="dividend-info-shell__label">{{ label }}</span>
        <span class="dividend-info-shell__value" />
      </div>
    </div>

    <p class="dividend-info-shell__note">資料載入中</p>
  </el-card>
</template>

<style scoped>
.dividend-info-shell {
  border-radius: 12px;
}

.dividend-info-shell__title {
  font-weight: 600;
}

.dividend-info-shell__section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dividend-info-shell__divider {
  margin: 20px 0;
}

.dividend-info-shell__tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dividend-info-shell__tile {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-info-shell__tile-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dividend-info-shell__tile-value {
  height: 20px;
  width: 60%;
  border-radius: 4px;
  background: var(--el-fill-color);
}

.dividend-info-shell__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px 16px;
}

.dividend-info-shell__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dividend-info-shell__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dividend-info-shell__value {
  height: 14px;
  width: 70%;
  border-radius: 4px;
  background: var(--el-fill-color);
}

.dividend-info-shell__note {
  margin: 20px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
