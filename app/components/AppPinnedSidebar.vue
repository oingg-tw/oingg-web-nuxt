<script setup lang="ts"></script>

<template>
  <aside class="app-pinned-sidebar">
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
.app-pinned-sidebar {
  display: none;
}

/* Wide desktop only: pinned open, no toggle — narrower widths fall back to
   AppFeatureMenu's trigger + drawer/bottom-sheet instead. Sits below StockSearchBar
   (full-width across the top) rather than running the full viewport height. */
@media (min-width: 1280px) {
  .app-pinned-sidebar {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: var(--app-header-height);
    left: 0;
    bottom: 0;
    width: var(--app-sidebar-width);
    background: var(--el-bg-color);
    border-right: 1px solid var(--el-border-color-lighter);
    z-index: 5;
  }
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

.app-pinned-sidebar__icon {
  font-size: 20px;
  color: var(--el-color-primary);
}

.app-pinned-sidebar__label {
  font-size: 14px;
}
</style>
