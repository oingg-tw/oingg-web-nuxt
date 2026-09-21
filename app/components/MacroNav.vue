<script setup lang="ts">
import { MACRO_NAV_ITEMS } from '~/utils/macro-nav'

// 總經特區's own nav — a horizontal row of real links, not the stock pages' el-menu rail.
//
// A flat row rather than that rail because this zone is flat: seven sibling pages, no groups, no
// depth. Reusing StockPageNav would have brought an el-menu, a fixed-position rail and a
// two-copies-plus-CSS arrangement, all of which exist to solve problems this zone doesn't have.
//
// Real <a href> on every destination, for the reason AppNavMenu.vue records: el-menu's router mode
// emits no anchors at all, and scripts/check-click-depth.mjs walks these hrefs to prove every
// sitemap URL is reachable. aria-current="page" comes from vue-router's own exact-active match and
// is styled with weight + underline, never colour alone.
defineProps<{ current: string }>()
</script>

<template>
  <nav class="macro-nav" aria-label="總經特區">
    <ul class="macro-nav__list">
      <li v-for="item in MACRO_NAV_ITEMS" :key="item.to">
        <NuxtLink :to="item.to" class="macro-nav__link">{{ item.label }}</NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.macro-nav__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ≥48px targets, this app's own floor for an older audience — above WCAG's 24×24. */
.macro-nav__link {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.macro-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}
</style>
