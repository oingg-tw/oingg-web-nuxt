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
   .app-pinned-sidebar--centered's own derivation, which reads a `:has()` on the content side).

   Escalated to display:none the same day, reported again（「sidebar 沒內容就整個隱藏，不然會看到
   border 一條單純懸浮在那邊」）: transparent-ing background + border-right-color only covered the
   edge-to-edge variant. The centered one below sets a FOUR-sided `border` shorthand plus a
   box-shadow, and neither was touched, so an empty sidebar still floated a rounded, shadowed
   outline next to the content. Hiding the element outright covers every decoration it has now or
   later gains, and it costs nothing structurally: this is position:fixed, so it contributes no
   layout, and the reserved width lives entirely on desktop.vue's content padding-left.
   The teleport target inside keeps existing while hidden — a display:none element still holds its
   descendants — so the moment a page teleports something in, :empty stops matching and the
   sidebar reappears on its own, with no JS and no per-page opt-in. */
.app-pinned-sidebar:has(.app-pinned-sidebar__target:empty) {
  display: none;
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
   edge-to-edge variant above uses.

   The `transform` clamp below is a FIX, not the original design — this block used to end at
   plain `transform: translateY(-50%)`, with a comment owning up to the failure mode: "z-index
   (5) still loses to the header's (10), so on a short viewport where this would otherwise poke
   above it, the header simply draws over it instead of a layout break." That was accepted as a
   decorative edge case. Reported live at 200% browser zoom with the stock-page nav fully
   expanded（「sidebar +200%時 全部展開 要可以不被 top menu 遮蓋」）: zoom doesn't shrink
   absolute-px constants (this sidebar's own 96px guess, the nav's own row heights) the way it
   shrinks the CSS-px viewport `vh` resolves against, so a fully-expanded tree's real content
   height can clear max-height by far more at 200% than 96px accounted for — and what actually
   got hidden behind the header wasn't a decorative edge, it was the FIRST NAV ITEM, unreachable.

   A `top`+`bottom`+`margin-block:auto` rewrite was tried first and reverted the same day: with
   `.app-pinned-sidebar__target`'s own `flex:1` child inside, that combination made Chromium's
   auto-height resolution STRETCH the box to max-height instead of shrink-wrapping content —
   confirmed by measuring a short, unexpanded nav at 100% zoom: 194px content-sized (correctly
   centered, screen midpoint 450) on the original code, 808px — mostly empty — under that rewrite.
   flex:1 children make an absolutely-positioned parent's own auto-height ill-defined for the
   browser to shrink-to-fit against, so the "fill the band, never overflow it" trick that
   technique is built on isn't safe to use with this shell's own child structure.

   This fix instead keeps translateY-based centering (its shrink-wrap behaviour is what the
   194px measurement confirms works) and clamps how far it may translate: normally -50% of the
   box's own height, but never further than would put the box's top edge above the header. `max()`
   picks whichever is LESS negative — for a short box, -50% (its own small height) wins and
   centering behaves exactly as before; for a box at or near max-height, the fixed floor wins and
   the top edge holds at header-bottom + gap regardless of how tall the (still max-height-capped)
   box gets. Growth past what still fits is unreachable via the outer `overflow:hidden` here, same
   as before this fix — a further step (giving `.app-pinned-sidebar__target`'s own overflow-y:auto
   room to take over instead) is worth doing but is a second, separate change, not bundled into
   this one. */
.app-pinned-sidebar--centered {
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

/* This rule does NOT actually hide the sidebar on print — kept only because removing it silently
   would look like the fix, when the real one lives elsewhere. layouts/default.vue mounts this
   component with `class="app-shell__rail"`, and that layout's own `.app-shell .app-shell__rail`
   selector (0,2,0: two classes) always outranks this component's own scoped root selector
   (0,2,0: one class + the scoped-style attribute, same total but this file's is never the later
   rule that wins a tie either) — confirmed live: with print media active and this rule matching,
   the element's own COMPUTED display still came back 'flex'. The layout is the only place that
   currently mounts this component (landing.vue does not), so there is no context where this rule
   is the deciding one; the real fix is layouts/default.vue's own `@media print` block, right next
   to the same-specificity rule that shows the rail by width in the first place. Left in place
   as a document of INTENT (this element should never print) rather than deleted, since a future
   second layout that mounts this component without that specificity trick would need exactly
   this. */
@media print {
  .app-pinned-sidebar {
    display: none;
  }
}
</style>
