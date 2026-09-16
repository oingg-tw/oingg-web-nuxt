<script setup lang="ts">
// Standalone layout for the public/SEO landing page (/) — deliberately doesn't reuse
// desktop.vue/mobile.vue's app-shell chrome (pinned sidebar, stock search bar, health
// banner). Those exist for an already-in-the-app experience; a first-time visitor landing
// here has no watchlist/screener state to search across yet, and a sidebar full of app
// sections would bury the marketing copy this page exists to surface. See app.vue for how
// this gets selected (page meta, not the desktop/mobile viewport split every other route
// uses).
//
// AppNavMenu (網站導覽/月曆/篩選) added to the header 2026-09-16 per direct request ("desktop 這邊
// 的 menu 改成我們的 AppHeaderMenu" → clarified as this file → "搜尋 滿版切換不出現沒關係 但是我
// 希望其他的功能 要出現 比如剛才說的月曆") — AppHeaderMenu.vue itself (search autocomplete + width
// toggle bundled into one fixed-position header) stays OUT, per the reasoning above about not
// burying marketing content; only the shared nav-item set is reused (see AppNavMenu.vue's own
// comment for why it's a separate component instead of just reusing AppHeaderMenu wholesale).
const route = useRoute()
//
// Had no <header> at all originally — the brand mark/GitHub link lived only in the footer
// (see docs/存股 SaaS 首頁 SEO 策略.md's own "頁尾語意化連結" guidance), which is still where
// the YMYL/E-E-A-T trust content (data-source attribution, financial disclaimer) that same doc
// calls for belongs. But a footer-only brand mark means a first-time visitor scrolls past the
// entire hero without seeing the site's name anywhere — reported live 2026-09-05 ("沒見到首頁
// 有網站名稱，這還叫首頁嗎"). Added a minimal top brand row instead of a full nav header (still
// no pinned sidebar/search bar — see the reasoning above), just enough to identify the site —
// then pinned it (position: sticky, "就貼頂") per the same-day follow-up, same visual treatment
// (semi-transparent + blur) as the app-shell's own fixed StockSearchBar.vue header. Added a
// single "部落格" link once /blog existed to link to — without it the blog would be orphaned
// from the rest of the public site (no internal link path to it at all), which defeats its own
// SEO purpose. Still not a full nav — one link, not a menu.
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
         entirely from this standalone landing layout (see this file's own top comment for why it
         doesn't reuse the app-shell chrome those two share). The always-visible AppAccesskeyBar.vue
         text bar this originally shipped with was itself REMOVED the same day per direct
         follow-up ("不要這種 app-accesskey-bar 方式。請加上功能。功能導向去網站導覽說明頁。") —
         shortcut documentation now lives at `/sitemap` (linked from SharedFooter.vue) instead.
         Alt+N (搜尋) has no real target on this page: no search input exists here at all (see
         the file's own top comment — no pinned sidebar/search bar by design), and `/sitemap`'s
         own text says so explicitly rather than implying every page supports every key. -->
    <a href="#landing-main-content" class="skip-link" accesskey="c">跳至主要內容</a>
    <a href="#app-footer" class="skip-link" accesskey="h">跳至頁尾</a>

    <header class="landing-shell__header">
      <div class="landing-shell__header-inner">
        <AppLogo always-show-name home-accesskey />
        <!-- AppNavMenu (網站導覽/月曆/篩選) shares the exact same items AppHeaderMenu.vue uses in
             the app-shell — no search box/width toggle here on purpose, see this file's own
             top comment. `部落格` stays as its own last item in the SAME el-menu (not a separate
             plain link anymore) for one consistent nav row, rather than two visually different
             nav mechanisms side by side. -->
        <el-menu mode="horizontal" router :default-active="route.path" :ellipsis="false" class="landing-shell__nav">
          <AppNavMenu />
          <el-menu-item index="/blog">部落格</el-menu-item>
        </el-menu>
      </div>
    </header>

    <main id="landing-main-content" class="landing-shell__content" tabindex="-1">
      <slot />
    </main>

    <SharedFooter />
  </div>
</template>

<style scoped lang="scss">
/* Sticky, not fixed — sticky stays in normal flow (no compensating top-padding needed on
   .landing-shell__content below it) while still pinning to the viewport top once scrolled
   past. Same semi-transparent + blur treatment as the app-shell's own fixed
   StockSearchBar.vue header, so content scrolling underneath stays legible without a hard
   edge. */
.landing-shell__header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--el-bg-color) 85%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.landing-shell__header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
}

.landing-shell__content {
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(32px + env(safe-area-inset-top)) 16px 32px;
}
</style>
