<script setup lang="ts">
// 公司健檢 was unpublished on 2026-09-19 (user decision:「先拿掉公司健檢，另外再設計」) — the
// 8-section document rebuilt the same morning read as 21 phone screens, one of the four places
// complexity concentrated across the site (interface-complexity review against
// docs/0_researches/退休族流暢數位瀏覽體驗的架構規範與人機工程實踐.md).
//
// RESTORE POINT for the redesign (2026-09-20): its 28 chart/card components, SharedChartFigure,
// SharedStatRow, useMetricHistory.ts, useDupontHistory.ts and chart-palette's riverColors were
// DELETED from the tree — ~6,568 lines that no template had mounted since this page became a
// redirect, and which were keeping each other alive (useMetricHistory's only five callers were
// all orphans). They live in git at **69f774c**; bring any one back with
//   git checkout 69f774c -- app/components/stock/StockValuationRiverChart.vue
// The 'company-health' series plan in server/utils/stock-data.ts DOES stay, so the data those
// charts need is still fetchable the moment one is restored. The URL was in the sitemap and
// indexed for a day, so it answers with a permanent redirect to the stock's index page instead of
// a 404 — a real visitor or crawler following an old link still lands somewhere useful.
const route = useRoute()
await navigateTo(`/stock/${String(route.params.code)}`, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
