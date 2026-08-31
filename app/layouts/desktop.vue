<template>
  <div class="app-shell">
    <AppPinnedSidebar />
    <StockSearchBar />
    <AppSystemHealthBanner />

    <main class="app-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell__content {
  padding: calc(var(--app-header-height) + var(--app-banner-height)) 16px 20px calc(var(--app-sidebar-width) + 16px);
}
</style>
