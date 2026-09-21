<script setup lang="ts">
// 個股頁面導覽 — the links between /stock/:code's own sub-pages (the list itself is
// StockPageNavList.vue). Two real copies, always both in the SSR HTML, pure CSS decides which is
// visible — REWRITTEN 2026-09-21, replacing a `<ClientOnly><Teleport>` version that lived here
// from 2026-09-19 until a real bug was reported live（「為什麼sidebar會先出現在麵包屑上面再變成
// sidebar? 這個sidebar對於無障礙用戶來說，跳的過去嗎？該如何設計？」）.
//
// Why not fix it by making the Teleport unconditional instead of rewriting this component: tested
// directly (a throwaway layout+page mounting an unconditional `<Teleport to="#id">` into a named
// target living in a DIFFERENT component, no ClientOnly) — the SSR HTML came back with the target
// completely empty (confirmed via raw curl, not a DOM inspector guess), and hydration logged a
// real "Hydration node mismatch" / "Hydration completed but contains mismatches". Nuxt's own
// `NuxtTeleportSsrSlot` doesn't help here either — its own type declares it "only used within
// islands for slot teleport", a different, narrower feature this app doesn't use. Confirmed: Vue's
// SSR genuinely does not render Teleport content into an in-app named target during the server
// pass, whether that target lives in `document.body` (AppHeaderMenu.vue's own el-autocomplete
// popper hit the same failure mode first) or a named element in a different component.
//
// A same-request registered-state design（page writes its own code into a shared useState BEFORE
// the sidebar renders, by rendering the sidebar's mount point AFTER <main> in
// layouts/default.vue's own template）was designed next and set aside too, once a second question
// surfaced（「側欄的 DOM 位置改到 main 內容後面? 不能在前面嗎? 畢竟這樣的側邊欄是不是對於某些用戶
// 根本是絕緣的?」）: moving the rail's DOM position to AFTER all of a page's own main content would
// have made it the LAST thing a linear reader (a screen-reader user reading serially, or anyone
// tabbing straight through without a landmark jump) ever reaches, on every single page — a real
// cost for a control that exists to help visitors get around. The fix for THAT turned out not to
// need reordering anything: this list's own root is already `<nav aria-label="個股頁面">`
// (StockPageNavList.vue), and a `<nav>` is its own distinct, independently-jumpable ARIA landmark
// regardless of what element contains it — nesting it inside `<main>` costs nothing for landmark
// navigation, only the SEPARATE `<aside>` wrapper AppPinnedSidebar.vue used to provide is gone,
// which was decoration around that same `<nav>`, not a second landmark of its own.
//
// So: no Teleport, no shared registered state, no reordering — this component renders BOTH copies
// of the SAME list directly, in its own normal DOM position (right after the summary card, where
// the single copy already lived), and lets CSS alone decide which one is visible at which width,
// the same "duplicate, don't relocate" pattern layouts/default.vue already uses for its own
// AppMobileHeader/AppHeaderMenu pair. AppPinnedSidebar.vue — a generic, layout-owned shell that
// existed purely to give a page something to teleport into — is deleted in the same change;
// StockPageNav.vue was its only real consumer (confirmed: `grep` for AppPinnedSidebar's own class
// names turned up nothing but historical comments in unrelated files, no other functional use),
// so its own chrome (fixed positioning, centered-mode math, border/shadow, print-hiding) moves
// here rather than staying behind as a shell with nothing left to hold.
//
// Tab order on desktop is therefore "header → summary card's own controls → this nav (both copies
// exist, only the visible one is reachable — display:none is excluded from the tab order by every
// browser) → breadcrumb → page content", matching where the mobile copy already sat — a change
// from the OLD teleport version's "header → rail → page content" order, a tradeoff made
// deliberately for the reason above, not an oversight.
//
// 股息哪裡來 is no longer a page of its own (merged into 配股配息 2026-09-19); /f-score is
// deliberately not listed while it's a pilot (shared/utils/f-score-pilot.ts) — it's linked from
// 公司健檢's own 獲利品質 section instead.
defineProps<{ code: string }>()

const contentWidthMode = useContentWidthMode()
</script>

<template>
  <StockPageNavList :code="code" class="stock-page-nav-mobile" />

  <!-- Desktop-only, position:fixed rail — visually identical to what AppPinnedSidebar.vue used to
       render, chrome moved here verbatim (see this file's own top comment for why). Always has
       real content (StockPageNav only ever mounts on an actual stock page), so the old
       `:has(.target:empty)` hide-when-nothing-teleported-in hack is gone — there is no "empty"
       state to detect any more. -->
  <aside
    class="stock-page-nav-rail"
    :class="{ 'stock-page-nav-rail--centered': contentWidthMode === 'centered' }"
    aria-label="個股頁面導覽（釘選）"
  >
    <div class="stock-page-nav-rail__scroll">
      <StockPageNavList :code="code" vertical />
    </div>
  </aside>
</template>

<style scoped>
/* Hidden at desktop width — the rail below takes over there. Below 1280px this is the permanent,
   correct nav; nothing about it changes from before this rewrite. */
@media (min-width: 1280px) {
  .stock-page-nav-mobile {
    display: none;
  }
}

@media print {
  .stock-page-nav-mobile {
    display: none;
  }
}

/* Hidden below 1280px — the inline copy above takes over there. Sits below the header (full-width
   across the top) rather than running the full viewport height, same as AppPinnedSidebar.vue's
   own base rule did. */
.stock-page-nav-rail {
  display: none;
}

@media (min-width: 1280px) {
  .stock-page-nav-rail {
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

@media print {
  .stock-page-nav-rail {
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
.stock-page-nav-rail--centered {
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

/* Fills the rail so the nav list (flex column of items) lays out top-to-bottom and scrolls
   internally once it's taller than the rail's own max-height/viewport allowance, instead of the
   whole rail growing past the screen. */
.stock-page-nav-rail__scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* 列印時整個移除 — per直接要求（"用戶要print的時候 sidebar 可以移除嗎"，再次確認2026-09-21
   「sidebar 在print時候要全部隱藏」）：導覽用的側邊欄對紙本輸出沒有意義（連結點不了），只會佔掉
   版面。No specificity fight to win any more (unlike the old AppPinnedSidebar.vue version) —
   nothing else in the layout sets this element's own display any more, since it's no longer a
   layout-mounted, width-conditional component; the two @media print rules above (one per copy)
   are the only rules touching it. layouts/default.vue's own @media print block still resets the
   content area's padding-left, unrelated to this element's own visibility. */
</style>
