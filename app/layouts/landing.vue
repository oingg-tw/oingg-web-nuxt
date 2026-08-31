<script setup lang="ts">
// Standalone layout for the public/SEO landing page (/) — deliberately doesn't reuse
// desktop.vue/mobile.vue's app-shell chrome (pinned sidebar, stock search bar, health
// banner). Those exist for an already-in-the-app experience; a first-time visitor landing
// here has no watchlist/screener state to search across yet, and a sidebar full of app
// sections would bury the marketing copy this page exists to surface. See app.vue for how
// this gets selected (page meta, not the desktop/mobile viewport split every other route
// uses).
</script>

<template>
  <div class="landing-shell">
    <header class="landing-shell__header">
      <AppLogo />
      <AppGithubLink />
    </header>

    <main class="landing-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.landing-shell__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.landing-shell__content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 16px calc(32px + env(safe-area-inset-bottom));
}
</style>
