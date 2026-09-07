<script setup lang="ts">
// Standalone layout for the public/SEO landing page (/) — deliberately doesn't reuse
// desktop.vue/mobile.vue's app-shell chrome (pinned sidebar, stock search bar, health
// banner). Those exist for an already-in-the-app experience; a first-time visitor landing
// here has no watchlist/screener state to search across yet, and a sidebar full of app
// sections would bury the marketing copy this page exists to surface. See app.vue for how
// this gets selected (page meta, not the desktop/mobile viewport split every other route
// uses).
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
    <header class="landing-shell__header">
      <div class="landing-shell__header-inner">
        <AppLogo always-show-name />
        <NuxtLink to="/blog" class="landing-shell__header-link">部落格</NuxtLink>
      </div>
    </header>

    <main class="landing-shell__content">
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

.landing-shell__header-link {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-decoration: none;

  &:hover {
    color: var(--el-color-primary);
  }
}

.landing-shell__content {
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(32px + env(safe-area-inset-top)) 16px 32px;
}
</style>
