<script setup lang="ts">
// 個股頁面導覽 — the links between /stock/:code's own sub-pages, rendered as plain server-side
// markup inside <main> on EVERY width (2026-09-19, the stock-detail a11y/SEO redesign). Replaces
// StockDetailSidebarNav.vue, which was `<ClientOnly>` + `<Teleport v-if="isWide">` into the
// desktop layout's fixed left rail — and therefore (a) absent from the SSR HTML entirely, so no
// crawler ever saw a link between these pages, and (b) absent on mobile entirely, so a phone user
// had no way to reach 公司健檢/指標歷史/財務報表 at all. Worse for (a) than it looks: a first-ever
// visitor with no `layout-wide` cookie — which is every crawler — is SSR'd with the MOBILE shell
// regardless of viewport (see useDeviceLayout.ts), so nothing placed in the desktop rail can ever
// be crawlable by construction. Anything that must be indexable has to live here, in the page body.
//
// Plain `NuxtLink`s in a `<nav>`, NOT `role="tablist"` — these navigate to different URLs, they
// don't switch panels in place, so tab semantics would lie to assistive tech. vue-router already
// puts `aria-current="page"` on the exact-active link (SSR included), so the active state needs no
// hand-rolled `route.path ===` comparison; the styling below hooks that attribute directly and
// uses weight + underline + background, never colour alone.
//
// Static, not sticky — the desktop company-health page already stacks a fixed app header, the
// summary card's own sticky bar and a sticky section nav; a fourth pinned layer would take a
// third of a 768px viewport at 120% text scale. ≥48px targets with an 8px gap (this app's own
// audience-driven floor, above WCAG's 24×24), wrapping at narrow widths rather than hiding
// overflow. Chinese labels only, no icons.
//
// 配股配息 is back in this list (it had been removed from the old sidebar 2026-09-19 "先" —
// temporarily — leaving a finished, high-search-volume page with zero inbound links). 股息哪裡來 is
// no longer a page of its own: its cash-chain equation cards were merged into 配股配息 the same
// day, once the A/B comparison on the former /dividend-source route was decided.
//
// `/stock/{code}/f-score` (the per-stock methodology page template) exists but is deliberately
// NOT listed while it's a pilot (shared/utils/f-score-pilot.ts) — it's linked from 公司健檢's own
// 獲利品質 section instead, and joins this list once the pilot is widened.
const props = defineProps<{ code: string }>()

const NAV_ITEMS = [
  { label: '亮點與風險', to: (code: string) => `/stock/${code}` },
  { label: '配股配息', to: (code: string) => `/stock/${code}/dividend` },
  { label: '公司健檢', to: (code: string) => `/stock/${code}/company-health` },
  { label: '指標歷史', to: (code: string) => `/stock/${code}/metrics-history` },
  { label: '財務報表', to: (code: string) => `/stock/${code}/financial-statements` }
]
</script>

<template>
  <nav class="stock-page-nav" aria-label="個股頁面">
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
   deficiencies. Text in dark-2, not the raw accent: bold 16px on the light-9 tint measured
   3.85:1 for GOLD (axe, 2026-09-19), under the 4.5:1 text floor — see StockCardTitle.vue's
   badge-link comment. The border keeps the accent itself (a 3:1 UI-component boundary). */
.stock-page-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}
</style>
