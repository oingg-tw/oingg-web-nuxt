<script setup lang="ts">
const contentWidthMode = useContentWidthMode()
</script>

<template>
  <aside class="app-pinned-sidebar" :class="{ 'app-pinned-sidebar--centered': contentWidthMode === 'centered' }">
    <nav class="app-pinned-sidebar__nav">
      <NuxtLink
        v-for="feature in APP_FEATURES"
        :key="feature.key"
        :to="feature.to"
        class="app-pinned-sidebar__item"
      >
        <el-icon class="app-pinned-sidebar__icon"><component :is="feature.icon" /></el-icon>
        <span class="app-pinned-sidebar__label">{{ feature.label }}</span>
      </NuxtLink>
    </nav>

    <div class="app-pinned-sidebar__footer">
      <UserMenuButton show-name />
    </div>
  </aside>
</template>

<style scoped>
/* Only ever mounted by layouts/desktop.vue (wide viewports), so this is unconditionally
   pinned open, no toggle, no breakpoint of its own — narrower widths get layouts/mobile.vue
   and AppFeatureMenu's floating Home button + full-screen modal instead. Sits below
   StockSearchBar (full-width across the top) rather than running the full viewport
   height. */
.app-pinned-sidebar {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: calc(var(--app-header-height) + var(--app-banner-height));
  left: 0;
  bottom: 0;
  width: var(--app-sidebar-width);
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  z-index: 5;
}

/* Centered content mode (see StockSearchBar's switch / useContentWidthMode): the sidebar
   detaches from the viewport's true edges — "if switched to centered layout, the sidebar
   should float too: capped height, clear of the top/bottom, attached to content's own left
   edge; the sidebar stays vertically centered on screen regardless of how long the content
   scrolls" (position: fixed already guarantees that last part with no separate scroll
   plumbing — it stays on-screen through any amount of document scroll on its own).
   `left` mirrors exactly where the centered content's own left edge lands (see desktop.vue's
   .app-shell__content:has(.app-shell__inner--centered): content maxes at
   --app-content-max-width inside a region left-padded sidebar-width+--app-sidebar-gap-centered
   for this sidebar) — same max(0, …) viewport-centering algebra as that padding, offset by
   this sidebar's own width plus that same gap var, which nets out to centering a total
   footprint of sidebar-width + gap + content-max-width + content's own trailing 16px
   right-padding (that last 16px is content's unrelated right-edge breathing room, not this
   gap, and stays a literal — nothing else reads it). Deriving the whole sum from the shared
   vars (rather than one hand-computed literal) means a --app-sidebar-gap-centered change in
   main.css's :root is the only edit needed to move both this sidebar and desktop.vue's
   padding-left in lockstep.
   top/transform center it against the full screen height, not just the space below the
   header — per "貼在畫面垂直置中" (centered on the SCREEN) — so max-height leaves generous
   clearance on both sides rather than being computed from the header/banner vars the
   edge-to-edge variant above uses; z-index (5) still loses to the header's (10), so on a
   short viewport where this would otherwise poke above it, the header simply draws over it
   instead of a layout break. */
.app-pinned-sidebar--centered {
  top: 50%;
  bottom: auto;
  left: max(
    0px,
    calc((100vw - (var(--app-sidebar-width) + var(--app-sidebar-gap-centered) + var(--app-content-max-width) + 16px)) / 2)
  );
  transform: translateY(-50%);
  max-height: calc(100vh - 96px);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
}

/* Scrolls independently of the footer below, so the login control stays pinned to the
   bottom of the sidebar even once there are enough feature items to overflow. */
.app-pinned-sidebar__nav {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  overflow-y: auto;
}

.app-pinned-sidebar__footer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* Signed-out state: let the "登入" button (with its label, via show-name) fill the row
   instead of sizing to its own content. */
.app-pinned-sidebar__footer :deep(.el-button) {
  width: 100%;
}

.app-pinned-sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.app-pinned-sidebar__item:hover {
  background: var(--el-fill-color-light);
}

.app-pinned-sidebar__item.router-link-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.app-pinned-sidebar__item.router-link-active .app-pinned-sidebar__icon {
  color: var(--el-color-primary);
}

.app-pinned-sidebar__icon {
  font-size: 20px;
  color: var(--el-color-primary);
}

/* 16px per docs/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. Was 14px. */
.app-pinned-sidebar__label {
  font-size: 16px;
}
</style>
