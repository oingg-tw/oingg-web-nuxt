<script setup lang="ts">
// The 個股頁面 link list itself — the markup StockPageNav.vue renders either in the page body
// (phone/tablet, and the server-rendered fallback on every width) or, on desktop, inside the
// left rail via Teleport (see that file). Plain `NuxtLink`s in a labelled `<nav>`, NOT
// role="tablist": these navigate to different URLs, they don't switch panels in place, so tab
// semantics would lie to assistive tech. vue-router puts `aria-current="page"` on the
// exact-active link (SSR included), so the active state needs no hand-rolled comparison; the
// styling hooks that attribute and uses weight + underline + background, never colour alone.
//
// ≥48px targets with an 8px gap (this app's own audience-driven floor, above WCAG's 24×24).
// Chinese labels only, no icons.
const props = defineProps<{
  code: string
  // Rail layout (desktop): one link per row, full width.
  vertical?: boolean
}>()

// 公司健檢 removed 2026-09-19 (see app/pages/stock/[code]/company-health.vue's own comment —
// unpublished pending a redesign), leaving 4 items.
const NAV_ITEMS = [
  { label: '亮點與風險', to: (code: string) => `/stock/${code}` },
  { label: '配股配息', to: (code: string) => `/stock/${code}/dividend` },
  { label: '指標歷史', to: (code: string) => `/stock/${code}/metrics-history` },
  { label: '財務報表', to: (code: string) => `/stock/${code}/financial-statements` }
]
</script>

<template>
  <nav class="stock-page-nav" :class="{ 'stock-page-nav--vertical': vertical }" aria-label="個股頁面">
    <ul class="stock-page-nav__list">
      <li v-for="item in NAV_ITEMS" :key="item.label" class="stock-page-nav__item">
        <NuxtLink :to="item.to(props.code)" class="stock-page-nav__link">{{ item.label }}</NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.stock-page-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-page-nav__link {
  display: inline-flex;
  align-items: center;
  min-height: 3rem;
  padding: 0 1rem;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  font-size: 1rem;
  color: var(--el-text-color-regular);
  text-decoration: none;
}

.stock-page-nav__link:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

/* Current page = the link vue-router marks exact-active. Weight + underline + tinted background
   together (not colour alone) so the state survives greyscale, forced-colors and colour-vision
   deficiencies. Text in dark-2 for extra margin over the 4.5:1 text floor (the accents
   themselves were retuned to 4.5:1 on 2026-09-19). */
.stock-page-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

/* Rail layout: a padded column of full-width rows. */
.stock-page-nav--vertical {
  padding: 16px 12px;
}

.stock-page-nav--vertical .stock-page-nav__list {
  flex-direction: column;
  gap: 4px;
}

.stock-page-nav--vertical .stock-page-nav__link {
  display: flex;
  width: 100%;
}
</style>
