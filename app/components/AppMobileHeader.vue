<script setup lang="ts">
import { Menu, Search } from '@element-plus/icons-vue'

// 手機頁首——layouts/default.vue 在每個寬度都掛它（CSS 在 ≥1280px 藏起來、改顯示 AppHeaderMenu）。2026-09-06 從單一共用元件
// 拆出（「手機板的行為 與 電腦版的行為落差滿大的」）；2026-09-19 起根元素是 <header>，同桌機。
// 兩個角落按鈕都開「全螢幕滑入圖層」而不是對話框（2026-09-23，「比照元大券商軟體」）：方向跟按鈕同側——選單在左上，圖層從左
// 進、把頁面推右；搜尋在右上則相反。左側原本是回首頁的 AppLogo，改成選單觸發；右側收成一個搜尋圖示。
// 這個檔案不再擁有對話框、捲動鎖或路由 watcher：圖層由版面渲染（它得是滑動舞台的兄弟，不然這個頁首的 backdrop-filter 會把
// fixed 子元素困在 65px 的盒子裡），AppSlideLayer 管捲動鎖與 Escape，useSlideLayer 管讓手機返回鍵關圖層的 history entry。
const { toggle } = useSlideLayer()

// Closing on navigation still has to happen — a link inside a layer routes without unmounting
// this header. It lives here rather than in the composable because `useRoute` belongs to a
// component's setup, and this is the one component both layers' triggers share.
const { close: closeSlideLayer } = useSlideLayer()
const route = useRoute()
watch(() => route.fullPath, () => {
  closeSlideLayer()
})

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)
</script>

<template>
  <header ref="barRef" class="mobile-header">
    <!-- Icon + visible text, not icon-only, since 2026-09-19 (interface-complexity review): a
         bare icon circle failed the reference doc's "every functional icon needs a text label"
         rule, and its comment claiming "44px circle size" below was never true — Element Plus's
         own small-size circle button is a fixed 32px (main.css's own .el-button--small.is-circle
         rule). min-height is now set explicitly rather than inherited from a size variant. -->
    <el-button class="mobile-header__btn" @click="toggle('menu')">
      <el-icon aria-hidden="true"><Menu /></el-icon>選單
    </el-button>
    <!-- Two equal flex: 1 spacers (not one) bracket the logo, not just push it right — since
         the menu/search buttons on either end are the same 44px circle size, this centers the
         logo/name group exactly in the header's remaining space, matching "logo/站名 請水平
         置中" rather than just left-aligning it after the menu button. -->
    <div class="mobile-header__spacer" />
    <!-- always-show-name: without it AppLogo hides the "安盈選股" text below 1280px (correct
         default for the app-shell's OWN dense header, which competes for space with a search
         bar/sidebar trigger there — see AppLogo.vue's own comment) — this header has no such
         competing chrome, and landing.vue's sticky header already opts into the same override
         for the identical reason. -->
    <AppLogo always-show-name home-accesskey class="mobile-header__logo" />
    <div class="mobile-header__spacer" />
    <!-- accesskey="s"（2026-09-16 是 n，2026-10-08 改成無障礙規範 2.0 慣例的 S；配置見 pages/sitemap.vue）：這顆按鈕本來就做 Alt+S 要做的事（開搜尋圖層），不像桌機的
         內嵌輸入框得另放一顆隱藏的觸發鈕（見 AppHeaderMenu）。 -->
    <el-button class="mobile-header__btn" accesskey="s" title="搜尋區塊" @click="toggle('search')">
      <el-icon aria-hidden="true"><Search /></el-icon>搜尋
    </el-button>

</header>
</template>

<style scoped>
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  /* 半透明而不是全透明——同 AppHeaderMenu（那邊的註解記了「searchbar跑版了」那次）。 */
  background: color-mix(in srgb, var(--el-bg-color) 65%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

/* flex-shrink: 0 — .mobile-header has no other flexible child except the spacer below, so
   without this the buttons would be free to shrink under gap pressure at very narrow widths.
   min-height/padding/font-size set explicitly (2026-09-19, replacing `circle size="small"`)
   since these are now icon+text buttons, not fixed-size circles — a ≥44px touch target per the
   reference doc, with the button's own content driving its actual height instead of a hardcoded
   px number (main.css's own `.el-button--small { height: auto }` rule already does the same). */
.mobile-header__btn {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 12px;
  font-size: 1rem;
}

/* Two of these (one each side of the logo) share the header's remaining space equally,
   centering the logo/name group between the menu and search buttons. */
.mobile-header__spacer {
  flex: 1;
}

/* flex-shrink: 0 for the same reason as .mobile-header__btn above — without it, the logo/name
   group (the widest child) would be the first to give up space under gap pressure at very
   narrow widths, shrinking its text instead of the spacers either side of it giving up their
   own (empty, safe-to-shrink) space first. */
.mobile-header__logo {
  flex-shrink: 0;
}
</style>
