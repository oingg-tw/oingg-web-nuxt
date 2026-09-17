<script setup lang="ts">
const contentWidthMode = useContentWidthMode()
</script>

<template>
  <!-- Content emptied out 2026-09-17 per direct request ("sidebar的內容先整個刪掉") — the nav
       item list (APP_FEATURES) and UserMenuButton footer this used to render are now all
       reachable from AppHeaderMenu.vue's own AppNavMenu/外觀設定/登入 (see that file's own
       history), which made this sidebar's own copy of the same links redundant. Left as an
       empty shell rather than removed outright: desktop.vue's own content padding-left still
       reads --app-sidebar-width to reserve this exact space (see that file's own comment), so
       deleting the element entirely would need that layout math reworked too — kept separate
       since "先" (for now) reads as a staged step, not a decision on the sidebar's own fate yet. -->
  <aside class="app-pinned-sidebar" :class="{ 'app-pinned-sidebar--centered': contentWidthMode === 'centered' }" />
</template>

<style scoped>
/* Only ever mounted by layouts/desktop.vue (wide viewports), so this is unconditionally
   pinned open, no toggle, no breakpoint of its own — narrower widths get layouts/mobile.vue
   and AppFeatureMenu's floating Home button + full-screen modal instead. Sits below
   StockSearchBar (full-width across the top) rather than running the full viewport
   height. */
.app-pinned-sidebar {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: calc(var(--app-header-height) + var(--app-banner-height));
  left: 0;
  bottom: 0;
  width: var(--app-sidebar-width);
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  z-index: 5;
}

/* Centered content mode (see StockSearchBar's switch / useContentWidthMode): the sidebar
   detaches from the viewport's true edges — "if switched to centered layout, the sidebar
   should float too: capped height, clear of the top/bottom, attached to content's own left
   edge; the sidebar stays vertically centered on screen regardless of how long the content
   scrolls" (position: fixed already guarantees that last part with no separate scroll
   plumbing — it stays on-screen through any amount of document scroll on its own).
   `left` mirrors exactly where the centered content's own left edge lands (see desktop.vue's
   .app-shell__content:has(.app-shell__inner--centered): content maxes at
   --app-content-max-width inside a region left-padded sidebar-width+--app-sidebar-gap-centered
   for this sidebar) — same max(0, …) viewport-centering algebra as that padding, offset by
   this sidebar's own width plus that same gap var, which nets out to centering a total
   footprint of sidebar-width + gap + content-max-width + content's own trailing 16px
   right-padding (that last 16px is content's unrelated right-edge breathing room, not this
   gap, and stays a literal — nothing else reads it). Deriving the whole sum from the shared
   vars (rather than one hand-computed literal) means a --app-sidebar-gap-centered change in
   main.css's :root is the only edit needed to move both this sidebar and desktop.vue's
   padding-left in lockstep.
   top/transform center it against the full screen height, not just the space below the
   header — per "貼在畫面垂直置中" (centered on the SCREEN) — so max-height leaves generous
   clearance on both sides rather than being computed from the header/banner vars the
   edge-to-edge variant above uses; z-index (5) still loses to the header's (10), so on a
   short viewport where this would otherwise poke above it, the header simply draws over it
   instead of a layout break. */
.app-pinned-sidebar--centered {
  top: 50%;
  bottom: auto;
  left: max(
    0px,
    calc((100vw - (var(--app-sidebar-width) + var(--app-sidebar-gap-centered) + var(--app-content-max-width) + 16px)) / 2)
  );
  transform: translateY(-50%);
  max-height: calc(100vh - 96px);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
}

/* 列印時整個移除 — per直接要求（"用戶要print的時候 sidebar 可以移除嗎"）：導覽用的側邊欄對
   紙本輸出沒有意義（連結點不了），只會佔掉版面。desktop.vue 自己的 @media print 規則會一併
   收回內容區原本為了讓出這塊寬度而留的 padding-left。 */
@media print {
  .app-pinned-sidebar {
    display: none;
  }
}
</style>
