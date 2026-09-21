<script setup lang="ts">
import { STOCK_NAV_ITEMS, openGroupsFor } from '~/utils/stock-page-nav'

// The 個股頁面 link list — StockPageNav.vue mounts TWO real instances of this component (one
// inline in the page body for phone/tablet, one inside its own position:fixed rail for desktop),
// pure CSS deciding which is visible; no longer a single instance moved between them via Teleport
// (see that file's own top comment for why that was replaced 2026-09-21).
//
// REBUILT on el-menu 2026-09-20 per direct decision, after「如果估值 裡面又區分了 PER PBR 那就是
// 三層了」: the hand-rolled version handled exactly one level of children and didn't recurse, and
// the planned 配股配息 → 四季分析 → 估值 → PER/PBR is three. Depth now comes from
// StockPageNavNode.vue recursing on itself; the tree is data in app/utils/stock-page-nav.ts.
//
// What survived the rewrite, because it was load-bearing rather than decorative:
//
//   * REAL <a href> on every destination (StockPageNavNode.vue's own comment has the detail).
//     el-menu's `router` mode emits none, and check-click-depth.mjs walks these links to prove
//     every sitemap URL is within 3 clicks of /.
//   * The <nav aria-label="個股頁面"> landmark wrapping the menu, not replaced by el-menu's own
//     role="menubar": check-stock-pages.mjs asserts that exact label is in the SSR HTML, and a
//     landmark is what lets a screen-reader user jump to this region at all.
//   * ≥48px targets (this app's audience floor, above WCAG's 24×24). Element Plus runs at
//     size="small" globally at 100% text scale (useTextScale.ts), so the heights below are
//     explicit overrides, not defaults.
//   * Active state from vue-router's own aria-current="page" on the exact-active link, styled
//     with weight + underline + background — never colour alone.
//
// What deliberately CHANGED: the phone layout is now a vertical list rather than a wrapping pill
// row. el-menu has no wrapping mode, and more to the point a pill row can't express a three-level
// hierarchy at all. Taller on phones — worth watching if page length becomes a complaint again.
const props = defineProps<{
  code: string
  // Rail layout (desktop): one link per row, full width.
  vertical?: boolean
}>()

const route = useRoute()

// Read once at setup, not a live watcher: this component remounts on client-side navigation, and
// `default-openeds` is an initial-state prop anyway. Landing on /balance-sheet arrives with its
// parent group already expanded.
const defaultOpeneds = openGroupsFor(STOCK_NAV_ITEMS, props.code, route.path)
</script>

<template>
  <nav class="stock-page-nav" :class="{ 'stock-page-nav--vertical': vertical }" aria-label="個股頁面">
    <el-menu
      class="stock-page-nav__menu"
      mode="vertical"
      :default-active="route.path"
      :default-openeds="defaultOpeneds"
    >
      <StockPageNavNode v-for="item in STOCK_NAV_ITEMS" :key="item.label" :node="item" :code="props.code" />
    </el-menu>
  </nav>
</template>

<style scoped>
.stock-page-nav {
  width: 100%;
}

/* el-menu draws its own right border for the vertical mode's "attached to a panel" look; this one
   floats in the page body on phones and inside the rail on desktop, so it has no panel edge. */
.stock-page-nav__menu {
  border-right: none;
  background: transparent;
}

/* Element Plus is size="small" app-wide at 100% text scale (useTextScale.ts), which puts these
   well under the 48px this app holds itself to for an older audience. Set on both item kinds
   plus el-sub-menu's own title row, which is a separate element. */
.stock-page-nav__menu :deep(.el-menu-item),
.stock-page-nav__menu :deep(.el-sub-menu__title) {
  height: auto;
  min-height: 48px;
  line-height: 1.5;
  padding-block: 8px;
  font-size: 1rem;
  color: var(--el-text-color-primary);
}

/* Every rule below needs :deep() — the <a> lives in StockPageNavNode.vue's template, so it carries
   THAT component's scope, not this one's. Written without it at first, which made the whole block
   dead CSS: reported live as「menuitem click area 太小，變成只有超連結文字可以點擊」(2026-09-20),
   and the active row had silently lost its weight/underline too. A scoped rule reaches a child
   component's ROOT element only; anything deeper needs :deep, and this link is two levels in.

   The hit area itself is a stretched-link ::after rather than the header menu's own approach
   (AppNavMenu.vue cancels el-menu's padding with margin: 0 -20px, since a horizontal bar's padding
   is a known constant). That trick can't work here: el-menu writes a per-depth padding-left as an
   INLINE style on each nested item, so there is no single value to cancel. The overlay covers the
   whole row whatever that padding turns out to be, and leaves the indentation intact. */
.stock-page-nav__menu :deep(.el-menu-item) {
  position: relative;
}

.stock-page-nav__menu :deep(.stock-page-nav__link) {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
  color: inherit;
  text-decoration: none;
}

.stock-page-nav__menu :deep(.stock-page-nav__link)::after {
  content: '';
  position: absolute;
  inset: 0;
}

/* State carried by weight + underline + background together — colour is never the only cue. */
.stock-page-nav__menu :deep(.stock-page-nav__link[aria-current='page']) {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

.stock-page-nav__menu :deep(.el-menu-item:has(.stock-page-nav__link[aria-current='page'])) {
  background: var(--el-color-primary-light-9);
}

/* Top-level row icons（2026-09-21）. :deep() for the same reason every other rule in this block
   needs it — these live in StockPageNavNode.vue's template. Element Plus gives a menu item's own
   .el-icon a large default margin-right sized for its collapsed-rail mode; this rail never
   collapses, so the gap is set here to something proportional to the 1rem label beside it. */
.stock-page-nav__menu :deep(.stock-page-nav__icon) {
  flex-shrink: 0;
  margin-right: 8px;
  font-size: 1.125rem;
}

/* Nested levels indent per depth; el-menu's own inline padding handles the base offset. */
.stock-page-nav__menu :deep(.el-menu .el-menu-item),
.stock-page-nav__menu :deep(.el-menu .el-sub-menu__title) {
  background: transparent;
}
</style>
