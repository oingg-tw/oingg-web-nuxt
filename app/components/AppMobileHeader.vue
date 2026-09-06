<script setup lang="ts">
import { Menu, Search } from '@element-plus/icons-vue'

// Mobile-only header, mounted only by layouts/mobile.vue — split out of what used to be a
// single StockSearchBar.vue shared with desktop.vue once this side's own behavior (menu-
// trigger + collapsed search icon + dialog) had diverged enough from desktop's (always-visible
// logo + inline input + GitHub link + width toggle) that branching on isWide inside one file
// was more confusing than two small, single-purpose ones ("stock-search-bar 我認為可以拆兩個
// 檔案 因為手機板的行為 與 電腦版的行為落差滿大的").
//
// Left side used to be AppLogo linking home — replaced with a menu-trigger icon that opens
// AppFeatureMenu's dialog instead ("logo 改成開啟功能菜單"). useFeatureMenu() is shared state,
// not a local ref, so this opens the SAME dialog instance mobile.vue's own floating bottom
// button already controls, rather than a second independent one.
const { open: openFeatureMenu } = useFeatureMenu()

// Right side collapses to a search icon ("github icon 隱藏 只保留 search 並且改成一個icon放在
// 右上角") instead of the always-visible inline input + GitHub link desktop keeps — tapping it
// opens this dialog, which reuses LandingStockSearch.vue rather than re-inlining the
// ClientOnly/el-autocomplete SSR-hydration workaround block a second time in this file (see
// StockSearchBar.vue's own comment on that workaround for the underlying reason it's needed
// at all).
const mobileSearchVisible = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => {
  mobileSearchVisible.value = false
})

// lock-scroll="false" + useScrollLock, not el-dialog's own default scroll lock — Element
// Plus's lock-scroll sets overflow-y: hidden on <body>, which shifts content width even with
// scrollbar-gutter: stable applied (that CSS property's gutter reservation isn't reliably
// honored across a visible -> explicit-hidden transition). Reported live: "打開功能的時候 還是
// 會把scroll-bar隱藏造成寬度變化進一步 造成抖動". useScrollLock blocks background scroll by
// intercepting wheel/touchmove instead, never touching overflow/scrollbar rendering at all.
useScrollLock(mobileSearchVisible)

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)
</script>

<template>
  <div ref="barRef" class="mobile-header">
    <el-button
      :icon="Menu"
      circle
      class="mobile-header__btn"
      title="功能選單"
      aria-label="開啟功能選單"
      @click="openFeatureMenu"
    />
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
    <AppLogo always-show-name class="mobile-header__logo" />
    <div class="mobile-header__spacer" />
    <el-button
      :icon="Search"
      circle
      class="mobile-header__btn"
      title="搜尋"
      aria-label="開啟搜尋"
      @click="mobileSearchVisible = true"
    />

    <!-- Not fullscreen: this is a quick in-and-out action, not a browsing surface like
         AppFeatureMenu's own fullscreen dialog — a normal centered/top-anchored dialog is
         lighter for "type a stock code and go." Auto-closes on route change (see the script's
         watch()), since selecting a result navigates away but doesn't unmount this
         component. -->
    <ClientOnly>
      <!-- append-to-body: required, not optional — el-dialog defaults to appendToBody: false
           (renders inline in place, NOT teleported to <body> despite what its name suggests),
           so without this it rendered nested inside .mobile-header, whose own backdrop-filter
           creates a containing block for position: fixed descendants (a lesser-known CSS
           interaction: filter/backdrop-filter/transform on an ancestor re-anchors "fixed"
           positioning to that ancestor's box instead of the viewport). That trapped the
           dialog's overlay inside the header bar's own ~65px-tall box instead of the full
           screen — it existed in the DOM with a real, measurable bounding box, but rendered
           squeezed into a sliver invisible to the eye. Confirmed live by walking the ancestor
           chain (el-overlay's parent was literally .mobile-header) before this fix. -->
      <el-dialog
        v-model="mobileSearchVisible"
        append-to-body
        :lock-scroll="false"
        title="搜尋"
        width="92%"
        top="10vh"
        class="mobile-header__dialog"
      >
        <LandingStockSearch />
      </el-dialog>
    </ClientOnly>
  </div>
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

/* flex-shrink: 0 keeps both circle buttons at their own 44px size — .mobile-header has no
   other flexible child except the spacer below, so without this the buttons would be free to
   shrink under gap pressure at very narrow widths. */
.mobile-header__btn {
  flex-shrink: 0;
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
