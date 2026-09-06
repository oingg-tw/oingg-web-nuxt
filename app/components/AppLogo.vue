<script setup lang="ts">
// Shared between StockSearchBar.vue (app-shell header) and layouts/landing.vue (the public
// homepage's own header) — pulled out once this needed real logic (the desktop-only name)
// rather than each file's own plain "LOGO" placeholder text, same reasoning as
// AppGithubLink.
//
// Mark updated 2026-09-06 to public/images/logo.svg — a vector redraw of the brand mark
// (matches the new favicon.ico), fixed gold fill baked into the SVG itself (not currentColor),
// same deliberate "doesn't recolor across theme colors" choice as the raster PNG it replaces.
withDefaults(defineProps<{
  // Default (false) hides the name below 1280px — correct for StockSearchBar.vue's dense
  // app-shell header, which is genuinely short on width there (search bar/sidebar trigger
  // competing for space). landing.vue's own top brand row has no such competition, and hiding
  // the site's name on every viewport under 1280px there is exactly what caused a visitor to
  // ask "沒見到首頁有網站名稱" (2026-09-05) — so it opts into always showing the name instead.
  alwaysShowName?: boolean
}>(), {
  alwaysShowName: false
})
</script>

<template>
  <NuxtLink to="/" class="app-logo" :class="{ 'app-logo--always-show-name': alwaysShowName }" aria-label="回首頁">
    <img src="/images/logo.svg" alt="" class="app-logo__mark">
    <!-- Desktop-only by default (see the media query below) — mobile doesn't have the header
         width to spare for both the mark and the full Chinese name alongside the search
         bar/sidebar trigger, so the mark alone still identifies/links home there.
         alwaysShowName overrides that for contexts with no such competing chrome. -->
    <span class="app-logo__name">安盈選股</span>
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

.app-logo--always-show-name .app-logo__name {
  display: inline;
}
</style>
