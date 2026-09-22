<script setup lang="ts">
// The desktop-only, position:fixed navigation rail — the SHELL only. What goes in it is the
// caller's business; this owns the chrome (fixed positioning, centered-mode geometry, internal
// scrolling, print removal) and nothing else.
//
// Extracted from StockPageNav.vue 2026-09-22 when 總經特區 became a second consumer（「macro-nav
// 能做成sidebar嗎」）. Every line of CSS below moved from there verbatim, including two fixes that
// cost real debugging and must not be re-derived by a second copy:
//
//   * the `transform: translateY(max(...))` clamp, which stops the rail's first nav item from
//     hiding behind the header at 200% browser zoom (reported live 2026-09-20)
//   * the centered-mode `left` algebra, which mirrors layouts/default.vue's own padding-left from
//     the same shared vars so the two move together when --app-sidebar-gap-centered changes
//
// This is NOT a revival of AppPinnedSidebar.vue, deleted the day before. That component existed to
// give a page something to `<Teleport>` into, and the teleport itself was the bug (Vue's SSR does
// not render Teleport content into an in-app named target — see StockPageNav.vue's own comment for
// the measurements). This one renders its slot directly, in the caller's own DOM position; it is
// shared CSS with two real consumers, not a layout-owned mount point.
//
// Callers still render their own second, inline copy of the list for narrow widths and hide one of
// the two with CSS. That split stays with the caller because only the caller knows what its narrow
// layout should look like — a wrapping pill row for 總經特區's seven flat siblings, a full vertical
// tree for 個股頁面's three-level one.
defineProps<{
  // Names the landmark. Both copies of a nav are landmarks; this one says it is the pinned one.
  label: string
}>()

const contentWidthMode = useContentWidthMode()
</script>

<template>
  <aside
    class="app-nav-rail"
    :class="{ 'app-nav-rail--centered': contentWidthMode === 'centered' }"
    :aria-label="label"
  >
    <div class="app-nav-rail__scroll">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
/* Hidden below 1280px — the caller's own inline copy takes over there. Sits below the header
   (full-width across the top) rather than running the full viewport height. */
.app-nav-rail {
  display: none;
}

@media (min-width: 1280px) {
  .app-nav-rail {
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
}

/* 列印時整個移除 — per直接要求（"用戶要print的時候 sidebar 可以移除嗎"，再次確認 2026-09-21
   「sidebar 在print時候要全部隱藏」）：導覽用的側邊欄對紙本輸出沒有意義（連結點不了），只會佔掉
   版面。layouts/default.vue's own @media print block separately collapses the content area's
   padding-left, which is reserved unconditionally and so needs resetting whether a rail is on the
   page or not. */
@media print {
  .app-nav-rail {
    display: none;
  }
}

/* Centered content mode (see StockSearchBar's switch / useContentWidthMode): the rail detaches
   from the viewport's true edges — "if switched to centered layout, the sidebar should float too:
   capped height, clear of the top/bottom, attached to content's own left edge; the sidebar stays
   vertically centered on screen regardless of how long the content scrolls" (position: fixed
   already guarantees that last part with no separate scroll plumbing — it stays on-screen through
   any amount of document scroll on its own).
   `left` mirrors exactly where the centered content's own left edge lands (see layouts/default.vue's
   .app-shell__content--centered: content maxes at --app-content-max-width inside a region
   left-padded sidebar-width+--app-sidebar-gap-centered for this rail) — same max(0, …)
   viewport-centering algebra as that padding, offset by this rail's own width plus that same gap
   var, which nets out to centering a total footprint of sidebar-width + gap + content-max-width +
   content's own trailing 16px right-padding (that last 16px is content's unrelated right-edge
   breathing room, not this gap, and stays a literal — nothing else reads it). Deriving the whole
   sum from the shared vars (rather than one hand-computed literal) means a
   --app-sidebar-gap-centered change in main.css's :root is the only edit needed to move both this
   rail and the layout's own padding-left in lockstep.
   top/transform center it against the full screen height, not just the space below the header —
   per "貼在畫面垂直置中" (centered on the SCREEN) — so max-height leaves generous clearance on
   both sides rather than being computed from the header/banner vars the edge-to-edge variant above
   uses.

   The `transform` clamp below is a fix, not the original design — this block used to end at plain
   `transform: translateY(-50%)`, which could put the rail's own top edge above the header on a
   short viewport or at high browser zoom (200% zoom with the nav fully expanded, reported live
   2026-09-20 — zoom doesn't shrink absolute-px constants the way it shrinks the CSS-px viewport
   `vh` resolves against, so a fully-expanded tree's real content height could clear max-height by
   far more than expected, and what got hidden behind the header was the FIRST NAV ITEM,
   unreachable). `max()` picks whichever is LESS negative — for a short box, -50% (its own small
   height) wins and centering behaves as plain centering; for a box at or near max-height, the
   fixed floor wins and the top edge holds at header-bottom + gap regardless of how tall the
   (still max-height-capped) box gets.

   A `top`+`bottom`+`margin-block:auto` rewrite (centering that also naturally fills the available
   band instead of overflowing it) was tried and reverted the same day: with this rail's own
   flex:1 scroll child inside, that combination made Chromium's auto-height resolution STRETCH the
   box to max-height instead of shrink-wrapping content — confirmed by measuring a short,
   unexpanded nav at 100% zoom: 194px content-sized (correctly centered) on the translateY version,
   808px — mostly empty — under that rewrite. flex:1 children make an absolutely-positioned
   parent's own auto-height ill-defined for the browser to shrink-to-fit against, so that
   "fill the band, never overflow it" trick isn't safe to use with this rail's own child structure. */
.app-nav-rail--centered {
  top: 50%;
  bottom: auto;
  left: max(
    0px,
    calc((100vw - (var(--app-sidebar-width) + var(--app-sidebar-gap-centered) + var(--app-content-max-width) + 16px)) / 2)
  );
  transform: translateY(max(-50%, calc(var(--app-header-height) + var(--app-banner-height) + 16px - 50vh)));
  max-height: calc(100vh - 96px);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
  /* Clip content to the rounded shape — el-menu's items run edge to edge, so without this the
     active row's own background tint would paint square over the corners it touches. */
  overflow: hidden;
}

/* Fills the rail so the nav list lays out top-to-bottom and scrolls internally once it's taller
   than the rail's own max-height/viewport allowance, instead of the whole rail growing past the
   screen. */
.app-nav-rail__scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
