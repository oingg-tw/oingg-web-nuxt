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
       deleting the element entirely would need that layout math reworked too.
       Turned into a per-page teleport TARGET the same day, same follow-up ("sidebar邏輯要改掉，
       有可能每一個page都會有自己的sidebar") — this shell no longer owns any content itself;
       whichever page is currently mounted (e.g. stock/[code].vue's own 個股瀏覽 sidebar) pushes
       its own content in via `<Teleport to="#app-pinned-sidebar-target">`, wrapped in
       `<ClientOnly>` on the page's own side (same SSR-teleport-avoidance pattern this app
       already uses for popper content — see AppHeaderMenu.vue's own el-autocomplete comment).
       Plain `id`, not a template ref, since Teleport's own `to` prop takes a CSS selector
       string, and the pages doing the teleporting are a completely different component tree
       with no ref access into this one. -->
  <aside class="app-pinned-sidebar" :class="{ 'app-pinned-sidebar--centered': contentWidthMode === 'centered' }">
    <div id="app-pinned-sidebar-target" class="app-pinned-sidebar__target" />
  </aside>
</template>

<style scoped>
/* Mounted on every width by layouts/default.vue (2026-09-19) — that layout's own CSS hides this
   below 1280px (where AppFeatureMenu's floating Home button + full-screen modal serve instead)
   and shows it pinned open, no toggle, at ≥1280px. Rendered on every width so its teleport
   target above always exists for StockPageNav.vue. Sits below the header (full-width across the
   top) rather than running the full viewport height. */
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

/* Real bug reported live 2026-09-20 ("造訪 calendar 有看到 sidebar 剩下一條線") — a direct
   side-effect of that same day's border-contrast fix (main.css's own --el-border-color-lighter
   override, #ebeef5 → #7f8690): this shell always renders even when no page teleports anything
   into its target (StockPageNav.vue is the only current teleporter — /calendar and most other
   pages push nothing in), so what used to be an invisible ~1:1 near-white border became a real,
   visible vertical line with nothing next to it once that fix landed. The width/space is kept
   reserved either way (desktop.vue's own content padding-left always accounts for it, on every
   page, not conditionally) — only the border/background go transparent when there's genuinely
   nothing inside to frame. `:has()` is already an established technique in this codebase (see
   .app-pinned-sidebar--centered's own derivation, which reads a `:has()` on the content side). */
.app-pinned-sidebar:has(.app-pinned-sidebar__target:empty) {
  background: transparent;
  border-right-color: transparent;
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
  /* Clip teleported content to the rounded shape (2026-09-20). Without this, any child with a
     full-width background paints square over the corners — which is exactly what happened when
     the 個股頁面 nav moved to el-menu: its items run edge to edge, where the old hand-rolled list
     sat inside 12px of side padding and never reached them, so the active row's tint squared off
     whichever two corners it touched (the top pair when 亮點與風險 is the current page).
     Clipping here rather than re-padding the nav fixes it for whatever gets teleported in next;
     box-shadow is painted outside the border box, so it is unaffected. */
  overflow: hidden;
}

/* Fills the shell so teleported page content (flex column of nav items, same shape the old
   __nav/__footer used to have) lays out top-to-bottom without each page having to redeclare
   this same flex:1/overflow scaffolding for itself. */
.app-pinned-sidebar__target {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
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
