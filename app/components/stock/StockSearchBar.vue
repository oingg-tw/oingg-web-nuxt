<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'

const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
const contentWidthMode = useContentWidthMode()

// --app-header-height in main.css is only a pre-JS fallback estimate; measure the bar's
// real rendered height once mounted so AppPinnedSidebar and the layout's content padding
// always line up with it exactly, even if this bar's own height changes later.
const barRef = ref<HTMLElement>()
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) document.documentElement.style.setProperty('--app-header-height', `${entry.target.getBoundingClientRect().height}px`)
  })
  if (barRef.value) resizeObserver.observe(barRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="barRef" class="stock-search-bar">
    <AppLogo />

    <!-- Its own flex-centering wrapper (not just justify-content on the bar itself) — the
         bar's other children (logo, and this wrapper) still need to pack left/fill normally;
         it's specifically the search input + GitHub link pair that should center as a group
         within whatever space is left after the logo, per feedback that they read better
         centered than hugging the logo's left edge. -->
    <div class="stock-search-bar__center">
      <el-autocomplete
        v-model="keyword"
        class="stock-search-bar__input"
        :fetch-suggestions="fetchSuggestions"
        placeholder="搜尋股票代號或名稱，例如 2330 或 台積電"
        clearable
        @select="handleSelect"
        @keyup.enter="handleEnter"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #default="{ item }">
          <div class="stock-search-bar__option">
            <span class="stock-search-bar__option-name">{{ item.name }}</span>
            <span class="stock-search-bar__option-code">{{ item.code }}</span>
          </div>
        </template>
      </el-autocomplete>

      <AppGithubLink />
      <!-- Commented out until there's a real LINE 官方帳號/社群 link to point it at (see
           AppLineLink.vue's own TODO). -->
      <!-- <AppLineLink /> -->
    </div>

    <!-- Own trailing element, not inside .stock-search-bar__center — that wrapper centers
         its own children as a group, so anything appended there would join the centered
         search+link cluster instead of sitting at the bar's true right edge. -->
    <label class="stock-search-bar__width-toggle" title="切換版面寬度：滿版／置中">
      <el-switch v-model="contentWidthMode" active-value="centered" inactive-value="full" size="small" />
      <span>置中版面</span>
    </label>
  </div>
</template>

<style scoped>
.stock-search-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  background: transparent;
  border-bottom: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

.stock-search-bar__center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.stock-search-bar__input {
  flex: 1;
  min-width: 0;
}

/* Desktop-only (matches useDeviceLayout's own 1280px breakpoint, the exact width where
   desktop.vue's pinned-sidebar layout takes over from mobile.vue) — the centered-vs-full
   toggle this controls is a permanent no-op below that width anyway (see both layouts'
   .app-shell__inner--centered, capped at 1440px, wider than mobile.vue ever renders), and a
   mobile header already has no room to spare for a control that would do nothing there. */
.stock-search-bar__width-toggle {
  display: none;
}

@media (min-width: 1280px) {
  .stock-search-bar__width-toggle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    white-space: nowrap;
  }
}

.stock-search-bar__option {
  display: flex;
  justify-content: space-between;
}

.stock-search-bar__option-code {
  color: var(--el-text-color-secondary);
}

</style>

<style>
/* Unscoped, not :deep() — el-autocomplete forwards the class it's given onto its own
   internal <el-input> root (confirmed: both carry .stock-search-bar__input), but NEITHER
   picks up this component's scoped data-v-* attribute the way a plain HTML element written
   directly in this template would, since they're rendered by el-autocomplete's own
   template, not this one. A scoped :deep() rule here compiles to a selector requiring that
   attribute and silently never matches anything — verified via the actual rendered
   font-size staying at 14px despite the rule being present in the stylesheet. Unscoped
   avoids the attribute requirement entirely, same fix as OrganismIndicatorPicker.vue uses
   for its own teleported-content styling.

   Element Plus's --el-font-size-base default is 14px, an accepted exception for dense
   table/form cells (see docs/accessibility-guidelines.md §1.1) — but this is the app's one
   always-visible, primary search input, not a dense data cell, so it gets the project's
   16px floor instead. 14px here would also trigger iOS Safari's auto-zoom-on-focus, which
   is disruptive on exactly the kind of always-present input this is. */
.stock-search-bar__input .el-input__inner {
  font-size: 16px;
}

/* Matches useDeviceLayout.ts's own desktop breakpoint (the pinned-sidebar layout) — a
   full-bleed single-line input reads oversized once the bar has that much room to spare
   (reported: "電腦板貼頂的滿版search好像太浮誇了"). Capped instead of stretched to fill, same
   pattern as GitHub/Linear/Notion's header search. Capping this is also what makes
   .stock-search-bar__center's justify-content: center actually center the input+GitHub-icon
   pair rather than have the input eat all the space regardless (reported follow-up: wanted
   that pair centered as a group, not hugging the logo's left edge). Mobile/narrower desktop
   keep the full-width version, which is the standard, expected pattern at that size. Unscoped
   for the same reason as the font-size rule above — el-autocomplete's root doesn't carry this
   component's scoped attribute, so a scoped rule here would silently never match. */
@media (min-width: 1280px) {
  .stock-search-bar__input {
    flex: 0 1 560px;
  }
}
</style>
