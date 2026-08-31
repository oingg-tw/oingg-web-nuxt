<script setup lang="ts">
const contentWidthMode = useContentWidthMode()
</script>

<template>
  <div class="app-shell">
    <AppPinnedSidebar />
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
.app-shell__content {
  padding: calc(var(--app-header-height) + var(--app-banner-height)) 16px 20px calc(var(--app-sidebar-width) + 16px);
}

/* Only meaningful once the viewport is wider than this cap to begin with — on anything
   narrower, max-width simply never binds and the toggle is a no-op, which is deliberate
   (per the feature request: "是用戶視窗大小決定" — whether it visibly does anything is up to
   the user's own window size, not a separate breakpoint gate on the switch itself). 1440px
   chosen as a common "large desktop" reference width, comfortably wider than Bootstrap's own
   largest container (1320px) to leave this data-dense app's wide result tables more room
   than a marketing-site container would. */
.app-shell__inner--centered {
  max-width: 1440px;
  margin: 0 auto;
}
</style>
