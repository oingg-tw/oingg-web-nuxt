<script setup lang="ts">
// 個股頁面導覽 — the links between /stock/:code's own sub-pages (the list itself is
// StockPageNavList.vue). Two homes, one component:
//
// - Server-rendered, in the page body, on EVERY width: that is the `#fallback` below — what a
//   crawler and a no-JS visitor get, in DOM order right after the summary card. (The previous
//   desktop-only sidebar was `<ClientOnly>` + `<Teleport v-if="isWide">` and therefore never in
//   the SSR HTML at all, and absent on mobile entirely.)
// - After hydration on a wide viewport (≥1280px, useIsWideLayout's live matchMedia value), the
//   same list is teleported into the desktop rail (AppPinnedSidebar.vue's
//   `#app-pinned-sidebar-target`) as a vertical column — per direct decision 2026-09-19（「我本來
//   想的是 stock-page-nav 那一排會用 sidebar 呈現」）. On narrower viewports the Teleport is
//   `disabled`, which renders the list in place, i.e. exactly where the fallback was. The rail
//   element exists on every width since layouts/default.vue (hidden by CSS below 1280px), so the
//   target is always there; resizing across the breakpoint moves the list live.
//
// Tab order on desktop follows the visual order — header → rail (these links) → page content —
// because layouts/default.vue mounts the rail between the header and <main>.
//
// `.stock-page-nav-fallback { display: none }` at ≥1280px — added 2026-09-21 after a real bug
// reported live（「為什麼sidebar會先出現在麵包屑上面再變成sidebar? 這個sidebar對於無障礙用戶來
// 說，跳的過去嗎？」）. `<ClientOnly>`'s fallback renders unconditionally, before Vue has run at
// all, so on a wide viewport EVERY visitor briefly gets the fallback's un-styled, full-width copy
// sitting inside <main> — ahead of the breadcrumb, ahead of the page's own <h2> content — until
// hydration finishes and the Teleport above fires. Measured live: with CPU throttled 6× (a stand-
// in for a slower device, not a synthetic worst case), that window still hadn't resolved 3 seconds
// after DOMContentLoaded. Two real consequences, not just a visual flash: (1) the "跳至主要內容"
// skip link (Alt+C) targets <main> itself, which sits BEFORE this fallback in DOM order — it does
// NOT skip past this per-page nav, so a keyboard user who activates it still tabs into these links
// before reaching the breadcrumb or real content; (2) on a slow device that window is long enough
// to plausibly interact with content that's about to relocate under the visitor.
//
// A rewrite to two permanent, teleport-free DOM copies (matching layouts/default.vue's own
// `.app-shell__header-desktop`/`.app-shell__header-mobile` pattern — both always in the DOM, CSS
// picks which is visible, nothing ever moves) was considered and set aside for this pass: that
// would need an UNCONDITIONAL Teleport into a layout-owned target active during SSR itself, and
// this app has an existing, documented reason to distrust SSR + Teleport-to-selector (see
// AppHeaderMenu.vue's own el-autocomplete comment on the same constraint for popper content) —
// worth it as a follow-up, not worth the added SSR risk bundled into today's fix.
// `display: none` is the right tool for BOTH halves of the bug at once, not just the visual one:
// browsers and every screen reader already exclude display:none content from both the tab order
// and the accessibility tree, so hiding the fallback at desktop width also means a keyboard user
// landing on <main> via the skip link no longer lands in front of it — their very next Tab goes
// straight to the breadcrumb. Below 1280px this rule never matches (mobile's own copy IS the
// permanent, correct nav — nothing to hide), so nothing changes there.
const props = defineProps<{ code: string }>()

const isWide = useIsWideLayout()
</script>

<template>
  <ClientOnly>
    <Teleport to="#app-pinned-sidebar-target" :disabled="!isWide">
      <StockPageNavList :code="props.code" :vertical="isWide" />
    </Teleport>
    <template #fallback>
      <div class="stock-page-nav-fallback">
        <StockPageNavList :code="props.code" />
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
@media (min-width: 1280px) {
  .stock-page-nav-fallback {
    display: none;
  }
}
</style>
