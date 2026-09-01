<script setup lang="ts">
import { HomeFilled } from '@element-plus/icons-vue'

// Only ever mounted by layouts/mobile.vue (narrower than 1280px) — wide desktop uses
// AppPinnedSidebar's permanently-open sidebar instead, so this has no breakpoint of its
// own to worry about anymore.
const visible = ref(false)

function close() {
  visible.value = false
}
</script>

<template>
  <el-button
    :icon="HomeFilled"
    circle
    class="feature-menu-trigger"
    title="功能選單"
    aria-label="開啟功能選單"
    @click="visible = true"
  />

  <!-- el-dialog teleports to <body>, and Vue's SSR renderer buffers teleported content
       into a separate pass that runs after the rest of the tree — so on the server this
       dialog's internal useId() calls happen AFTER every sibling that appears later in the
       template, while on the client (no such buffering — Teleport only changes where the
       DOM lands, not when the component's setup runs) they happen in normal document order,
       i.e. before those same siblings. That shifts the shared id counter differently on
       each side and desyncs any id-based component that follows (e.g. StockSearchBar's
       el-autocomplete), so this whole thing is kept out of SSR — deferring its first mount
       to just after hydration is invisible anyway since it starts closed. -->
  <ClientOnly>
    <el-dialog v-model="visible" fullscreen title="功能選單" class="feature-menu-dialog">
      <div class="feature-menu__grid">
        <NuxtLink
          v-for="feature in APP_FEATURES"
          :key="feature.key"
          :to="feature.to"
          class="feature-menu__item"
          @click="close"
        >
          <el-icon class="feature-menu__icon"><component :is="feature.icon" /></el-icon>
          <span class="feature-menu__label">{{ feature.label }}</span>
        </NuxtLink>
      </div>

      <!-- Same content AppPinnedSidebar puts in its footer — this modal is the mobile/
           medium-desktop stand-in for everything the Sidebar shows on wide desktop, not
           just the nav grid. -->
      <div class="feature-menu__footer">
        <UserMenuButton show-name link-to-profile @click="close" />
      </div>
    </el-dialog>
  </ClientOnly>
</template>

<style scoped>
/* A single floating "Home" button rather than one docked inside the search bar — the
   nav trigger lives only here now. */
.feature-menu-trigger {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 10;
  width: 56px;
  height: 56px;
  font-size: 22px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 40%);
}

/* Capped and centered so a 3-per-row icon grid doesn't stretch into uncomfortably wide
   cells on a fullscreen dialog up to 1279px — mobile widths sit well under this anyway. */
.feature-menu__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 16px;
  max-width: 480px;
  margin: 0 auto;
}

.feature-menu__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 8px;
  border-radius: 12px;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.feature-menu__item:hover {
  background: var(--el-fill-color-light);
}

.feature-menu__item.router-link-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.feature-menu__item.router-link-active .feature-menu__icon {
  color: var(--el-color-primary);
}

.feature-menu__icon {
  font-size: 28px;
  color: var(--el-color-primary);
}

.feature-menu__label {
  font-size: 16px;
  text-align: center;
}

/* margin-top: auto (a flex child in the now-column-flex dialog body below) pushes this to
   the actual bottom of the fullscreen dialog regardless of how few nav items are above it —
   before this, a short grid left it stranded right after the grid with empty space below,
   not anchored to the bottom of the screen the way "個人資料設定" being at the bottom implies. */
.feature-menu__footer {
  max-width: 480px;
  margin-top: auto;
  margin-left: auto;
  margin-right: auto;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.feature-menu__footer :deep(.el-button) {
  width: 100%;
}

/* Column flex, filling the fullscreen dialog's own height — gives .feature-menu__footer's
   margin-top: auto (above) actual free space to push against, so it lands at the real
   bottom of the screen instead of trailing right after a short nav grid. */
:deep(.feature-menu-dialog .el-dialog__body) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
</style>
