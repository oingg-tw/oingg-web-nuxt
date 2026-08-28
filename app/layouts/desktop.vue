<template>
  <div class="app-shell">
    <AppPinnedSidebar />
    <StockSearchBar />

    <main class="app-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell__content {
  padding: var(--app-header-height) 16px 20px calc(var(--app-sidebar-width) + 16px);
}
</style>
