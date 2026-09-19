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

    <AppHeaderMenu />

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
   overlap this page's own content without it. `--app-header-height` is measured live by
   AppHeaderMenu itself (useHeaderHeightMeasure) regardless of which layout mounts it, same var
   desktop.vue's own .app-shell__content already reads for the identical reason. */
.landing-shell__content {
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(var(--app-header-height) + 32px) 16px 32px;
}
</style>
