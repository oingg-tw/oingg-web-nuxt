<script setup lang="ts">
// 公司健檢 was unpublished on 2026-09-19 (user decision:「先拿掉公司健檢，另外再設計」) — the
// 8-section document rebuilt the same morning read as 21 phone screens, one of the four places
// complexity concentrated across the site (interface-complexity review against
// docs/0_researches/退休族流暢數位瀏覽體驗的架構規範與人機工程實踐.md). Its chart components
// (StockValuationRiverChart, StockDividendCoverageChart, …) and the 'company-health' series plan
// in server/utils/stock-data.ts stay in the repo for the redesign. The URL was in the sitemap and
// indexed for a day, so it answers with a permanent redirect to the stock's index page instead of
// a 404 — a real visitor or crawler following an old link still lands somewhere useful.
const route = useRoute()
await navigateTo(`/stock/${String(route.params.code)}`, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
