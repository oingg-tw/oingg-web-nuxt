<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

// The CONTENTS of the 選單 slide-in layer — 手機版左側全螢幕圖層（2026-09-23）. Rendered by
// layouts/default.vue and layouts/landing.vue inside AppSlideLayer.vue's slot; it has neither a
// trigger nor a shell of its own.
//
// It WAS a fullscreen el-dialog until then, and that shell is gone rather than restyled, because
// two of its properties were the problem rather than its looks:
//
//   * it was wrapped in <ClientOnly>, so none of these links ever reached the server HTML. /stock/
//     2330's 409KB response contained the string `feature-menu` only inside the hydration state
//     payload. /industries lives nowhere else in the site's markup, so it was invisible to crawlers
//     outright — measured, not inferred.
//   * el-dialog teleports, and a teleported subtree runs its setup/useId() calls in a separate
//     server pass, desyncing the shared id counter against the client's document-order run. That is
//     why the ClientOnly was there at all, so removing the dialog removes the reason for it too.
//
// Its own floating "Home" button was removed earlier, 2026-09-19 (interface-complexity review): the
// docs/0_researches/退休族流暢數位瀏覽體驗的架構規範與人機工程實踐.md reference lists a floating
// corner button as a reach/discoverability anti-pattern for this audience. The one entry point is
// AppMobileHeader.vue's 選單 button — 選單/搜尋 must stay reachable below 1280px, since that is the
// only nav a phone visitor has once the desktop header hides itself.
//
// Scroll locking and Escape now belong to AppSlideLayer.vue, which owns the panel.
const { close } = useSlideLayer()
</script>

<template>
  <!-- @click 掛在這個 div 上而不是 UserMenuButton 上（2026-09-27）。UserMenuButton 是**多根節點**
       元件（四個 v-if 分支各自是頂層元素），Vue 無法自動繼承監聽器，所以掛在它身上的 @click 會被
       靜默丟掉——只在 console 留一行「Extraneous non-emits event listeners」。

       實測後果：點使用者那一塊，圖層不會關。未登入時那是登入對話框疊在還開著的全螢幕選單上，也就是
       這個 app 到處在避免的「彈窗疊彈窗」；已登入時是導航到 /profile 而選單留在上面蓋著。旁邊那些
       NuxtLink 沒有這個問題，它們渲染成真的 <a>。

       選擇冒泡而不是給 UserMenuButton 加 emits：那個元件有四個分支，每個分支都要自己 emit，而這個
       div 本來就存在、而且 CSS 已經讓按鈕佔滿整行（見下方 .feature-menu__user 的規則），幾乎沒有
       點得到卻不是按鈕的死區。 -->
  <div class="feature-menu__user" @click="close">
    <UserMenuButton show-name link-to-profile />
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
         day（「那麼換一個頁面」）to a genuine NuxtLink like every sibling in this grid,
         navigating to the end-user /appearance page instead of opening a popover in place. -->
    <NuxtLink to="/appearance" class="feature-menu__item" @click="close">
      <el-icon class="feature-menu__icon"><Setting /></el-icon>
      <span class="feature-menu__label">外觀設定</span>
    </NuxtLink>
  </div>
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

.feature-menu__item[aria-current='page'] {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.feature-menu__item[aria-current='page'] .feature-menu__icon {
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

/* Both states of UserMenuButton: the signed-out 登入 button and the signed-in avatar+name row.
   The width belongs here rather than in that component — this is the container that wants a
   full-width row, and the header wants the opposite（see UserMenuButton's own note）. */
.feature-menu__user :deep(.el-button),
.feature-menu__user :deep(.user-menu-button__trigger) {
  width: 100%;
}
</style>
