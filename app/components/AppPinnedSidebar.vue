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

/* Column, not a single row — UserMenuButton.vue's own signed-out branch now renders TWO sibling
   buttons (外觀設定 popover trigger, then a standalone 登入 button — see that component's own
   comment on why 登入 moved out of the popover panel) as a fragment, so this needs to stack them
   vertically instead of the single-button row this footer used to be. */
.app-pinned-sidebar__footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* Let every button UserMenuButton renders here (外觀設定, 登入, or the signed-in 個人資料設定
   trigger) fill the row instead of sizing to its own content — with show-name on, each carries a
   real label so a full-width button reads as a clear standalone row, not an oddly-narrow pill. */
.app-pinned-sidebar__footer :deep(.el-button) {
  width: 100%;
}

/* Real bug fixed 2026-09-14 (reported live: "外觀設定跟登入按鈕要排好喔 不可歪掉") — Element
   Plus's own default stylesheet gives consecutive `.el-button` siblings `margin-left: 12px` (its
   usual horizontal button-group spacing), and that adjacent-sibling selector still matches here
   even with the `<!--teleport-->` placeholder comment UserMenuButton's own el-popover panel
   leaves between the two buttons — comment nodes don't break a CSS sibling selector. Confirmed
   live via getBoundingClientRect(): both buttons measured the identical 214px width, but 登入 sat
   12px further right than 外觀設定 — a stray left margin, not a width mismatch. This is a column
   layout (see __footer's own flex-direction), so that horizontal spacing has no role here at all;
   zeroing it keeps every button flush against the same left edge regardless of DOM order. */
.app-pinned-sidebar__footer :deep(.el-button + .el-button) {
  margin-left: 0;
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
  font-size: 1.25rem;
  color: var(--el-color-primary);
}

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. Was 14px. */
.app-pinned-sidebar__label {
  font-size: 1rem;
}

/* 列印時整個移除 — per直接要求（"用戶要print的時候 sidebar 可以移除嗎"）：導覽用的側邊欄對
   紙本輸出沒有意義（連結點不了），只會佔掉版面。desktop.vue 自己的 @media print 規則會一併
   收回內容區原本為了讓出這塊寬度而留的 padding-left。 */
@media print {
  .app-pinned-sidebar {
    display: none;
  }
}
</style>
