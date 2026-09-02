<script setup lang="ts">
const contentWidthMode = useContentWidthMode()
</script>

<template>
  <div class="app-shell">
    <!-- Self-positioned floating trigger (fixed, bottom-center) — see AppFeatureMenu's
         own styles. -->
    <AppFeatureMenu />
    <StockSearchBar />
    <AppSystemHealthBanner />

    <main class="app-shell__content">
      <div class="app-shell__inner" :class="{ 'app-shell__inner--centered': contentWidthMode === 'centered' }">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Bottom reservation clears AppFeatureMenu's floating Home button, which this layout
   always renders (covers phone widths through the medium-desktop range that still lacks
   room for a pinned sidebar). Top padding gets the same flat +16px as desktop.vue's own copy
   of this rule — see that file's own comment for why (measured 0px gap on every page,
   unified here instead of per-page). */
.app-shell__content {
  padding: calc(var(--app-header-height) + var(--app-banner-height) + 16px) 16px calc(88px + env(safe-area-inset-bottom));
}

/* Same cap as desktop.vue's own copy of this rule — a true no-op through this layout's
   entire width range (this layout never renders past 1280px, see useDeviceLayout's own
   breakpoint), kept here anyway so the two layouts agree structurally regardless of which
   one happens to be active when the switch is flipped. */
.app-shell__inner--centered {
  max-width: 1440px;
  margin: 0 auto;
}
</style>
