<script setup lang="ts">
import type { StockBreadcrumbItem } from '~/composables/stock/useStockPageSeo'

// Visible breadcrumb for /stock/:code pages (2026-09-19) — the same item list
// useStockPageSeo.ts emits as BreadcrumbList JSON-LD, so the trail search engines are told about
// is exactly the one users and assistive tech can see and follow. An <ol> inside
// <nav aria-label="麵包屑"> (this page also has「個股頁面」and the app header's own nav, so every
// <nav> carries a distinct label); the current page is plain text with aria-current="page", not a
// self-link. Separators are aria-hidden spans, not CSS generated content, so no screen reader ever
// announces a stray「›」.
defineProps<{
  items: StockBreadcrumbItem[]
}>()
</script>

<template>
  <nav class="stock-breadcrumb" aria-label="麵包屑">
    <ol class="stock-breadcrumb__list">
      <li v-for="(item, index) in items" :key="item.to" class="stock-breadcrumb__item">
        <span v-if="index > 0" class="stock-breadcrumb__separator" aria-hidden="true">›</span>
        <NuxtLink v-if="index < items.length - 1" :to="item.to" class="stock-breadcrumb__link">{{ item.label }}</NuxtLink>
        <span v-else class="stock-breadcrumb__current" aria-current="page">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.stock-breadcrumb__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-breadcrumb__item {
  display: inline-flex;
  align-items: center;
}

.stock-breadcrumb__separator {
  padding: 0 8px;
}

/* Underlined, and a ≥48px-tall hit area via line-height + padding (this app's own touch-target
   floor) without making the row itself look 48px tall. dark-2 rather than the raw accent for the
   text colour: 16px text needs 4.5:1 and the GOLD accent measures 3.84:1 on the page background
   (axe, 2026-09-19) — see StockCardTitle.vue's badge-link comment. */
.stock-breadcrumb__link {
  padding: 12px 0;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.stock-breadcrumb__current {
  padding: 12px 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
