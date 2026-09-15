<script setup lang="ts">
const contentWidthMode = useContentWidthMode()
</script>

<template>
  <div class="app-shell">
    <a href="#main-content" class="skip-link">跳至主要內容</a>
    <AppPinnedSidebar />
    <StockSearchBar />
    <AppSystemHealthBanner />

    <main id="main-content" class="app-shell__content" tabindex="-1">
      <div class="app-shell__inner" :class="{ 'app-shell__inner--centered': contentWidthMode === 'centered' }">
        <UserEmailVerificationGate>
          <slot />
        </UserEmailVerificationGate>
        <SharedFooter match-container-width />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Top padding adds a flat 16px on top of the header/banner height so every page's own first
   heading/card gets breathing room instead of sitting flush against the fixed header's bottom
   edge — measured live across all 8 routes (dashboard/screener/watchlist/etf-zone/preferred-
   stocks/ky-stocks/day-trading/stock detail) and confirmed all shared the same 0px gap, so
   this belongs here once rather than as a per-page padding-top (tried that on dashboard.vue
   first, reverted in favor of this — see git history). Per direct user request to unify
   ("請統一每個頁面的上緣間距"). */
.app-shell__content {
  padding: calc(var(--app-header-height) + var(--app-banner-height) + 16px) 16px 20px calc(var(--app-sidebar-width) + 16px);
}

/* Centered mode gets its own, wider sidebar-to-content gap (--app-sidebar-gap-centered, 24px)
   instead of the 16px baked into the padding-left above — pinned/full-width mode keeps that
   16px unchanged. AppPinnedSidebar.vue's --centered variant reads the same var so the two
   stay in sync; see its own comment for the full gap-math derivation. */
.app-shell__content:has(.app-shell__inner--centered) {
  padding-left: calc(var(--app-sidebar-width) + var(--app-sidebar-gap-centered));
}

/* Only meaningful once the viewport is wider than this cap to begin with — on anything
   narrower, max-width simply never binds and the toggle is a no-op, which is deliberate
   (per the feature request: "是用戶視窗大小決定" — whether it visibly does anything is up to
   the user's own window size, not a separate breakpoint gate on the switch itself).
   --app-content-max-width (1440px) chosen as a common "large desktop" reference width,
   comfortably wider than Bootstrap's own largest container (1320px) to leave this data-dense
   app's wide result tables more room than a marketing-site container would. */
.app-shell__inner--centered {
  max-width: var(--app-content-max-width);
  margin: 0 auto;
}

/* 列印時移除側邊欄 — per直接要求（"用戶要print的時候 sidebar 可以移除嗎"）。側邊欄本身的
   display:none 交給 AppPinnedSidebar.vue 自己的 @media print 規則（同一份樣式規則該歸哪個
   元件管，就近原則），這裡只負責把內容區原本為了讓出側邊欄寬度而留的 padding-left 一併收回
   ——不收回的話，側邊欄消失後紙上會留一大塊沒用到的空白，不是單純藏起來就好。 */
@media print {
  .app-shell__content,
  .app-shell__content:has(.app-shell__inner--centered) {
    padding-left: 16px;
  }
}
</style>
