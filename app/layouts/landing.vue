<script setup lang="ts">
// Standalone layout for the public/SEO landing page (/) — deliberately doesn't reuse
// desktop.vue/mobile.vue's app-shell chrome for its BODY (pinned sidebar, health banner). A
// sidebar full of app sections would bury the marketing copy this page exists to surface. See
// app.vue for how this gets selected (page meta, not the desktop/mobile viewport split every
// other route uses).
//
// HEADER now reuses AppHeaderMenu.vue wholesale 2026-09-17, per direct follow-up ("landing-
// shell__header 還是拔掉吧，他跟我們Desktop版本也就差在搜尋與滿版顯示而已") — this page used to
// have its own minimal <header> (Logo + AppNavMenu, no search box/width toggle) built
// specifically to avoid those two pieces; once the two headers' only real difference narrowed
// down to just search+width-toggle, keeping a whole separate header component/CSS around for
// that one difference stopped being worth it. Search box and width toggle now appear on the
// landing page too — an accepted, explicit trade for not maintaining two near-duplicate headers.
//
// Had no <header> at all originally — the brand mark/GitHub link lived only in the footer
// (see docs/存股 SaaS 首頁 SEO 策略.md's own "頁尾語意化連結" guidance), which is still where
// the YMYL/E-E-A-T trust content (data-source attribution, financial disclaimer) that same doc
// calls for belongs. But a footer-only brand mark means a first-time visitor scrolls past the
// entire hero without seeing the site's name anywhere — reported live 2026-09-05 ("沒見到首頁
// 有網站名稱，這還叫首頁嗎"). A minimal top brand row was added first, then grown into a full
// AppNavMenu-based nav (見 git history), and now fully consolidated onto AppHeaderMenu per the
// reasoning above.
//
// Footer extracted into SharedFooter.vue (2026-09-07, per
// docs/3_audiences/前端工程師/Footer.md) — see that component's own comment for what the spec
// asked for vs. what's actually buildable right now without fabricating legal/regulatory info
// (統一編號) or linking to pages that don't exist yet (隱私權政策/服務條款).
//
// Real bug fixed 2026-09-19 (interface-complexity review, Playwright at 375px): this layout
// rendered AppHeaderMenu.vue — the DESKTOP header — at every viewport width, including phone.
// That header's el-menu has `:ellipsis="false"` and a fixed-width nav row, so below 1280px its
// items ran off the right edge of the viewport entirely; the visible items on the old 4-item set
// at 375px were just whichever ones happened to fit before the overflow, not a deliberate mobile
// nav. Fixed the same way layouts/default.vue already handles it: both AppMobileHeader.vue and
// AppHeaderMenu.vue are always in the DOM, and this file's own scoped CSS below picks exactly one
// per width — never decided from viewport state at render time (that would be a hydration
// mismatch; see layouts/default.vue's own top comment for why). AppFeatureMenu is mounted here too
// (dialog only now — see its own comment for why the floating trigger was removed 2026-09-19) so
// AppMobileHeader.vue's 選單 button has a dialog to open.
</script>

<template>
  <div class="landing-shell">
    <!-- Real gap fixed 2026-09-16 (reported live: "網站導覽呢？" → "你說有頂部說明列，可是我沒看到")
         — the whole Accesskey scheme was only added to desktop.vue/mobile.vue at first, missing
         entirely from this standalone landing layout. The always-visible AppAccesskeyBar.vue
         text bar this originally shipped with was itself REMOVED the same day per direct
         follow-up ("不要這種 app-accesskey-bar 方式。請加上功能。功能導向去網站導覽說明頁。") —
         shortcut documentation now lives at `/sitemap` (linked from SharedFooter.vue) instead.
         Alt+N (搜尋) now has a real target here too — AppHeaderMenu.vue's own search box, added
         2026-09-17 (see this file's own top comment); this skip-link/accesskey pair stays c/h
         only since AppHeaderMenu.vue owns its own Alt+N wiring internally, not duplicated here. -->
    <!-- Wrapped in a labelled <nav> (2026-09-19, same as layouts/default.vue) so the skip links
         belong to a landmark — axe `region` flagged them as content outside any landmark. -->
    <nav aria-label="快速跳轉">
      <a href="#landing-main-content" class="skip-link" accesskey="c">跳至主要內容</a>
      <!-- 外觀設定 skip-link shortcut 2026-09-17 — same pair as the app shell's own copy. -->
      <NuxtLink to="/appearance" class="skip-link">外觀設定</NuxtLink>
      <a href="#app-footer" class="skip-link" accesskey="h">跳至頁尾</a>
    </nav>

    <AppMobileHeader class="app-shell__header-mobile" />
    <AppHeaderMenu class="app-shell__header-desktop" />
    <AppFeatureMenu />

    <main id="landing-main-content" class="landing-shell__content" tabindex="-1">
      <slot />
    </main>

    <SharedFooter />
  </div>
</template>

<style scoped lang="scss">
/* AppHeaderMenu is `position: fixed` (see its own comment), unlike this file's old `position:
   sticky` custom header — a sticky header stays in normal document flow so content below it
   never needs compensating padding, but a fixed one is removed from flow entirely and would
   overlap this page's own content without it. `--app-header-height` is measured live by whichever
   header is actually visible (useHeaderHeightMeasure ignores a hidden header's 0px), same var
   layouts/default.vue's own .app-shell__content already reads for the identical reason. */
.landing-shell__content {
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(var(--app-header-height) + 32px) 16px 32px;
}

/* Which header renders: the phone header below 1280px, the desktop header at and above it — same
   pair and breakpoint as layouts/default.vue (2026-09-19; see that file's own comment for why
   viewport-driven markup would be a hydration mismatch instead of a display toggle). This layout
   has no rail, so unlike layouts/default.vue there's no rail display to also flip here. */
.landing-shell .app-shell__header-desktop {
  display: none;
}

@media (min-width: 1280px) {
  .landing-shell .app-shell__header-desktop {
    display: flex;
  }

  .landing-shell .app-shell__header-mobile {
    display: none;
  }
}
</style>
