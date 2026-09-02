<script setup lang="ts">
// Shared between StockSearchBar.vue (app-shell header) and layouts/landing.vue (the public
// homepage's own header) — pulled out once this needed real logic (the desktop-only name)
// rather than each file's own plain "LOGO" placeholder text, same reasoning as
// AppGithubLink.
</script>

<template>
  <NuxtLink to="/" class="app-logo" aria-label="回首頁">
    <span class="app-logo__mark">LOGO</span>
    <!-- Desktop-only (see the media query below) — mobile doesn't have the header width to
         spare for both the mark and the full Chinese name alongside the search bar/sidebar
         trigger, so the mark alone still identifies/links home there. -->
    <span class="app-logo__name">安盈存股</span>
  </NuxtLink>
</template>

<style scoped>
.app-logo {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.app-logo__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  border: 1px dashed var(--el-color-primary);
  border-radius: 6px;
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.app-logo__name {
  display: none;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}

/* Matches useDeviceLayout.ts's own desktop breakpoint (the pinned-sidebar layout). */
@media (min-width: 1280px) {
  .app-logo__name {
    display: inline;
  }
}
</style>
