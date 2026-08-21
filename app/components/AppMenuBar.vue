<template>
  <div class="app-menu-bar">
    <slot />
  </div>
</template>

<style scoped>
.app-menu-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 -2px 8px rgb(0 0 0 / 40%);
}

/* Desktop shows these same actions inline in StockSearchBar's row instead — one bar, not two. */
@media (min-width: 768px) {
  .app-menu-bar {
    display: none;
  }
}
</style>
