<template>
  <div class="app-shell">
    <!-- Self-positioned floating trigger (fixed, bottom-center) — see AppFeatureMenu's
         own styles. -->
    <AppFeatureMenu />
    <StockSearchBar />
    <AppSystemHealthBanner />

    <main class="app-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* Bottom reservation clears AppFeatureMenu's floating Home button, which this layout
   always renders (covers phone widths through the medium-desktop range that still lacks
   room for a pinned sidebar). */
.app-shell__content {
  padding: calc(var(--app-header-height) + var(--app-banner-height)) 16px calc(88px + env(safe-area-inset-bottom));
}
</style>
