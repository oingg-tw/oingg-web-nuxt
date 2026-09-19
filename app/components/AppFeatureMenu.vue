<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

// Mounted on every width by layouts/default.vue and layouts/landing.vue — this component is now
// JUST the fullscreen dialog; it has no trigger of its own. Its own floating "Home" button
// (fixed bottom-center circle, shown below 1280px) was removed 2026-09-19 (interface-complexity
// review): the docs/0_researches/退休族流暢數位瀏覽體驗的架構規範與人機工程實踐.md reference this
// review measured against lists a floating corner button as a reach/discoverability anti-pattern
// for the target audience. The one entry point now is AppMobileHeader.vue's own 選單 button (icon
// + visible text, in the normal header flow) calling useFeatureMenu().open() — 選單/搜尋 need to
// stay reachable below 1280px regardless, since that's the only nav a phone visitor has left once
// the desktop header hides itself.
//
// visible is shared (useFeatureMenu), not a local ref — AppMobileHeader.vue's own trigger controls
// the same dialog instance rather than each owning their own.
const { visible, close } = useFeatureMenu()

// lock-scroll="false" + useScrollLock below, not el-dialog's own default scroll lock —
// Element Plus's lock-scroll sets overflow-y: hidden on <body>, which shifts content width
// even with scrollbar-gutter: stable applied. Reported live specifically via this dialog's own
// trigger: "點擊 feature-menu-trigger 打開彈窗 的時候會因為 scrollbar的隱藏顯示 造成畫面抖動".
// useScrollLock blocks background scroll by intercepting wheel/touchmove instead, never
// touching overflow/scrollbar rendering at all.
useScrollLock(visible)
</script>

<template>
  <!-- append-to-body: without it, el-dialog defaults to appendToBody: false and renders
       inline in place instead of teleporting to <body> despite what its name suggests — this
       dialog happened to still look correct without it (fullscreen, and not nested inside
       anything with backdrop-filter/transform the way AppMobileHeader.vue's own search dialog
       was), but added here for real anyway now that a real bug from the same missing prop
       showed up on that sibling dialog (see its own comment for the full "trapped inside a
       tiny containing block" explanation) — no reason to leave this one relying on the same
       lucky non-nesting instead of being explicit.
       ClientOnly, separately: el-dialog's teleported content buffers differently between SSR
       and client — Vue's server renderer runs a teleported subtree's setup/useId() calls in a
       separate pass AFTER the rest of the tree, while the client (no such buffering) runs them
       in normal document order, i.e. before those same later siblings. That shifts the shared
       id counter differently on each side and desyncs any id-based component that follows
       (e.g. StockSearchBar's el-autocomplete), so this whole thing is kept out of SSR —
       deferring its first mount to just after hydration is invisible anyway since it starts
       closed. -->
  <ClientOnly>
    <el-dialog v-model="visible" append-to-body :lock-scroll="false" fullscreen title="功能選單" class="feature-menu-dialog">
      <!-- Moved ahead of the nav grid per direct request ("grid system前面放用戶功能") — was
           previously a footer entry below the grid, hidden on mobile entirely ("手機板請隱藏
           feature-menu__footer"). Same content AppPinnedSidebar puts in its own footer — this
           modal is the mobile/medium-desktop stand-in for everything the Sidebar shows on wide
           desktop, not just the nav grid. -->
      <div class="feature-menu__user">
        <UserMenuButton show-name link-to-profile @click="close" />
      </div>

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

        <!-- Added 2026-09-16 per direct request ("功能選單要把 顏色變更 主題變更等等選項放上去"),
             first as its own full inline panel below the grid ("外觀設定請放在 各種功能按鈕的
             下面"), then restyled to match every other entry as a popover-triggering button
             ("外觀設定請比照其他功能，製作一個按鈕放在功能選單") — then changed again the same
             day ("手機版的外觀設定 按鈕按下以後 引導到 設計系統稽核" turned out to be a feature
             request, not a bug report: "我這邊是提需求，我希望跳去design", then "其實我想要的是
             別的" once /design itself — internal, noindex, never linked from any nav — was ruled
             out, then "那麼換一個頁面" + "功能要類似這設計系統") to a genuine NuxtLink like every
             sibling in this grid, navigating to a real end-user-facing /appearance page (built
             the same day, modeled visually on /design's own swatch-button style but without its
             WCAG-audit/component-preview sections, which are internal tooling only) instead of
             opening a popover in place. -->
        <NuxtLink to="/appearance" class="feature-menu__item" @click="close">
          <el-icon class="feature-menu__icon"><Setting /></el-icon>
          <span class="feature-menu__label">外觀設定</span>
        </NuxtLink>
      </div>
    </el-dialog>
  </ClientOnly>
</template>

<style scoped>
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

/* border/background/font reset (a plain <button> briefly used this same class as 外觀設定's own
   popover trigger — since reverted to a NuxtLink like every sibling here, see that item's own
   template comment — but the reset is harmless on an anchor too, so left in place rather than
   pulled back out). */
.feature-menu__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 20px 8px;
  border: none;
  border-radius: 12px;
  background: none;
  color: var(--el-text-color-primary);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
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
  font-size: 1.75rem;
  color: var(--el-color-primary);
}

.feature-menu__label {
  font-size: 1rem;
  text-align: center;
}

/* Now shown (was hidden on mobile via display:none until direct request moved it ahead of the
   grid instead — see the template's own comment) — a bottom border stands in for the visual
   separation a literal footer position used to give it for free. */
.feature-menu__user {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.feature-menu__user :deep(.el-button) {
  width: 100%;
}

:deep(.feature-menu-dialog .el-dialog__body) {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
</style>
