<script setup lang="ts">
import { Menu, Search } from '@element-plus/icons-vue'

// Mobile header — mounted on every width by layouts/default.vue since 2026-09-19 (the layout's
// own CSS hides it at ≥1280px, where AppHeaderMenu.vue shows instead). Split out of what used to
// be a single StockSearchBar.vue once this side's own behavior (menu-trigger + collapsed search
// icon + dialog) had diverged enough from desktop's (always-visible logo + inline input + width
// toggle) that branching on isWide inside one file was more confusing than two small,
// single-purpose ones ("stock-search-bar 我認為可以拆兩個檔案 因為手機板的行為 與 電腦版的行為落差
// 滿大的"). A <header> (the page's banner landmark) since 2026-09-19, same as the desktop bar.
//
// Both corner buttons now open a FULL-SCREEN SLIDE LAYER rather than a dialog（2026-09-23,
// 「手機版彈窗希望改掉，改成滑入一個完整的圖層…比照元大券商軟體」）. The direction is the button's
// own side: 選單 is top-left so its layer arrives from the left and pushes the page right; 搜尋 is
// top-right so its layer arrives from the right and pushes the page left.
//
// Left side used to be AppLogo linking home — replaced with a menu trigger ("logo 改成開啟功能
// 菜單"). Right side collapses to a search icon ("github icon 隱藏 只保留 search 並且改成一個icon
// 放在右上角") instead of desktop's always-visible inline input.
//
// This file no longer owns a dialog, a scroll lock, or a route watcher. All three moved with the
// panels: the layer is rendered by the layout（it has to be a sibling of the sliding stage, since
// this header's own backdrop-filter would otherwise trap a fixed child inside its 65px box）,
// AppSlideLayer.vue owns the scroll lock and Escape, and useSlideLayer.ts owns the history entry
// that makes the phone's back button close the layer instead of leaving the page.
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
    <!-- accesskey="n" 2026-09-16 (app/pages/sitemap.vue documents the full scheme) — this
         button already does exactly what Alt+N needs (open the search dialog), no separate
         hidden trigger needed the way desktop's inline input required (see StockSearchBar.vue's
         own accesskey button for that version, where there's no "open" step, just focus). -->
    <el-button class="mobile-header__btn" accesskey="n" @click="toggle('search')">
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
  /* Semi-transparent, not fully — same treatment as desktop's StockSearchBar.vue (see its own
     comment for the "searchbar跑版了" incident this avoids repeating). */
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
