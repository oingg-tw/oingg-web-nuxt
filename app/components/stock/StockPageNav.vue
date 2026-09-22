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
// so its own chrome (fixed positioning, centered-mode math, border/shadow, print-hiding) moved
// here rather than staying behind as a shell with nothing left to hold.
//
// That chrome moved on again 2026-09-22, to AppNavRail.vue, when 總經特區 became a second consumer
// （「macro-nav 能做成sidebar嗎」）— a slot wrapper with two real callers, not a mount point for a
// teleport. The two-copies-plus-CSS arrangement described above stays HERE, because only this
// component knows what the narrow-width copy of a three-level stock nav should be.
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
//
// THE PHONE COPY IS A BOTTOM SHEET（2026-09-23,「手機版的uiux要怎麼設計，才可以媲美電腦版的
// sidebar」→「底部吸附的 <details> 聽起來UIUX很棒，請這樣做吧」）.
//
// Measured first, on /stock/2330 at 375×812: the inline copy was 384px tall（eight top-level rows）
// sitting at y=346, i.e. it took 47% OF THE FIRST SCREEN before any answer, and then scrolled out
// of reach for the remaining 91% of a 4,524px page. Both halves are wrong at once — too intrusive
// where the reader wants an answer, absent everywhere they might want to move. The desktop rail's
// whole value is the opposite pair: always there, one tap to any sibling page.
//
// A native <details> pinned to the bottom edge gets both back for ~340px of first screen:
// collapsed it is a 48px bar naming the page you are on, open it is a scrollable sheet holding the
// same grouped menu. Native, so it needs no JavaScript, is keyboard-operable as shipped, and is
// not a dialog — nothing stacks on anything（this app's own rule about never opening a confirm
// over an open dialog）.
//
// WHY NOT el-drawer, which is what a bottom sheet usually is: its content is not in the SSR HTML
// until it opens, and these links ARE the site's internal link graph — check-click-depth.mjs reads
// the raw server HTML to prove every one of ~2,300 stock URLs is within three clicks of /. A
// drawer would quietly cut that. Inside a closed <details> the anchors are still in the markup.
//
// The bar is `fixed`, so it reserves no space of its own; <body> gets the padding instead, via a
// class this component sets（see main.css）— body rather than main because the footer lives
// outside <main> and would otherwise stay under the bar. `sticky` was considered and does not help: it
// it still covers the last 48px of content once the container's end scrolls into view, so the
// padding would be needed anyway, and it additionally leaves a hole where the element used to sit.
const props = defineProps<{ code: string }>()

const route = useRoute()
const activeLabel = computed(() => activeLabelFor(STOCK_NAV_ITEMS, props.code, route.path))

// The phone bar exists only while this component does. bodyAttrs rather than a scoped rule because
// the padding belongs to <body>, an ANCESTOR — scoped styles cannot reach it, and an unscoped rule
// here would apply on every page whose bundle includes this component.
useHead({ bodyAttrs: { class: 'has-stock-nav-bar' } })
</script>

<template>
  <details class="stock-page-nav-mobile">
    <summary class="stock-page-nav-mobile__bar">
      <span class="stock-page-nav-mobile__label">其他頁面</span>
      <span v-if="activeLabel" class="stock-page-nav-mobile__current">目前：{{ activeLabel }}</span>
      <span class="stock-page-nav-mobile__chevron" aria-hidden="true" />
    </summary>
    <div class="stock-page-nav-mobile__sheet">
      <StockPageNavList :code="code" vertical />
    </div>
  </details>

  <AppNavRail label="個股頁面導覽（釘選）">
    <StockPageNavList :code="code" vertical />
  </AppNavRail>
</template>

<style scoped>
/* THE PHONE BAR. Fixed to the bottom edge at every width the desktop rail does not cover, so the
   nav is reachable from anywhere in a 4,500px page instead of only its first screen. */
.stock-page-nav-mobile {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: var(--el-bg-color-overlay);
  border-top: 1px solid var(--el-border-color);
  /* Above the bar only, so the sheet reads as attached to the screen edge rather than floating. */
  box-shadow: 0 -2px 12px rgb(0 0 0 / 8%);
}

/* The whole bar is the control, so it carries the 44px touch target rather than an inner button.
   `list-item` is Safari's own default display for summary and removing it drops the disclosure
   triangle, which is wanted here — the chevron below is the affordance, and it can be animated. */
.stock-page-nav-mobile__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 16px;
  font-size: 1rem;
  cursor: pointer;
  list-style: none;
}

.stock-page-nav-mobile__bar::-webkit-details-marker {
  display: none;
}

/* Keyboard focus must be visible on the bar itself — <summary> is focusable natively and is the
   only way to open this without a pointer. */
.stock-page-nav-mobile__bar:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.stock-page-nav-mobile__label {
  font-weight: 600;
}

/* Where you ARE, not just that a menu exists. Truncates rather than wrapping the bar to two rows,
   since the bar's height is what the page's bottom padding is reserved against. */
.stock-page-nav-mobile__current {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}

/* Pushed to the right when there is no 目前 label to take the free space. */
.stock-page-nav-mobile__label:last-of-type ~ .stock-page-nav-mobile__chevron {
  margin-left: auto;
}

.stock-page-nav-mobile__chevron {
  flex: none;
  width: 10px;
  height: 10px;
  margin-left: auto;
  border-right: 2px solid var(--el-text-color-secondary);
  border-bottom: 2px solid var(--el-text-color-secondary);
  transform: rotate(-135deg) translate(-2px, -2px);
  transition: transform 0.15s ease;
}

.stock-page-nav-mobile[open] .stock-page-nav-mobile__chevron {
  transform: rotate(45deg) translate(-2px, -2px);
}

/* `dvh`, not `vh`: on iOS Safari the address bar changes the viewport and `vh` is frozen to the
   LARGEST of those, so a `vh` cap would let the sheet run under the browser chrome. */
.stock-page-nav-mobile__sheet {
  max-height: 60dvh;
  overflow-y: auto;
  border-top: 1px solid var(--el-border-color-lighter);
  /* Clears the iOS home indicator when the sheet's own last row sits at the screen edge. */
  padding-bottom: env(safe-area-inset-bottom);
}

/* The desktop rail takes over here — same 1280px split this component already used. */
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

/* Every rule that positioned the desktop rail moved to AppNavRail.vue 2026-09-22 — this
   component keeps only the rules for its own phone copy above. */
</style>
