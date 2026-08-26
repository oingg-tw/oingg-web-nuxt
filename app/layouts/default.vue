<template>
  <div class="app-shell">
    <AppPinnedSidebar />

    <StockSearchBar>
      <template #actions>
        <AppFeatureMenu />
        <div id="layout-header-actions" class="app-shell__teleport-target" />
        <!-- Hidden at >=1280px: AppPinnedSidebar shows there instead, with its own
             bottom-pinned login so the control isn't duplicated. -->
        <div class="app-shell__header-user">
          <UserMenuButton />
        </div>
      </template>
    </StockSearchBar>

    <AppMenuBar>
      <AppFeatureMenu />
      <div id="layout-menu-actions" class="app-shell__teleport-target" />
      <UserMenuButton />
    </AppMenuBar>

    <main class="app-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* Single source of truth for how page content clears the fixed search bar (top),
   AppMenuBar (bottom, mobile only), and AppPinnedSidebar (left, wide desktop only) —
   pages no longer each duplicate this padding themselves. */
.app-shell__content {
  padding: var(--app-header-height) 16px calc(88px + env(safe-area-inset-bottom));
}

@media (min-width: 768px) {
  .app-shell__content {
    padding-bottom: 20px;
  }
}

@media (min-width: 1280px) {
  .app-shell__content {
    padding-left: calc(var(--app-sidebar-width) + 16px);
  }
}

.app-shell__teleport-target {
  display: contents;
}

.app-shell__header-user {
  display: contents;
}

@media (min-width: 1280px) {
  .app-shell__header-user {
    display: none;
  }
}
</style>
