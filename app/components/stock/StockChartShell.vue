<script setup lang="ts">
// Structural-only placeholder for the stock-detail page's 4 chart cards (per-river ×2, EPS,
// revenue) — none of them have a real bff-ts endpoint yet (see stock/[code].vue's own
// comment). Per explicit user direction after the 2026-09-02 fake-data cleanup ("只做版面結構，
// 不放任何數字"): shows the shape of the eventual chart (card header, optional tab row, an
// axis/legend-like skeleton) but every visual element is a flat, muted skeleton block — no
// specific heights, values, or colors that could read as an implied real number. Deliberately
// NOT using CHART_ACCENT_GOLD or any of the real chart palette here, so this never gets
// mistaken for actual rendered data even at a glance.
withDefaults(
  defineProps<{
    title: string
    variant?: 'bars' | 'bars-line' | 'river'
    tabs?: string[]
  }>(),
  { variant: 'bars', tabs: undefined }
)
</script>

<template>
  <el-card class="chart-shell" shadow="never">
    <template #header>
      <div class="chart-shell__header">
        <span class="chart-shell__title">{{ title }}</span>
        <div v-if="tabs" class="chart-shell__tabs">
          <span v-for="(tab, index) in tabs" :key="tab" class="chart-shell__tab" :class="{ 'chart-shell__tab--active': index === 0 }">
            {{ tab }}
          </span>
        </div>
      </div>
    </template>

    <div class="chart-shell__body">
      <div class="chart-shell__plot">
        <div v-if="variant === 'river'" class="chart-shell__river">
          <div class="chart-shell__river-band" />
          <div class="chart-shell__river-band" />
          <div class="chart-shell__river-band" />
        </div>
        <div v-else class="chart-shell__bars">
          <span v-for="i in 12" :key="i" class="chart-shell__bar" />
        </div>
        <svg v-if="variant === 'bars-line'" class="chart-shell__line" viewBox="0 0 100 40" preserveAspectRatio="none">
          <polyline points="0,28 9,24 18,30 27,18 36,22 45,12 54,20 63,14 72,24 81,10 90,18 100,8" />
        </svg>
      </div>
      <div class="chart-shell__axis" />
    </div>

    <p class="chart-shell__note">資料尚未提供</p>
  </el-card>
</template>

<style scoped>
.chart-shell {
  border-radius: 12px;
}

.chart-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chart-shell__title {
  font-weight: 600;
}

.chart-shell__tabs {
  display: flex;
  gap: 4px;
}

.chart-shell__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  border: 1px solid var(--el-border-color-lighter);
}

.chart-shell__tab--active {
  border-color: var(--el-border-color);
  color: var(--el-text-color-secondary);
}

.chart-shell__body {
  height: 240px;
  display: flex;
  flex-direction: column;
}

.chart-shell__plot {
  position: relative;
  flex: 1;
  min-height: 0;
}

.chart-shell__bars {
  height: 100%;
  display: flex;
  align-items: flex-end;
  gap: 6%;
}

.chart-shell__bar {
  flex: 1;
  background: var(--el-fill-color);
  border-radius: 3px 3px 0 0;
}

/* Fixed, purely decorative height rhythm — not derived from any real figure, just enough
   variation that the shape reads as "a bar chart" rather than a flat block. */
.chart-shell__bar:nth-child(1) { height: 42%; }
.chart-shell__bar:nth-child(2) { height: 58%; }
.chart-shell__bar:nth-child(3) { height: 35%; }
.chart-shell__bar:nth-child(4) { height: 70%; }
.chart-shell__bar:nth-child(5) { height: 48%; }
.chart-shell__bar:nth-child(6) { height: 62%; }
.chart-shell__bar:nth-child(7) { height: 40%; }
.chart-shell__bar:nth-child(8) { height: 75%; }
.chart-shell__bar:nth-child(9) { height: 52%; }
.chart-shell__bar:nth-child(10) { height: 65%; }
.chart-shell__bar:nth-child(11) { height: 45%; }
.chart-shell__bar:nth-child(12) { height: 55%; }

.chart-shell__line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.chart-shell__line polyline {
  fill: none;
  stroke: var(--el-border-color);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.chart-shell__river {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 0;
}

.chart-shell__river-band {
  flex: 1;
  border-radius: 8px;
  background: var(--el-fill-color);
}

.chart-shell__river-band:nth-child(2) {
  background: var(--el-fill-color-light);
  margin: 0 6%;
}

.chart-shell__river-band:nth-child(3) {
  margin: 0 14%;
}

.chart-shell__axis {
  height: 1px;
  background: var(--el-border-color-lighter);
  margin-top: 8px;
}

.chart-shell__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
