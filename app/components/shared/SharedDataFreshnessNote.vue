<script setup lang="ts">
// Factored out of StockForeignShareholdingChart.vue's own footer line ("資料來源：TWSE T86
// 報表，每日 T+1 揭露｜最新資料日期：2026-09-07") per direct request to apply the same
// freshness-labeling pattern to every other stock-detail chart card, not just that one — so
// users can tell how current each card's underlying data actually is instead of assuming
// everything is equally fresh. `asOf` is left as a plain string (not a Date) since callers
// already have their own period-label conventions (calendar dates for daily data, "YYYY Qn"
// for quarterly financial-statement data) — this component just lays out whatever they hand it.
defineProps<{
  sourceLabel: string
  asOf: string | null
}>()

// Hidden site-wide 2026-09-15 per直接要求（"卡片上的 資料來源 都先幫我隱藏吧"）——"先" reads as
// temporary, so this stays a single named flag here (every caller already renders this shared
// component) rather than deleting the markup or touching each of the ~30+ call sites; flip back
// to true to restore every card's freshness line at once.
const SHOW_DATA_SOURCE = false
</script>

<template>
  <p v-if="SHOW_DATA_SOURCE && asOf" class="data-freshness-note">
    資料來源：{{ sourceLabel }}｜最新資料：{{ asOf }}
  </p>
</template>

<style scoped>
.data-freshness-note {
  margin: 4px 8px 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
