<script setup lang="ts">
// /stock/{code}/{slug}：個股 × 指標專頁的分派（2026-09-20）。Nuxt 一個目錄只能有一個動態段，所以這個檔案接住所有登記在 METRIC_PAGES
// 的 slug，自己不畫頁面，交給 StockMetricDetailPage（目前值 → 逐期數據 → 計算依據 → 是什麼）。原本還分派徽章頁（StockBadgeDetailPage），
// 2026-11-26 那七頁搬進 METRIC_PAGES，徽章頁整套拿掉（見 shared/utils/metric-pages.ts 的檔頭）。
// 有自己路由檔的兄弟頁（dividend.vue、balance-sheet.vue…）Nuxt 會先解析，不會到這裡；登記表裡沒有的 slug 是真的 404，不畫空殼。
const route = useRoute()
if (!findMetricPage(String(route.params.slug))) throw createError({ statusCode: 404, statusMessage: 'unknown stock sub-page', fatal: true })
</script>

<template>
  <StockMetricDetailPage />
</template>
