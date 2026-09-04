<script setup lang="ts">
// Shared between StockSearchBar.vue (app-shell header) and layouts/landing.vue (the public
// homepage's own header) — pulled out once this needed real logic (the desktop-only name)
// rather than each file's own plain "LOGO" placeholder text, same reasoning as
// AppGithubLink.
//
// Real mark as of 2026-09-05 (public/images/logo.png) — user supplied a raster PNG, fixed
// brand-orange color. The earlier 2026-09-02 direction was for a currentColor SVG that follows
// the user's chosen theme color; user explicitly overrode that when the actual asset arrived
// ("直接用這張 PNG，固定橘色") rather than have me redraw it as an SVG — so this does NOT
// recolor across the 7 theme colors/dark-light like the rest of the chrome does, by deliberate
// choice, not an oversight.
</script>

<template>
  <NuxtLink to="/" class="app-logo" aria-label="回首頁">
    <img src="/images/logo.png" alt="" class="app-logo__mark">
    <!-- Desktop-only (see the media query below) — mobile doesn't have the header width to
         spare for both the mark and the full Chinese name alongside the search bar/sidebar
         trigger, so the mark alone still identifies/links home there. -->
    <span class="app-logo__name">安盈存股</span>
  </NuxtLink>
</template>

<style scoped>
.app-logo {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

/* Mark is 32px tall, under the 44x44px touch-target floor for older/motor-impaired users
   (see docs/compass_artifact_.../吸引退休族群的網站首頁設計要點.md). Expands the hit area via
   an unpositioned pseudo-element instead of resizing the mark itself, since this component is
   also used inside StockSearchBar.vue's app-shell header, which measures its own height off
   these elements' actual box size — an invisible absolute-positioned overlay doesn't affect
   that measurement. */
.app-logo::before {
  content: '';
  position: absolute;
  inset: -6px;
}

.app-logo__mark {
  display: block;
  width: 32px;
  height: 32px;
  object-fit: contain;
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
