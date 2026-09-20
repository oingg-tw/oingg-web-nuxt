<script setup lang="ts">
// /stock/{code}/{slug} — the dispatcher for BOTH per-stock × per-metric page families
// (2026-09-20). Nuxt allows one dynamic segment per directory, so this single file has to cover
// them; what it deliberately does NOT do is render either page itself. The two templates live in
// their own components and share nothing but this route:
//
//   BADGE_PAGES  → StockBadgeDetailPage.vue   目前值 → 計算依據 → 優點與限制 → 是什麼
//   METRIC_PAGES → StockMetricDetailPage.vue  目前值 → 逐期數據 → 怎麼看 → 是什麼
//
// Split per direct decision（「我認為把徽章與指標頁面區分成兩個模板會比較容易些」）: a badge page's
// spine is a published threshold and the audit trail behind one number, a metric page's is a
// value and its history. One template covering both would be `v-if="isBadge"` in every section.
//
// A static sibling route (dividend.vue, balance-sheet.vue, …) always wins over this file, so those
// slugs never arrive here. Anything else that matches neither registry throws a REAL 404 rather
// than rendering an empty shell — a typo'd URL behaves the same whether it lands here or on a
// named route.
const route = useRoute()
const slug = computed(() => String(route.params.slug))

// Dev-only: a slug claimed by both registries would silently render whichever branch is tested
// first and make the other page unreachable, with no error anywhere. Cheap to check, and it can
// only ever fire on a registry edit, so it stays out of the production bundle's hot path.
if (import.meta.dev) assertMetricPagesDisjoint()

const metricPage = computed(() => findMetricPage(slug.value))
// `ownRoute` badges (f-score) are rejected as hard as an unknown slug: their own static route
// file wins first so this is unreachable in practice, but rendering one with the generic badge
// template would silently drop the content its own page exists for.
const badgePage = computed(() => {
  const page = findBadgePage(slug.value)
  return page && !page.ownRoute ? page : null
})

if (!metricPage.value && !badgePage.value) throw createError({ statusCode: 404, statusMessage: 'unknown stock sub-page', fatal: true })
</script>

<template>
  <StockMetricDetailPage v-if="metricPage" />
  <StockBadgeDetailPage v-else />
</template>
